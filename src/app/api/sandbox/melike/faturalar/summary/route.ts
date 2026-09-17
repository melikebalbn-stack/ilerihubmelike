import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'
import { computeSummary } from '../_lib/summary'

// GET — Genel/Sistem Geliştirme başlık metrikleri + aylık dağılım (grafik + tam bölüm kırılımı) + tüm zamanlar bölüm kırılımı
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const invoices = await prisma.invoice.findMany({
      select: {
        invoiceDate: true,
        amountEUR: true,
        amountTRY: true,
        departmentName: true,
        allocations: { select: { departmentName: true, amountEUR: true, amountTRY: true } },
      },
    })

    return apiSuccess(computeSummary(invoices))
  } catch (error) {
    return apiError('Özet alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/summary',
      error,
    })
  }
}
