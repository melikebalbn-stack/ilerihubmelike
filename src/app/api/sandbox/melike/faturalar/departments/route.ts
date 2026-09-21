import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// GET — personel listesindeki gerçek bölümler (DepartmentDefinition; fatura formu için seçim listesi)
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const departments = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    return apiSuccess({ departments })
  } catch (error) {
    return apiError('Bölüm listesi alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/departments',
      error,
    })
  }
}
