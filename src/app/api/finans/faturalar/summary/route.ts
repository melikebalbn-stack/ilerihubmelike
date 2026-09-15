import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'

const SISTEM_GELISTIRME_LABEL = 'Sistem Geliştirme Müdürlüğü'

// GET — Genel/Sistem Geliştirme başlık metrikleri + aylık dağılım (grafik) + tüm bölümlere göre kırılım
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const invoices = await prisma.invoice.findMany({
      select: { invoiceDate: true, amountEUR: true, amountTRY: true, departmentName: true },
    })

    let genel = 0
    let sistemGelistirme = 0
    const monthly = new Map<
      string,
      { genel: number; sistemGelistirme: number; toplamTRY: number; genelTRY: number; sistemGelistirmeTRY: number }
    >()
    const byDepartment = new Map<string, { eur: number; tl: number }>()

    for (const inv of invoices) {
      const eur = Number(inv.amountEUR)
      const tl = Number(inv.amountTRY)
      const label = inv.departmentName ?? 'Genel'

      const dept = byDepartment.get(label) ?? { eur: 0, tl: 0 }
      dept.eur += eur
      dept.tl += tl
      byDepartment.set(label, dept)

      const key = inv.invoiceDate.toISOString().slice(0, 7)
      if (!monthly.has(key)) {
        monthly.set(key, { genel: 0, sistemGelistirme: 0, toplamTRY: 0, genelTRY: 0, sistemGelistirmeTRY: 0 })
      }
      const bucket = monthly.get(key)!
      bucket.toplamTRY += tl

      if (label === SISTEM_GELISTIRME_LABEL) {
        sistemGelistirme += eur
        bucket.sistemGelistirme += eur
        bucket.sistemGelistirmeTRY += tl
      } else {
        genel += eur
        bucket.genel += eur
        bucket.genelTRY += tl
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
      endpoint: 'finans/faturalar/summary',
      error,
    })
  }
}
