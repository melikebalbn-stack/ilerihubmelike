import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workstations/department-options
 * Tezgah CRUD dialog'undaki bölüm seçimi için HAFİF DepartmentDefinition listesi.
 * SADECE id, name. personnel-options ikizi — cross-gate çözümü: gate =
 * uretim.tezgah.manage (HR rolü gerektirmez). /api/settings/hr-departments'e dokunmaz.
 */
export async function GET(_request: NextRequest) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const departments = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return apiSuccess(departments)
  } catch (err) {
    return apiError('Bölüm listesi alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/workstations/department-options',
      error: err,
    })
  }
}
