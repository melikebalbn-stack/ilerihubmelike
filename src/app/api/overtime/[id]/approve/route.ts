import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { sendPushToUser } from '@/lib/push-notifications'
import { requireUser } from '@/lib/auth/require-user'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: Mesai formunu onayla veya reddet
 * Body: { decision: "APPROVED" | "REJECTED", comment?, forwardToGM? }
 * Boş pozisyonlar atlanır - sadece mevcut approval kayıtları üzerinden ilerler.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // PR-Y2.5-overtime: requireUser — approverId = user.id
    // PR-FORMS-RBAC: forms.admin override (mevcut approver-chain logic'i korunur)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const body = await request.json()
    const { decision, comment, forwardToGM } = body

    // Karar doğrulama
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return apiBadRequest('Geçerli bir karar belirtilmelidir (APPROVED veya REJECTED)')
    }

    // Formu kontrol et
    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        approvals: {
          orderBy: { step: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    // Form onay sürecinde olmalı
    if (!['PENDING', 'IN_PROGRESS'].includes(form.status)) {
      return apiBadRequest('Bu form şu an onay sürecinde değil')
    }

    // Sıradaki onay kaydını bul: karar verilmemiş ilk kayıt (step sırasına göre)
    const pendingApproval = form.approvals.find(
      (a) => a.decision === null
    )

    if (!pendingApproval) {
      return apiBadRequest('Bekleyen onay kaydı bulunamadı')
    }

    // Yetki kontrolü: Atanmış kişi mi veya admin mi?
    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    const isAssignedApprover = pendingApproval.approverId === user.id

    if (!isAdmin && !isAssignedApprover) {
      return apiError(
        `Bu adımı onaylama yetkiniz yok. Bu adım için atanmış onaylayıcı değilsiniz.`,
        403
      )
    }

    // Transaction ile onay işlemini gerçekleştir
    const updatedForm = await prisma.$transaction(async (tx) => {
      if (decision === 'APPROVED') {
        // Onay kaydını güncelle
        await tx.overtimeApproval.update({
          where: { id: pendingApproval.id },
          data: {
            decision: 'APPROVED',
            approverId: user.id,
            comment: comment || null,
            decidedAt: new Date(),
            forwardToGM: forwardToGM || false,
          },
        })

        // GMY adımı (step 6) ve forwardToGM seçildiyse
        if (pendingApproval.step === 6 && forwardToGM === true) {
          // sendToGM'i true yap
          await tx.overtimeForm.update({
            where: { id },
            data: { sendToGM: true },
          })

          // 7. adım kaydı yoksa oluştur
          const existingGmApproval = form.approvals.find((a) => a.step === 7)

          if (!existingGmApproval) {
            // GM pozisyonunu DB'den çek
            const gmPosition = await tx.approvalPosition.findUnique({
              where: { code: 'GM' },
            })

            await tx.overtimeApproval.create({
              data: {
                overtimeFormId: id,
                step: 7,
                role: 'Genel Müdür',
                approverId: gmPosition?.userId || null,
                decision: null,
                comment: null,
                decidedAt: null,
                forwardToGM: false,
              },
            })
          }
        }

        // Güncel onay kayıtlarını tekrar çek (forwardToGM ile yeni kayıt eklenmiş olabilir)
        const freshApprovals = await tx.overtimeApproval.findMany({
          where: { overtimeFormId: id },
          orderBy: { step: 'asc' },
        })

        // Kalan bekleyen onay var mı?
        const remainingPending = freshApprovals.filter((a) => a.decision === null)

        if (remainingPending.length === 0) {
          // Tüm adımlar tamamlandı - form onaylandı
          const result = await tx.overtimeForm.update({
            where: { id },
            data: {
              currentStep: pendingApproval.step,
              status: 'APPROVED',
            },
            include: {
              approvals: { orderBy: { step: 'asc' } },
              createdBy: { select: { id: true, name: true, email: true } },
            },
          })

          // Form sahibine "onaylandı" bildirimi gönder
          try {
            await tx.notification.create({
              data: {
                userId: form.createdById,
                title: 'Mesai Formu Onaylandı',
                message: `${form.formNo} numaralı mesai formunuz tamamen onaylandı.`,
                type: 'REMINDER',
                link: `/forms/overtime/${id}`,
              },
            })
          } catch {
            // Bildirim oluşturulamazsa devam et
          }

          return {
            result,
            pushTarget: {
              userId: form.createdById,
              title: 'Mesai Formu Onaylandı',
              body: `${form.formNo} numaralı mesai formunuz tamamen onaylandı.`,
            },
          }
        } else {
          // Sonraki adıma geç
          const nextPending = remainingPending[0]
          const result = await tx.overtimeForm.update({
            where: { id },
            data: {
              currentStep: pendingApproval.step,
              status: 'IN_PROGRESS',
            },
            include: {
              approvals: { orderBy: { step: 'asc' } },
              createdBy: { select: { id: true, name: true, email: true } },
            },
          })

          // Sonraki onaylayıcıya bildirim gönder
          if (nextPending.approverId) {
            try {
              await tx.notification.create({
                data: {
                  userId: nextPending.approverId,
                  title: 'Mesai Formu Onayı Bekliyor',
                  message: `${form.formNo} numaralı mesai formu onayınızı bekliyor.`,
                  type: 'REMINDER',
                  link: `/forms/overtime/${id}`,
                },
              })
            } catch {
              // Bildirim oluşturulamazsa devam et
            }
          }

          return {
            result,
            pushTarget: nextPending.approverId ? {
              userId: nextPending.approverId,
              title: 'Mesai Formu Onayı Bekliyor',
              body: `${form.formNo} numaralı mesai formu onayınızı bekliyor.`,
            } : null,
          }
        }
      } else {
        // REJECTED
        // Onay kaydını güncelle
        await tx.overtimeApproval.update({
          where: { id: pendingApproval.id },
          data: {
            decision: 'REJECTED',
            approverId: user.id,
            comment: comment || null,
            decidedAt: new Date(),
          },
        })

        // Form durumunu REJECTED yap
        const result = await tx.overtimeForm.update({
          where: { id },
          data: {
            status: 'REJECTED',
          },
          include: {
            approvals: { orderBy: { step: 'asc' } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        })

        const rejectMsg = `${form.formNo} numaralı mesai formunuz ${pendingApproval.role || 'onaylayıcı'} tarafından reddedildi.${comment ? ` Açıklama: ${comment}` : ''}`

        // Form sahibine "reddedildi" bildirimi gönder
        try {
          await tx.notification.create({
            data: {
              userId: form.createdById,
              title: 'Mesai Formu Reddedildi',
              message: rejectMsg,
              type: 'REMINDER',
              link: `/forms/overtime/${id}`,
            },
          })
        } catch {
          // Bildirim oluşturulamazsa devam et
        }

        return {
          result,
          pushTarget: {
            userId: form.createdById,
            title: 'Mesai Formu Reddedildi',
            body: rejectMsg,
          },
        }
      }
    })

    // Transaction sonrası push bildirim gönder
    if (updatedForm.pushTarget) {
      sendPushToUser(prisma, updatedForm.pushTarget.userId, {
        title: updatedForm.pushTarget.title,
        body: updatedForm.pushTarget.body,
        url: `/forms/overtime/${id}`,
        tag: `overtime-approve-${id}`,
      }).catch(() => {})
    }

    return apiSuccess(updatedForm.result)
  } catch (error) {
    return apiError('Onay işlemi sırasında bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/[id]/approve',
      error,
    })
  }
}
