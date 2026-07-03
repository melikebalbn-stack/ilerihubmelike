import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api-response'
import { OvertimeType, OvertimeStatus, FormTipi } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

// Vardiya Faz 1: gece vardiyası sabit penceresi (Pzt-Cuma 21:00 → ertesi 07:00).
const VARDIYA_START = '21:00'
const VARDIYA_END = '07:00'

/**
 * Form numarası oluştur: MESAI → OT-YYYY-NNN, VARDIYA → VRD-YYYY-NNN
 */
async function generateFormNo(formTipi: FormTipi): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `${formTipi === 'VARDIYA' ? 'VRD' : 'OT'}-${year}-`

  const lastForm = await prisma.overtimeForm.findFirst({
    where: { formNo: { startsWith: prefix } },
    orderBy: { formNo: 'desc' },
  })

  let nextNumber = 1
  if (lastForm) {
    const lastNumber = parseInt(lastForm.formNo.split('-').pop() || '0')
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`
}

/**
 * GET: Mesai formlarını listele
 * Query params: status, overtimeType, startDate, endDate, search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireUser — admin/creator/approver/personnel filter için user.id+role gerek
    const { session, user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const overtimeType = searchParams.get('overtimeType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false

    // Vardiya Faz 1: formTipi ile mesai/vardiya ayrımı. Verilmezse MESAI (geriye
    // uyum — mevcut mesai listesi vardiya kayıtlarını GÖRMESİN).
    const formTipiParam = searchParams.get('formTipi')
    const formTipi: FormTipi =
      formTipiParam === 'VARDIYA' ? 'VARDIYA' : 'MESAI'

    // Filtre koşulları
    const where: Record<string, unknown> = { formTipi }

    // Admin değilse sadece kendi formlarını veya onaylayıcı olduğu formları göster
    if (!isAdmin) {
      where.OR = [
        { createdById: user.id },
        { approvals: { some: { approverId: user.id } } },
        // OvertimePersonnel.userId YOK; bağ personnelId (Personnel FK). User↔Personnel
        // linki yoksa bu dalı ekleme ([id] route'undaki erişim mantığıyla aynı).
        ...(user.personnelId
          ? [{ personnel: { some: { personnelId: user.personnelId } } }]
          : []),
      ]
    }

    // Durum filtresi
    if (status && Object.values(OvertimeStatus).includes(status as OvertimeStatus)) {
      where.status = status
    }

    // Mesai türü filtresi
    if (overtimeType && Object.values(OvertimeType).includes(overtimeType as OvertimeType)) {
      where.overtimeType = overtimeType
    }

    // Tarih aralığı filtresi
    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        (where.date as Record<string, unknown>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.date as Record<string, unknown>).lte = new Date(endDate)
      }
    }

    // Arama filtresi (form no veya açıklama)
    if (search) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { formNo: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Formları, toplam sayıyı paralel olarak al
    const [forms, total] = await Promise.all([
      prisma.overtimeForm.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, department: true },
          },
          _count: {
            select: { personnel: true },
          },
          approvals: {
            where: { decision: null },
            orderBy: { step: 'asc' },
            take: 1,
            select: {
              step: true,
              role: true,
              approverId: true,
              approver: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.overtimeForm.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // Yanıtı düzenle
    const formattedForms = forms.map((form) => ({
      id: form.id,
      formNo: form.formNo,
      overtimeType: form.overtimeType,
      date: form.date,
      isFullDay: form.isFullDay,
      startTime: form.startTime,
      endTime: form.endTime,
      description: form.description,
      status: form.status,
      currentStep: form.currentStep,
      sendToGM: form.sendToGM,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      createdBy: form.createdBy,
      personnelCount: form._count.personnel,
      currentApproval: form.approvals[0] || null,
    }))

    return apiSuccess({
      forms: formattedForms,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    return apiError('Mesai formları listelenirken bir hata oluştu', 500, {
      endpoint: 'GET /api/overtime',
      error,
    })
  }
}

/**
 * POST: Yeni mesai formu oluştur
 * Body: { overtimeType, date, isFullDay, startTime?, endTime?, description?, sendToGM, personnel: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireUser — createdById = user.id, role check
    const { session, user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü: Admin değilse yetkili kullanıcı listesinde olmalı
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    if (!isAdmin) {
      const authorized = await prisma.overtimeAuthorizedUser.findUnique({
        where: { userId: user.id },
      })
      if (!authorized) {
        return apiError('Mesai formu oluşturma yetkiniz yok', 403)
      }
    }

    const body = await request.json()
    const {
      overtimeType,
      date,
      isFullDay = true,
      startTime,
      endTime,
      description,
      sendToGM = false,
      personnel,
    } = body

    // Vardiya Faz 1: form tipi (default MESAI → mesai davranışı değişmez).
    const formTipi: FormTipi = body.formTipi === 'VARDIYA' ? 'VARDIYA' : 'MESAI'
    const isVardiya = formTipi === 'VARDIYA'

    // Vardiya sadeleştirme: UI'da mesai-türü kartları kaldırıldı. Savunmacı default —
    // VARDIYA'da tür gelmese bile sabit WEEKDAY_EXTRA. MESAI'de overtimeType client'tan
    // gelir, zorunlu (davranış değişmez).
    const effOvertimeType = isVardiya && !overtimeType ? 'WEEKDAY_EXTRA' : overtimeType

    // Zorunlu alan kontrolleri
    if (!effOvertimeType || !date) {
      return apiBadRequest('Mesai türü ve tarih alanları zorunludur')
    }

    // Mesai türü doğrulama
    if (!Object.values(OvertimeType).includes(effOvertimeType as OvertimeType)) {
      return apiBadRequest('Geçersiz mesai türü')
    }

    // Vardiya: tarih Pzt-Cuma olmalı (gece vardiyası hafta içi). getUTCDay 1-5.
    if (isVardiya) {
      const d = new Date(date)
      const dow = d.getUTCDay() // 0=Paz .. 6=Cmt
      if (dow === 0 || dow === 6) {
        return apiBadRequest('Vardiya yalnızca Pazartesi-Cuma günleri için oluşturulabilir')
      }
    }

    // Personel kontrolü
    if (!personnel || !Array.isArray(personnel) || personnel.length === 0) {
      return apiBadRequest('En az bir personel eklenmelidir')
    }

    // Personel alanları doğrulama
    for (const p of personnel) {
      if (!p.personnelId || !p.workDepartment) {
        return apiBadRequest('Her personel için personnelId ve workDepartment alanları zorunludur')
      }
      if (!p.mesaiNedeni || !String(p.mesaiNedeni).trim()) {
        return apiBadRequest('Her personel için Mesai Nedeni zorunludur')
      }
    }

    // Vardiya: gece penceresi sabit (21:00→07:00); MESAI: mevcut saat-aralığı kuralı.
    const effIsFullDay = isVardiya ? false : isFullDay
    const effStartTime = isVardiya ? VARDIYA_START : startTime
    const effEndTime = isVardiya ? VARDIYA_END : endTime

    // Vardiya Faz 2: 10 kişiyi geçen VARDIYA'da GM onayı ZORUNLU (client bypass'a karşı
    // sunucuda enforce). MESAI'de dokunulmaz — sendToGM body'den gelir.
    const effSendToGM = isVardiya && personnel.length > 10 ? true : sendToGM

    // Saat aralığı kontrolü (tam gün değilse) — vardiyada sabit olduğu için atlanır.
    if (!isVardiya && !isFullDay && (!startTime || !endTime)) {
      return apiBadRequest('Saat aralığı seçildiğinde başlangıç ve bitiş saati zorunludur')
    }

    // Form numarası oluştur (tip bazlı prefix)
    const formNo = await generateFormNo(formTipi)

    // Formu ve personelleri tek transaction ile oluştur
    // Seçim sırasını DETERMİNİSTİK koru: createMany/nested-create aynı ms'te
    // createdAt yazıyor (TIE) → orderBy createdAt asc kararsız kalıyor. index ile
    // monoton createdAt damgalıyoruz; onay görünümü (orderBy createdAt asc) =
    // seçim/oluşturma sırası. (cuid id sıralanabilir DEĞİL — tiebreaker olamaz.)
    const orderBase = Date.now()
    const form = await prisma.overtimeForm.create({
      data: {
        formNo,
        formTipi,
        overtimeType: effOvertimeType as OvertimeType,
        date: new Date(date),
        isFullDay: effIsFullDay,
        startTime: effIsFullDay ? null : effStartTime,
        endTime: effIsFullDay ? null : effEndTime,
        description: description || null,
        sendToGM: effSendToGM,
        createdById: user.id,
        status: 'DRAFT',
        currentStep: 0,
        personnel: {
          create: personnel.map((p: {
            personnelId: string
            workDepartment: string
            serviceRoute?: string
            targetProduction?: string
            hedefAdet?: number
            mesaiNedeni?: string
          }, index: number) => ({
            personnelId: p.personnelId,
            workDepartment: p.workDepartment,
            serviceRoute: p.serviceRoute || null,
            targetProduction: p.targetProduction || null,
            // PR-PERF: sayısal hedef adet — boş/geçersiz/negatif ise null
            hedefAdet:
              p.hedefAdet != null &&
              Number.isFinite(Number(p.hedefAdet)) &&
              Number(p.hedefAdet) >= 0
                ? Math.trunc(Number(p.hedefAdet))
                : null,
            mesaiNedeni: p.mesaiNedeni?.trim() || null,
            createdAt: new Date(orderBase + index),
          })),
        },
      },
      include: {
        personnel: {
          include: {
            personnel: {
              select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, department: true },
        },
      },
    })

    return apiSuccess(form, 201)
  } catch (error) {
    return apiError('Mesai formu oluşturulurken bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime',
      error,
    })
  }
}
