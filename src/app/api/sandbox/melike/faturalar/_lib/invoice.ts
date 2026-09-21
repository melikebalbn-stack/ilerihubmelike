import { prisma } from '@/lib/prisma'
import { InvoiceCurrency } from '@/generated/prisma'
import { getRateForDate } from './tcmb'

export interface AllocationInput {
  departmentOrgUnitId: string
  percentage: number
}

export interface ResolvedDepartments {
  departmentOrgUnitId: string | null
  departmentName: string | null
  allocations: { departmentOrgUnitId: string; departmentName: string; percentage: number }[]
}

/**
 * Tek bölüm ya da yüzdeyle bölünmüş çoklu bölüm girdisini doğrular ve isimleri çözer. Hata varsa string mesaj döner.
 * Çoklu bölümde yüzdeler toplamı %100'ü GEÇEMEZ ama altında kalabilir — kalan kısım örtük "Genel" sayılır
 * (ayrı bir allocation satırı olarak saklanmaz; computeSummary tüm bölümlerin toplamı faturanın tam tutarını
 * tutturmadığında farkı otomatik "Genel" olarak ekler).
 */
export async function resolveDepartments(
  departmentOrgUnitId: string | null | undefined,
  allocations: AllocationInput[] | undefined
): Promise<ResolvedDepartments | string> {
  const hasAllocations = Array.isArray(allocations) && allocations.length >= 1

  if (hasAllocations) {
    const ids = allocations!.map((a) => a.departmentOrgUnitId)
    if (new Set(ids).size !== ids.length) return 'Aynı bölümü birden fazla kez seçemezsin'
    const pctSum = allocations!.reduce((s, a) => s + Number(a.percentage), 0)
    if (pctSum > 100.5) return 'Bölüm yüzdeleri toplamı %100\'ü geçemez'
    if (pctSum <= 0) return 'Geçerli bir yüzde gir'

    const depts = await prisma.departmentDefinition.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    if (depts.length !== ids.length) return 'Geçersiz bölüm seçimi'
    const nameById = new Map(depts.map((d) => [d.id, d.name]))
    return {
      departmentOrgUnitId: null,
      departmentName: null,
      allocations: allocations!.map((a) => ({
        departmentOrgUnitId: a.departmentOrgUnitId,
        departmentName: nameById.get(a.departmentOrgUnitId)!,
        percentage: Number(a.percentage),
      })),
    }
  }

  if (departmentOrgUnitId) {
    const dept = await prisma.departmentDefinition.findUnique({ where: { id: departmentOrgUnitId }, select: { name: true } })
    if (!dept) return 'Geçersiz bölüm'
    return { departmentOrgUnitId, departmentName: dept.name, allocations: [] }
  }

  return { departmentOrgUnitId: null, departmentName: null, allocations: [] }
}

export interface ComputedAmounts {
  exchangeRate: number
  amountTRY: number
  amountEUR: number
}

/** TCMB kuruna göre TL ve € karşılıklarını hesaplar (girilen para birimi ne olursa olsun). */
export async function computeAmounts(
  currency: InvoiceCurrency,
  amountNum: number,
  dateStr: string
): Promise<ComputedAmounts> {
  const tryRate = currency === 'TRY' ? 1 : (await getRateForDate(dateStr, currency)).rate
  const eurRate = currency === 'EUR' ? tryRate : (await getRateForDate(dateStr, 'EUR')).rate

  const amountTRY = currency === 'TRY' ? amountNum : amountNum * tryRate
  const amountEUR = currency === 'EUR' ? amountNum : amountTRY / eurRate

  return { exchangeRate: eurRate, amountTRY, amountEUR }
}
