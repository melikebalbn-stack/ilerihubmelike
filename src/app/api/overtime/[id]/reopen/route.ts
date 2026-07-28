import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: Reddedilmiş (REJECTED) mesai formunu yeniden düzenlemeye aç.
 * Onaycı "Reddet" (terminal) yerine "Düzeltme Gönder" (RETURNED→DRAFT) demek isteyip
 * karıştırınca form kilitleniyordu. Bu uç, RETURNED'ün yaptığının aynısını yapar:
 * status DRAFT + currentStep 0 → oluşturan tekrar düzenleyip gönderebilir.
 * Bayat onaylara DOKUNULMAZ — form yeniden gönderilince submit route onları siler.
 *
 * Yetki: yalnız forms.admin. Yalnız REJECTED form kabul edilir.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error

    const isAdmin = session.user.permissions?.includes('forms.admin') ?? false
    if (!isAdmin) {
      return apiError('Bu işlem için yetkiniz yok (forms.admin gerekli)', 403)
    }

    const { id } = await params
    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!form) return apiNotFound('Mesai formu bulunamadı')

    // Yalnız reddedilmiş formlar yeniden açılabilir (DRAFT/PENDING/APPROVED no-op).
    if (form.status !== 'REJECTED') {
      return apiBadRequest('Sadece reddedilmiş formlar yeniden açılabilir')
    }

    await prisma.overtimeForm.update({
      where: { id },
      data: { status: 'DRAFT', currentStep: 0 },
    })

    // Audit (best-effort) — kim reddedileni yeniden açtı.
    await logAuditEvent({
      action: 'OVERTIME_REOPENED',
      actorId: user.id,
      targetType: 'OVERTIME_FORM',
      targetId: id,
      details: { eskiStatus: 'REJECTED' },
    })

    return apiSuccess({ id, status: 'DRAFT' })
  } catch (e) {
    console.error('Mesai formu yeniden açılırken hata:', e)
    return apiError('Mesai formu yeniden açılırken bir hata oluştu', 500)
  }
}
