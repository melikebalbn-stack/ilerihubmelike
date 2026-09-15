import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'

// GET — organizasyon şemasındaki Müdürlük seviyesi bölümler (fatura formu için seçim listesi)
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const departments = await prisma.orgUnit.findMany({
      where: { unitType: 'DEPARTMENT', level: 3 },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    })

    return apiSuccess({ departments })
  } catch (error) {
    return apiError('Bölüm listesi alınırken bir hata oluştu', 500, {
      endpoint: 'finans/faturalar/departments',
      error,
    })
  }
}
