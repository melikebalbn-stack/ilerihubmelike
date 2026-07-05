import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { OvertimeType } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { resolveAllowedDepts } from '@/lib/overtime-performance'
import { buildSingles, buildUretimRows, type OvertimePersonnelInput } from '@/lib/overtime-uretim'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: Mesai formu detayı
 * Personel (kullanıcı bilgileri ile), onay geçmişi ve oluşturan bilgilerini içerir
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role check
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            personnel: {
              select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
                jobTitle: true,
              },
            },
            // Çift-onaycı: eskale olmuş adımda yedek onaycı da "Onayla" görebilsin diye email lazım.
            escalatedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { step: 'asc' },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            jobTitle: true,
          },
        },
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Erişim kontrolü: admin, form sahibi, personel, onaylayıcı VEYA omurga birim
    // sorumlusu (formda kendi bölümünün personeli varsa). Sorumlu, gerçekleşen adet
    // girebilmek için formu açabilmeli.
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    const isCreator = form.createdById === user.id
    const isPersonnel = !!user.personnelId && form.personnel.some((p) => p.personnelId === user.personnelId)
    const isApprover = form.approvals.some((a) => a.approverId === user.id)

    // Omurga kapsamı (gerçekleşen adet satır-bazlı yetki + read erişimi):
    // undefined = tümü (admin/report.all); [adlar] = o bölümler; [] = hiçbiri.
    const allowed = await resolveAllowedDepts(user.id)
    const currentUserAllowedDepts = allowed === undefined ? null : allowed
    const normDept = (s?: string | null) => (s ?? '').trim().toLocaleUpperCase('tr-TR')
    const isDeptResponsible =
      allowed === undefined
        ? true
        : allowed.length > 0 &&
          (() => {
            const set = new Set(allowed.map(normDept))
            return form.personnel.some((op) => set.has(normDept(op.workDepartment)))
          })()

    if (!isAdmin && !isCreator && !isPersonnel && !isApprover && !isDeptResponsible) {
      return apiError('Bu forma erişim yetkiniz yok', 403)
    }

    return apiSuccess({ ...form, currentUserAllowedDepts })
  } catch (error) {
    return apiError('Mesai formu detayı alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/overtime/[id]',
      error,
    })
  }
}

