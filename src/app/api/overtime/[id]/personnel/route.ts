import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { requireUser } from '@/lib/auth/require-user'

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
 * Body: { userId, workDepartment, serviceRoute?, targetProduction? }
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
    const { personnelId: targetPersonnelId, workDepartment, serviceRoute, targetProduction } = body

    if (!targetPersonnelId || !workDepartment) {
      return apiBadRequest('personnelId ve workDepartment alanları zorunludur')
    }

    // Zaten ekliyse hata ver
    const alreadyExists = form.personnel.some((p) => p.personnelId === targetPersonnelId)
    if (alreadyExists) {
      return apiBadRequest('Bu personel zaten formda mevcut')
    }

    // Personeli ekle
    await prisma.overtimePersonnel.create({
      data: {
        overtimeFormId: id,
        personnelId: targetPersonnelId,
        workDepartment,
        serviceRoute: serviceRoute || null,
        targetProduction: targetProduction || null,
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
 * Body: { personnel: [{ userId, actualProduction }] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — ownership/role/authorized-user check
    // PR-FORMS-RBAC: forms.admin permission
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    // Formu kontrol et
    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        personnel: true,
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Sadece onaylanmış formlar güncellenebilir
    if (form.status !== 'APPROVED') {
      return apiBadRequest('Gerçekleşen üretim bilgisi sadece onaylanmış formlarda güncellenebilir')
    }

    // Yetki kontrolü: form sahibi, admin veya mesai formu yetkili kullanıcısı
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    const isCreator = form.createdById === user.id
    let isAuthorizedOvertimeUser = false
    if (!isAdmin && !isCreator) {
      const authEntry = await prisma.overtimeAuthorizedUser.findUnique({
        where: { userId: user.id },
      })
      isAuthorizedOvertimeUser = !!authEntry
    }
    if (!isCreator && !isAdmin && !isAuthorizedOvertimeUser) {
      return apiError('Bu formu güncelleme yetkiniz yok', 403)
    }

    const body = await request.json()
    const { personnel } = body

    if (!personnel || !Array.isArray(personnel) || personnel.length === 0) {
      return apiBadRequest('Personel listesi zorunludur')
    }

    // Her personel için actualProduction güncelle
    const updatePromises = personnel.map(async (p: { overtimePersonnelId: string; actualProduction: string }) => {
      if (!p.overtimePersonnelId) {
        return null
      }

      // Bu formda bu personel var mı kontrol et
      const existingPersonnel = form.personnel.find(
        (ep) => ep.id === p.overtimePersonnelId
      )

      if (!existingPersonnel) {
        return null
      }

      return prisma.overtimePersonnel.update({
        where: { id: existingPersonnel.id },
        data: {
          actualProduction: p.actualProduction || null,
        },
      })
    })

    await Promise.all(updatePromises.filter(Boolean))

    // Güncellenmiş formu döndür
    const updatedForm = await prisma.overtimeForm.findUnique({
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
