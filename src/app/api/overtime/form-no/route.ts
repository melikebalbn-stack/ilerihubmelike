import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth/require-session'

/**
 * GET: Sonraki mesai form numarasını oluştur
 * Format: OT-YYYY-NNN (örn: OT-2026-001)
 */
export async function GET() {
  try {
    // PR-Y2.5-overtime: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const year = new Date().getFullYear()
    const prefix = `OT-${year}-`

    const lastForm = await prisma.overtimeForm.findFirst({
      where: { formNo: { startsWith: prefix } },
      orderBy: { formNo: 'desc' },
      select: { formNo: true },
    })

    let nextNumber = 1
    if (lastForm) {
      const lastNumber = parseInt(lastForm.formNo.split('-').pop() || '0')
      nextNumber = lastNumber + 1
    }

    const formNo = `${prefix}${nextNumber.toString().padStart(3, '0')}`

    return apiSuccess({ formNo })
  } catch (error) {
    return apiError('Form numarası oluşturulurken bir hata oluştu', 500, {
      endpoint: 'GET /api/overtime/form-no',
      error,
    })
  }
}