/**
 * PUT: Mesai formunu güncelle (sadece DRAFT durumundayken)
 * Body: { overtimeType?, date?, isFullDay?, startTime?, endTime?, description?, sendToGM?, personnel?: [...] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role check
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // Mevcut formu kontrol et
    const existingForm = await prisma.overtimeForm.findUnique({
      where: { id },
      include: { personnel: true },
    })

    if (!existingForm) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Sadece form sahibi veya admin güncelleyebilir
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    if (existingForm.createdById !== user.id && !isAdmin) {
      return apiError('Bu formu güncelleme yetkiniz yok', 403)
    }

    // Sadece taslak formlar güncellenebilir
    if (existingForm.status !== 'DRAFT') {
      return apiBadRequest('Sadece taslak durumundaki formlar güncellenebilir')
    }

    const body = await request.json()
    const {
      overtimeType,
      date,
      isFullDay,
      startTime,
      endTime,
      description,
      sendToGM,
      personnel,
    } = body

    // Mesai türü doğrulama
    if (overtimeType && !Object.values(OvertimeType).includes(overtimeType as OvertimeType)) {
      return apiBadRequest('Geçersiz mesai türü')
    }

    // Vardiya tarih kuralı (create ile birebir). Hafta modu → Pazartesi (dow 1);
    // gün modu → Pzt-Cuma (1-5). effHaftaMi: body verdiyse ondan, yoksa mevcut kayıttan.
    const isVardiyaForm = existingForm.formTipi === 'VARDIYA'
    const effHaftaMi = isVardiyaForm && (body.vardiyaHaftaMi !== undefined ? body.vardiyaHaftaMi === true : existingForm.vardiyaHaftaMi)
    if (isVardiyaForm && date !== undefined) {
      const dow = new Date(date).getUTCDay()
      if (effHaftaMi) {
        if (dow !== 1) return apiBadRequest('Hafta modunda tarih haftanın Pazartesi günü olmalıdır')
      } else if (dow === 0 || dow === 6) {
        return apiBadRequest('Vardiya yalnızca Pazartesi-Cuma günleri için oluşturulabilir')
      }
    }

    // Personel doğrulama
    if (personnel !== undefined) {
      if (!Array.isArray(personnel) || personnel.length === 0) {
        return apiBadRequest('En az bir personel eklenmelidir')
      }
      for (const p of personnel) {
        if (!p.personnelId || !p.workDepartment) {
          return apiBadRequest('Her personel için personnelId ve workDepartment alanları zorunludur')
        }
        if (!p.mesaiNedeni || !String(p.mesaiNedeni).trim()) {
          return apiBadRequest('Her personel için Mesai Nedeni zorunludur')
        }
      }
    }

    // Transaction ile güncelle
    const updatedForm = await prisma.$transaction(async (tx) => {
      // Form bilgilerini güncelle
      const formData: Record<string, unknown> = {}

      if (overtimeType !== undefined) formData.overtimeType = overtimeType
      if (date !== undefined) formData.date = new Date(date)
      if (isFullDay !== undefined) {
        formData.isFullDay = isFullDay
        if (isFullDay) {
          formData.startTime = null
          formData.endTime = null
        }
      }
      if (startTime !== undefined) formData.startTime = startTime
      if (endTime !== undefined) formData.endTime = endTime
      if (description !== undefined) formData.description = description || null
      if (sendToGM !== undefined) formData.sendToGM = sendToGM
      // Vardiya Hafta Modu: yalnız VARDIYA formunda güncellenir (MESAI'de dokunulmaz).
      if (isVardiyaForm && body.vardiyaHaftaMi !== undefined) formData.vardiyaHaftaMi = body.vardiyaHaftaMi === true

      const form = await tx.overtimeForm.update({
        where: { id },
        data: formData,
      })

      // Personel listesi güncellenecekse
      if (personnel !== undefined) {
        // Mevcut personeli sil
        await tx.overtimePersonnel.deleteMany({
          where: { overtimeFormId: id },
        })

        // Yeni personel listesini ekle — seçim/kayıt sırasını DETERMİNİSTİK koru:
        // index ile monoton createdAt damgalıyoruz (aksi halde tümü aynı ms = TIE →
        // orderBy createdAt asc kararsız). Onay görünümü = kayıt sırası.
        // Faz 1 çift yazma: createMany nested-relation desteklemediği için nested
        // create döngüsü. Deterministik createdAt (orderBase + index) korunur.
        const orderBase = Date.now()
        for (const [index, p] of (personnel as (OvertimePersonnelInput & {
          personnelId: string
          workDepartment: string
          serviceRoute?: string | null
        })[]).entries()) {
          // targetProduction retired — yazılmıyor.
          const singles = buildSingles(p)
          await tx.overtimePersonnel.create({
            data: {
              overtimeFormId: id,
              personnelId: p.personnelId,
              workDepartment: p.workDepartment,
              serviceRoute: p.serviceRoute || null,
              hedefAdet: singles.hedefAdet,
              mesaiNedeni: singles.mesaiNedeni,
              createdAt: new Date(orderBase + index),
              uretimSatirlari: { create: buildUretimRows(p) },
            },
          })
        }
      }

      // Güncellenmiş formu ilişkileri ile döndür
      return tx.overtimeForm.findUnique({
        where: { id },
        include: {
          personnel: {
            include: {
              personnel: {
                select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { step: 'asc' },
          },
          createdBy: {
            select: { id: true, name: true, email: true, department: true },
          },
        },
      })
    })

    return apiSuccess(updatedForm)
  } catch (error) {
    return apiError('Mesai formu güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/overtime/[id]',
      error,
    })
  }
}

/**
 * DELETE: Mesai formunu sil (sadece DRAFT durumundayken)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role check
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // Mevcut formu kontrol et
    const existingForm = await prisma.overtimeForm.findUnique({
      where: { id },
    })

    if (!existingForm) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Sadece form sahibi veya admin silebilir
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    if (existingForm.createdById !== user.id && !isAdmin) {
      return apiError('Bu formu silme yetkiniz yok', 403)
    }

    // Sadece taslak formlar silinebilir
    if (existingForm.status !== 'DRAFT') {
      return apiBadRequest('Sadece taslak durumundaki formlar silinebilir')
    }

    // Cascade delete sayesinde personnel ve approvals da silinir
    await prisma.overtimeForm.delete({
      where: { id },
    })

    return apiSuccess({ message: 'Mesai formu başarıyla silindi' })
  } catch (error) {
    return apiError('Mesai formu silinirken bir hata oluştu', 500, {
      endpoint: 'DELETE /api/overtime/[id]',
      error,
    })
  }
}
