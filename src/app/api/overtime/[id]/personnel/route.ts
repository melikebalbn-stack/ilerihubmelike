import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { requireUser } from '@/lib/auth/require-user'
import { resolveAllowedDepts } from '@/lib/overtime-performance'
import { buildSingles, buildUretimRows, buildBackfillRow, coerceIntNonNeg, coerceHedefPozitif, buildParcaKoduDuzeltme, type OvertimePersonnelInput } from '@/lib/overtime-uretim'

// Bölüm adı normalize: workDepartment ↔ omurga (getDeptSubtreeNames) adları güvenli
// kıyas (Türkçe upper + trim). Exact-match'in süperseti; geçerli eşleşmeyi bozmaz.
function normDept(s?: string | null): string {
  return (s ?? '').trim().toLocaleUpperCase('tr-TR')
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Yetki kontrolü: Form sahibi (DRAFT'ta), onaylayıcı veya admin
 */
async function checkPersonnelEditAccess(
  form: { status: string; createdById: string; approvals: { approverId: string | null; decision: string | null }[] },
  userId: string,
  isAdmin: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  const isCreator = form.createdById === userId

  // DRAFT: sadece form sahibi veya admin
  if (form.status === 'DRAFT') {
    if (isCreator || isAdmin) return { allowed: true }
    return { allowed: false, reason: 'Taslak formu sadece oluşturan kişi düzenleyebilir' }
  }

  // PENDING/IN_PROGRESS: onaylayıcı veya admin
  if (['PENDING', 'IN_PROGRESS'].includes(form.status)) {
    if (isAdmin) return { allowed: true }
    const pendingApproval = form.approvals.find((a) => a.decision === null)
    if (pendingApproval && pendingApproval.approverId === userId) return { allowed: true }
    return { allowed: false, reason: 'Personel listesini sadece sıradaki onaylayıcı düzenleyebilir' }
  }

  return { allowed: false, reason: 'Bu durumdaki formda personel düzenlenemez' }
}

/**
 * POST: Forma personel ekle (DRAFT, PENDING veya IN_PROGRESS durumlarında)
 * Body: { personnelId, workDepartment, serviceRoute?, mesaiNedeni? (parça kodu), hedefAdet? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role check
    // PR-FORMS-RBAC: forms.admin permission
    const { session, user, error } = await requireUser()
    if (error) return error
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false

    const { id } = await params

    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: true,
        approvals: { orderBy: { step: 'asc' } },
      },
    })

    if (!form) return apiNotFound('Mesai formu bulunamadı')

    const access = await checkPersonnelEditAccess(form, user.id, isAdmin)
    if (!access.allowed) return apiError(access.reason!, 403)

    const body = await request.json()
    const { personnelId: targetPersonnelId, workDepartment } = body

    if (!targetPersonnelId || !workDepartment) {
      return apiBadRequest('personnelId ve workDepartment alanları zorunludur')
    }

    // Zaten ekliyse hata ver
    const alreadyExists = form.personnel.some((p) => p.personnelId === targetPersonnelId)
    if (alreadyExists) {
      return apiBadRequest('Bu personel zaten formda mevcut')
    }

    // Faz 1 çift yazma: tekil alanlar (buildSingles) + çoklu üretim satırları.
    // targetProduction retired — yazılmıyor.
    const pInput = body as OvertimePersonnelInput
    const singles = buildSingles(pInput)

    // Personeli ekle
    await prisma.overtimePersonnel.create({
      data: {
        overtimeFormId: id,
        personnelId: targetPersonnelId,
        workDepartment,
        serviceRoute: body.serviceRoute || null,
        hedefAdet: singles.hedefAdet,
        mesaiNedeni: singles.mesaiNedeni,
        uretimSatirlari: { create: buildUretimRows(pInput) },
      },
    })

    // Güncellenmiş formu döndür
    const updatedForm = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            personnel: {
              select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
            },
            uretimSatirlari: { orderBy: { sira: 'asc' }, include: { duzelten: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, department: true, jobTitle: true },
            },
          },
          orderBy: { step: 'asc' },
        },
        createdBy: { select: { id: true, name: true, email: true, department: true, jobTitle: true } },
      },
    })

    return apiSuccess(updatedForm)
  } catch (error) {
    return apiError('Personel eklenirken bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/[id]/personnel',
      error,
    })
  }
}

/**
 * DELETE: Formdan personel çıkar (DRAFT, PENDING veya IN_PROGRESS durumlarında)
 * Body: { personnelId }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role check
    // PR-FORMS-RBAC: forms.admin permission
    const { session, user, error } = await requireUser()
    if (error) return error
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false

    const { id } = await params

    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: true,
        approvals: { orderBy: { step: 'asc' } },
      },
    })

    if (!form) return apiNotFound('Mesai formu bulunamadı')

    const access = await checkPersonnelEditAccess(form, user.id, isAdmin)
    if (!access.allowed) return apiError(access.reason!, 403)

    const body = await request.json()
    const { personnelId } = body

    if (!personnelId) {
      return apiBadRequest('personnelId zorunludur')
    }

    // Personel bu formda mı kontrol et
    const personnel = form.personnel.find((p) => p.id === personnelId)
    if (!personnel) {
      return apiNotFound('Personel kaydı bulunamadı')
    }

    // En az 1 personel kalmalı
    if (form.personnel.length <= 1) {
      return apiBadRequest('Formda en az 1 personel bulunmalıdır')
    }

    // Personeli sil
    await prisma.overtimePersonnel.delete({
      where: { id: personnelId },
    })

    // Güncellenmiş formu döndür
    const updatedForm = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            personnel: {
              select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
            },
            uretimSatirlari: { orderBy: { sira: 'asc' }, include: { duzelten: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, department: true, jobTitle: true },
            },
          },
          orderBy: { step: 'asc' },
        },
        createdBy: { select: { id: true, name: true, email: true, department: true, jobTitle: true } },
      },
    })

    return apiSuccess(updatedForm)
  } catch (error) {
    return apiError('Personel çıkarılırken bir hata oluştu', 500, {
      endpoint: 'DELETE /api/overtime/[id]/personnel',
      error,
    })
  }
}

/**
 * PUT: Personel gerçekleşen üretim bilgilerini güncelle
 * Sadece onaylanmış (APPROVED) formlarda güncellenebilir
 * Body: { personnel: [{ overtimePersonnelId, gerceklesenAdet, gerceklesenNote }] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role/authorized-user check
    // PR-FORMS-RBAC: forms.admin permission
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // Formu kontrol et — çift yazma için üretim satırları da yüklenir (sira asc).
    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: {
          include: { uretimSatirlari: { orderBy: { sira: 'asc' }, include: { duzelten: { select: { id: true, name: true } } } } },
        },
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Sadece onaylanmış formlar güncellenebilir
    if (form.status !== 'APPROVED') {
      return apiBadRequest('Gerçekleşen üretim bilgisi sadece onaylanmış formlarda güncellenebilir')
    }

    // Yetki kontrolü: form sahibi, admin, mesai formu yetkili kullanıcısı VEYA
    // omurga birim sorumlusu (kendi bölümü satırları — satır-bazlı).
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    const isCreator = form.createdById === user.id
    let isAuthorizedOvertimeUser = false
    if (!isAdmin && !isCreator) {
      const authEntry = await prisma.overtimeAuthorizedUser.findUnique({
        where: { userId: user.id },
      })
      isAuthorizedOvertimeUser = !!authEntry
    }

    // Omurga kapsamı: undefined = tümü (admin/report.all), [] = hiçbiri, [adlar] = bölümler.
    const allowed = await resolveAllowedDepts(user.id)
    // fullAccess: tüm satırları yazabilir (mevcut davranış korunur).
    const fullAccess = isAdmin || isCreator || isAuthorizedOvertimeUser || allowed === undefined
    // Kısıtlı (omurga sorumlusu): sadece kendi bölümü satırları.
    const allowedSet: Set<string> | null = fullAccess ? null : new Set((allowed ?? []).map(normDept))

    if (!fullAccess) {
      // Yetki VAR mı: form satırlarından en az biri sorumlunun bölümünde olmalı.
      const hasAnyAllowedRow = form.personnel.some((op) => allowedSet!.has(normDept(op.workDepartment)))
      if (!hasAnyAllowedRow) {
        return apiError('Bu formu güncelleme yetkiniz yok', 403)
      }
    }

    const body = await request.json()
    const { personnel } = body

    if (!personnel || !Array.isArray(personnel) || personnel.length === 0) {
      return apiBadRequest('Personel listesi zorunludur')
    }

    // Her personel için (PR-PERF) gerceklesenAdet/gerceklesenNote güncelle.
    // Faz 1 çift yazma: tekil alanlar + üretim satırları senkron.
    //   - Legacy payload (tek gerceklesenAdet): tekil alan güncellenir, 1. üretim
    //     satırı (min sira) aynı değerle senkronlanır.
    //   - Satır-bazlı payload (uretimSatirlari[]): her satır id ile güncellenir,
    //     1. satır tekil alana yansıtılır.
    const ops: Promise<unknown>[] = []
    for (const p of personnel as {
      overtimePersonnelId: string
      gerceklesenAdet?: string | number
      gerceklesenNote?: string
      uretimSatirlari?: {
        id?: string
        gerceklesenAdet?: string | number
        gerceklesenNote?: string
        hurdaAdet?: string | number
        hedefAdet?: string | number
        parcaKodu?: string
        parcaKoduDuzeltmeNote?: string
      }[]
    }[]) {
      if (!p.overtimePersonnelId) continue

      // Bu formda bu personel var mı kontrol et
      const existingPersonnel = form.personnel.find((ep) => ep.id === p.overtimePersonnelId)
      if (!existingPersonnel) continue

      // GÜVENLİK (satır-bazlı): kısıtlı sorumlu, allowed DIŞI satırı ASLA yazamaz → ATLA.
      if (!fullAccess && !allowedSet!.has(normDept(existingPersonnel.workDepartment))) {
        console.warn(
          `[gerceklesen-omurga-yetki] user=${user.id} yetkisiz bölüm satırı atlandı: ` +
            `overtimePersonnelId=${existingPersonnel.id} workDepartment=${existingPersonnel.workDepartment}`
        )
        continue
      }

      const uretimRows = existingPersonnel.uretimSatirlari
      const firstRow = uretimRows[0] // min sira

      if (Array.isArray(p.uretimSatirlari) && p.uretimSatirlari.length > 0) {
        // Satır-bazlı: yalnız bu personele ait satırları id ile güncelle. KISMİ güncelleme
        // — sadece payload'da GELEN alanlar yazılır (hedefAdet-only doldurma gerceklesen'i
        // silmez). hedefAdet API kuralı: yalnız > 0 ise yazılır (geçersiz → yok say).
        const ownRows = new Map(uretimRows.map((r) => [r.id, r]))
        // Tekil (OvertimePersonnel) senkron alanları — 1. satırdan biriktirilir, sonda 1 update.
        const singleData: Record<string, unknown> = {}
        for (const r of p.uretimSatirlari) {
          if (!r.id) continue
          const existingRow = ownRows.get(r.id)
          if (!existingRow) continue
          const data: Record<string, unknown> = {}
          if ('gerceklesenAdet' in r) data.gerceklesenAdet = coerceIntNonNeg(r.gerceklesenAdet)
          if ('gerceklesenNote' in r) data.gerceklesenNote = r.gerceklesenNote?.trim() || null
          if ('hurdaAdet' in r) data.hurdaAdet = coerceIntNonNeg(r.hurdaAdet)
          if ('hedefAdet' in r) {
            const h = coerceHedefPozitif(r.hedefAdet)
            if (h != null) data.hedefAdet = h
          }
          // Parça kodu (Mesai Nedeni) sonradan düzeltme — yetki bu satır için yukarıda geçti.
          // Saf mantık helper'da (eskiParcaKodu bir-kez, audit): buildParcaKoduDuzeltme.
          if ('parcaKodu' in r) {
            const res = buildParcaKoduDuzeltme(
              { parcaKodu: existingRow.parcaKodu, eskiParcaKodu: existingRow.eskiParcaKodu },
              r.parcaKodu,
              user.id,
              'parcaKoduDuzeltmeNote' in r ? (r.parcaKoduDuzeltmeNote ?? '') : undefined,
              new Date()
            )
            if (res.error === 'bos') return apiBadRequest('Parça kodu boş olamaz')
            if (res.data) {
              Object.assign(data, res.data)
              // min-sira satırıysa tekil mesaiNedeni senkron (Faz 3'e kadar tutarlılık).
              if (firstRow && r.id === firstRow.id) singleData.mesaiNedeni = res.data.parcaKodu
            }
          }
          if (Object.keys(data).length === 0) continue
          ops.push(prisma.overtimePersonnelUretim.update({ where: { id: r.id }, data }))
        }
        // 1. satır → tekil gerceklesen senkronu (yalnız gelen alanlar) + parça senkronu (yukarıda).
        const firstInput = firstRow ? p.uretimSatirlari.find((r) => r.id === firstRow.id) : undefined
        if (firstInput) {
          if ('gerceklesenAdet' in firstInput) singleData.gerceklesenAdet = coerceIntNonNeg(firstInput.gerceklesenAdet)
          if ('gerceklesenNote' in firstInput) singleData.gerceklesenNote = firstInput.gerceklesenNote?.trim() || null
        }
        if (Object.keys(singleData).length > 0) {
          ops.push(prisma.overtimePersonnel.update({ where: { id: existingPersonnel.id }, data: singleData }))
        }
      } else {
        // Legacy: tekil alan güncelle + 1. üretim satırını senkronla.
        const adet = coerceIntNonNeg(p.gerceklesenAdet)
        const note = p.gerceklesenNote?.trim() || null
        ops.push(
          prisma.overtimePersonnel.update({
            where: { id: existingPersonnel.id },
            data: { gerceklesenAdet: adet, gerceklesenNote: note },
          })
        )
        if (firstRow) {
          ops.push(
            prisma.overtimePersonnelUretim.update({
              where: { id: firstRow.id },
              data: { gerceklesenAdet: adet, gerceklesenNote: note },
            })
          )
        } else {
          // UPSERT: dual-write/backfill öncesi oluşmuş eski kayıt henüz satırsız. Backfill
          // semantiğiyle (parcaKodu <- mesaiNedeni, hedefAdet nullable taşınır) 1. satırı
          // türetip bu gerceklesen değerleriyle oluştur — Faz 3 drop'ta veri kaybı olmaz.
          // parcaKodu (mesaiNedeni) boşsa türetilemez → yalnız tekil alan güncellenir, patlamaz.
          const seed = buildBackfillRow({
            mesaiNedeni: existingPersonnel.mesaiNedeni,
            hedefAdet: existingPersonnel.hedefAdet,
            gerceklesenAdet: adet,
            gerceklesenNote: note,
          })
          if (seed) {
            ops.push(
              prisma.overtimePersonnelUretim.create({
                data: { overtimePersonnelId: existingPersonnel.id, ...seed },
              })
            )
          }
        }
      }
    }

    await Promise.all(ops)

    // Güncellenmiş formu döndür
    const updatedForm = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: {
          include: {
            personnel: {
              select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true, telefon: true, serviceRoute: true },
            },
            uretimSatirlari: { orderBy: { sira: 'asc' }, include: { duzelten: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, department: true, jobTitle: true },
            },
          },
          orderBy: { step: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true, email: true, department: true, jobTitle: true },
        },
      },
    })

    return apiSuccess(updatedForm)
  } catch (error) {
    return apiError('Personel bilgileri güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/overtime/[id]/personnel',
      error,
    })
  }
}
