import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound, apiBadRequest } from '@/lib/api-response'
import { requireUser } from '@/lib/auth/require-user'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: Test modu - Tüm onay adımlarını otomatik onayla
 *
 * Auth (PR-OVERTIME-TEST-FLAG):
 * - Kill switch: ENABLE_OVERTIME_TEST_APPROVE env flag (default: false)
 *   Production'da false → endpoint 503, auth check'e bile ulaşmaz
 * - SUPER_ADMIN role check (flag true ise)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Kill switch — auth'tan ÖNCE (backups restore pattern)
  if (process.env.ENABLE_OVERTIME_TEST_APPROVE !== 'true') {
    return NextResponse.json(
      { error: 'Bu endpoint production ortamında devre dışı.' },
      { status: 503 }
    )
  }

  try {
    // PR-Y2.5-overtime: requireUser — SUPER_ADMIN role check
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'SUPER_ADMIN') {
      return apiError('Bu işlem sadece Super Admin tarafından kullanılabilir', 403)
    }

    const { id } = await params

    const form = await prisma.overtimeForm.findUnique({
      where: { id },
      include: {
        approvals: { orderBy: { step: 'asc' } },
      },
    })

    if (!form) {
      return apiNotFound('Mesai formu bulunamadı')
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(form.status)) {
      return apiBadRequest('Bu form şu an onay sürecinde değil')
    }

    const now = new Date()

    // Son adım numarasını mevcut kayıtlardan belirle
    const lastStep = form.approvals.length > 0
      ? Math.max(...form.approvals.map((a) => a.step))
      : 0

    // Tüm bekleyen onayları onayla
    await prisma.$transaction(async (tx) => {
      await tx.overtimeApproval.updateMany({
        where: {
          overtimeFormId: id,
          decision: null,
        },
        data: {
          decision: 'APPROVED',
          approverId: user.id,
          decidedAt: now,
          comment: 'Test modu ile otomatik onaylandı',
        },
      })

      await tx.overtimeForm.update({
        where: { id },
        data: {
          status: 'APPROVED',
          currentStep: lastStep,
        },
      })

      // Form sahibine bildirim
      try {
        await tx.notification.create({
          data: {
            userId: form.createdById,
            title: 'Mesai Formu Onaylandı',
            message: `${form.formNo} numaralı mesai formunuz test modu ile onaylandı.`,
            type: 'REMINDER',
            link: `/forms/overtime/${id}`,
          },
        })
      } catch {
        // Bildirim oluşturulamazsa devam et
      }
    })

    return apiSuccess({ message: 'Tüm onaylar test modunda geçildi' })
  } catch (error) {
    return apiError('Test onay işlemi sırasında bir hata oluştu', 500, {
      endpoint: 'POST /api/overtime/[id]/test-approve-all',
      error,
    })
  }
}
