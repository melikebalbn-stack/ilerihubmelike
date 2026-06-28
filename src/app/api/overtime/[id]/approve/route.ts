import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { sendPushToUser } from '@/lib/push-notifications'
import { requireUser } from '@/lib/auth/require-user'
import { sendEmail } from '@/lib/email'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'

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
    if (!decision || !['APPROVED', 'REJECTED', 'RETURNED'].includes(decision)) {
      return apiBadRequest('Geçerli bir karar belirtilmelidir (APPROVED, REJECTED veya RETURNED)')
    }

    // RETURNED (düzeltmeye iade) için açıklama zorunlu
    if (decision === 'RETURNED' && !comment?.trim()) {
      return apiBadRequest('İade için açıklama zorunludur')
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

    // İV-FINAL: bekleyen adımın pozisyon CODE'unu çöz (hard-coded step-no yerine).
    // Önce approverId→ApprovalPosition, sonra title snapshot fallback → in-flight
    // (eski sıralı) formlarda da çalışır; OvertimeApproval'da code kolonu YOK.
    let pendingCode: string | null = null
    if (pendingApproval.approverId) {
      const byUser = await prisma.approvalPosition.findFirst({
        where: { userId: pendingApproval.approverId },
        select: { code: true },
      })
      pendingCode = byUser?.code ?? null
    }
    if (!pendingCode) {
      const byTitle = await prisma.approvalPosition.findFirst({
        where: { title: pendingApproval.role },
        select: { code: true },
      })
      pendingCode = byTitle?.code ?? null
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

        // GMY adımı (CODE='DEPUTY_GM') ve forwardToGM seçildiyse → GM'i GMY ile
        // İV ARASINA ekle (GM.sortOrder İV'den küçük). step-no hard-code YOK.
        if (pendingCode === 'DEPUTY_GM' && forwardToGM === true) {
          // sendToGM'i true yap
          await tx.overtimeForm.update({
            where: { id },
            data: { sendToGM: true },
          })

          // GM pozisyonunu DB'den çek (step = GM.sortOrder → İV'den ÖNCE)
          const gmPosition = await tx.approvalPosition.findUnique({
            where: { code: 'GM' },
          })

          // GM zaten zincirde mi? (approverId ya da title snapshot ile — step-no'ya bağlı değil)
          const existingGmApproval = form.approvals.find(
            (a) =>
              (gmPosition?.userId != null && a.approverId === gmPosition.userId) ||
              a.role === (gmPosition?.title ?? 'Genel Müdür')
          )

          if (gmPosition && !existingGmApproval) {
            await tx.overtimeApproval.create({
              data: {
                overtimeFormId: id,
                step: gmPosition.sortOrder,
                role: gmPosition.title || 'Genel Müdür',
                approverId: gmPosition.userId || null,
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
            mail: null,
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
            mail: null,
          }
        }
      } else if (decision === 'RETURNED') {
        // RETURNED — düzeltmeye iade: form DRAFT'a döner, sahibi düzeltip yeniden gönderir.
        // Diğer (decision=null) approval kayıtlarına DOKUNMA — resubmit (submit) hepsini
        // silip zinciri 1. adımdan yeniden kurar (deleteMany + createMany).
        await tx.overtimeApproval.update({
          where: { id: pendingApproval.id },
          data: {
            decision: 'RETURNED',
            approverId: user.id,
            comment: comment || null,
            decidedAt: new Date(),
          },
        })

        const result = await tx.overtimeForm.update({
          where: { id },
          data: { status: 'DRAFT', currentStep: 0 },
          include: {
            approvals: { orderBy: { step: 'asc' } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
        })

        const returnMsg = `${form.formNo} numaralı mesai formunuz ${pendingApproval.role || 'onaylayıcı'} tarafından düzeltme için iade edildi. Açıklama: ${comment}`

        try {
          await tx.notification.create({
            data: {
              userId: form.createdById,
              title: 'Mesai Formu Düzeltme İçin İade Edildi',
              message: returnMsg,
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
            title: 'Mesai Formu Düzeltme İçin İade Edildi',
            body: returnMsg,
          },
          mail: form.createdBy?.email
            ? {
                to: { email: form.createdBy.email, name: form.createdBy.name ?? form.createdBy.email },
                subject: `Mesai Formu Düzeltmeye İade — ${form.formNo}`,
                role: pendingApproval.role || 'Onaylayıcı',
                comment: String(comment),
                kind: 'RETURNED' as const,
              }
            : null,
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
          mail: form.createdBy?.email
            ? {
                to: { email: form.createdBy.email, name: form.createdBy.name ?? form.createdBy.email },
                subject: `Mesai Formu Reddedildi — ${form.formNo}`,
                role: pendingApproval.role || 'Onaylayıcı',
                comment: comment ? String(comment) : '',
                kind: 'REJECTED' as const,
              }
            : null,
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

    // Transaction sonrası mail (iade/red) — SMTP yan-etki tx DIŞINDA; hata akışı BOZMAZ.
    if (updatedForm.mail) {
      try {
        const m = updatedForm.mail
        const link = ileriHubUrl(`/forms/overtime/${id}`)
        const iade = m.kind === 'RETURNED'
        const baslik = iade ? 'Mesai Formu Düzeltme İçin İade Edildi' : 'Mesai Formu Reddedildi'
        const aksiyon = iade
          ? 'Formu düzenleyip yeniden onaya gönderebilirsiniz.'
          : 'Form reddedilmiştir. Gerekirse yeni bir form oluşturabilirsiniz.'
        const navy = '#1B4F72'
        const text = `${baslik}\n\n${m.role} tarafından${m.comment ? `: ${m.comment}` : ''}\n\n${aksiyon}\n${link}`
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;max-width:560px;overflow:hidden;">
      <tr><td style="background:${iade ? '#c98500' : '#d03b3b'};padding:16px 24px;color:#fff;font-size:17px;font-weight:bold;">${baslik}</td></tr>
      <tr><td style="padding:20px 24px;color:#333;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 8px;"><b>${m.role}</b> tarafından${iade ? ' düzeltme için iade edildi' : ' reddedildi'}.</p>
        ${m.comment ? `<div style="background:#f7f9fb;border-left:4px solid ${iade ? '#c98500' : '#d03b3b'};padding:10px 14px;margin:12px 0;color:#444;"><b>Açıklama:</b> ${m.comment}</div>` : ''}
        <p style="margin:8px 0 18px;">${aksiyon}</p>
        <a href="${link}" style="display:inline-block;background:${navy};color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Formu Görüntüle</a>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#f7f9fb;color:#999;font-size:11px;">Otomatik ILERIHub mesai onay bildirimi.</td></tr>
    </table>
  </td></tr></table></body></html>`
        await sendEmail([m.to], m.subject, text, html)
      } catch (e) {
        console.error('[overtime-approve] iade/red maili gönderilemedi (akış etkilenmedi):', e)
      }
    }

    return apiSuccess(updatedForm.result)
  } catch (error) {
    return apiError('Onay işlemi sırasında bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/[id]/approve',
      error,
    })
  }
}
