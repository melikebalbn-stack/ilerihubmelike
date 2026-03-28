import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response'

/**
 * GET: Sonraki mesai form numarasını oluştur
 * Format: OT-YYYY-NNN (örn: OT-2026-001)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

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
