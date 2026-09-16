import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

const SISTEM_GELISTIRME_LABEL = 'Sistem Geliştirme Müdürlüğü'

// GET — Genel/Sistem Geliştirme başlık metrikleri + aylık dağılım (grafik) + tüm bölümlere göre kırılım
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

    // Her faturayı bölüm(ler)ine göre parçalara ayır (çoklu bölümlü faturalar %'ye göre bölünür)
    const parts = invoices.flatMap((inv) => {
      if (inv.allocations.length > 0) {
        return inv.allocations.map((a) => ({
          invoiceDate: inv.invoiceDate,
          label: a.departmentName,
          eur: Number(a.amountEUR),
          tl: Number(a.amountTRY),
        }))
      }
      return [
        {
          invoiceDate: inv.invoiceDate,
          label: inv.departmentName ?? 'Genel',
          eur: Number(inv.amountEUR),
          tl: Number(inv.amountTRY),
        },
      ]
    })

    let genel = 0
    let sistemGelistirme = 0
    const monthly = new Map<
      string,
      { genel: number; sistemGelistirme: number; toplamTRY: number; genelTRY: number; sistemGelistirmeTRY: number }
    >()
    const byDepartment = new Map<string, { eur: number; tl: number }>()

    for (const part of parts) {
      const dept = byDepartment.get(part.label) ?? { eur: 0, tl: 0 }
      dept.eur += part.eur
      dept.tl += part.tl
      byDepartment.set(part.label, dept)

      const key = part.invoiceDate.toISOString().slice(0, 7)
      if (!monthly.has(key)) {
        monthly.set(key, { genel: 0, sistemGelistirme: 0, toplamTRY: 0, genelTRY: 0, sistemGelistirmeTRY: 0 })
      }
      const bucket = monthly.get(key)!
      bucket.toplamTRY += part.tl

      if (part.label === SISTEM_GELISTIRME_LABEL) {
        sistemGelistirme += part.eur
        bucket.sistemGelistirme += part.eur
        bucket.sistemGelistirmeTRY += part.tl
      } else {
        genel += part.eur
        bucket.genel += part.eur
        bucket.genelTRY += part.tl
      }
    }

    const toplam = genel + sistemGelistirme
    const oran = toplam > 0 ? (sistemGelistirme / toplam) * 100 : 0

    const months = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }))

    const departments = Array.from(byDepartment.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.eur - a.eur)

    return apiSuccess({
      totals: { genel, sistemGelistirme, toplam, oran },
      months,
      departments,
    })
  } catch (error) {
    return apiError('Özet alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/summary',
      error,
    })
  }
}
