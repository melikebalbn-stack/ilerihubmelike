import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// GET — personel listesindeki gerçek bölümler (Personnel.bolum, distinct; fatura formu için seçim listesi)
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const rows = await prisma.personnel.findMany({
      where: { aktif: true, bolum: { not: '' } },
      select: { bolum: true },
      distinct: ['bolum'],
    })

    const departments = rows
      .map((r) => ({ id: r.bolum, name: r.bolum }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    return apiSuccess({ departments })
  } catch (error) {
    return apiError('Bölüm listesi alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/departments',
      error,
    })
  }
}
