import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

type Decimal = Prisma.Decimal

export interface CostCalculationResult {
  materialCost: number
  laborCost: number
  externalCost: number
  otherCost: number
  subtotal: number
  overheadAmount: number
  totalCost: number
  profitAmount: number
  salesPrice: number
  pricePerKg: number
}

/**
 * Bir maliyet analizinin tüm maliyetlerini yeniden hesaplar ve veritabanını günceller
 */
export async function recalculateCosts(analysisId: string): Promise<CostCalculationResult | null> {
  try {
    // Analizi ve tüm alt kayıtları al
    const analysis = await prisma.costAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        materials: true,
        laborItems: true,
        externalServices: true,
        otherCosts: true,
      },
    })

    if (!analysis) {
      return null
    }

    // 1. Malzeme toplamı
    const materialCost = analysis.materials.reduce((sum, m) => {
      return sum + m.totalPrice.toNumber()
    }, 0)

    // 2. İşçilik toplamı (sadece dahili)
    const laborCost = analysis.laborItems
      .filter((l) => l.laborType === 'INTERNAL' || l.laborType === 'ASSEMBLY')
      .reduce((sum, l) => {
        return sum + l.totalCost.toNumber()
      }, 0)

    // 3. Dış hizmet toplamı (işçilik external + externalServices)
    const externalLaborCost = analysis.laborItems
      .filter((l) => l.laborType === 'EXTERNAL')
      .reduce((sum, l) => {
        return sum + l.totalCost.toNumber()
      }, 0)

    const externalServiceCost = analysis.externalServices.reduce((sum, s) => {
      return sum + s.totalPrice.toNumber()
    }, 0)

    const externalCost = externalLaborCost + externalServiceCost

    // 4. Diğer maliyetler toplamı
    const otherCost = analysis.otherCosts.reduce((sum, o) => {
      return sum + o.totalPrice.toNumber()
    }, 0)

    // 5. Ara toplam
    const subtotal = materialCost + laborCost + externalCost + otherCost

    // 6. İşletme gideri
    const overheadRate = analysis.overheadRate.toNumber()
    const overheadAmount = subtotal * (overheadRate / 100)

    // 7. Toplam maliyet
    const totalCost = subtotal + overheadAmount

    // 8. Kar
    const profitRate = analysis.profitRate.toNumber()
    const profitAmount = totalCost * (profitRate / 100)

    // 9. Satış fiyatı
    const salesPrice = totalCost + profitAmount

    // 10. kg başına fiyat
    const finishedWeight = analysis.finishedWeight.toNumber()
    const pricePerKg = finishedWeight > 0 ? salesPrice / finishedWeight : 0

    // Veritabanını güncelle
    await prisma.costAnalysis.update({
      where: { id: analysisId },
      data: {
        materialCost,
        laborCost,
        externalCost,
        otherCost,
        subtotal,
        overheadAmount,
        totalCost,
        profitAmount,
        salesPrice,
        pricePerKg,
      },
    })

    return {
      materialCost,
      laborCost,
      externalCost,
      otherCost,
      subtotal,
      overheadAmount,
      totalCost,
      profitAmount,
      salesPrice,
      pricePerKg,
    }
  } catch (error) {
    console.error('Maliyet hesaplanırken hata:', error)
    throw error
  }
}

/**
 * Malzeme satırı hesaplama
 */
export function calculateMaterialRow(
  grossQuantity: number,
  wasteRate: number,
  unitPrice: number
): { netQuantity: number; totalPrice: number } {
  const netQuantity = grossQuantity * (1 + wasteRate / 100)
  const totalPrice = netQuantity * unitPrice
  return { netQuantity, totalPrice }
}

/**
 * İşçilik satırı hesaplama
 */
export function calculateLaborRow(
  setupTime: number,
  processTime: number,
  hourlyRate: number
): { totalTime: number; totalCost: number } {
  const totalTime = setupTime + processTime
  const totalCost = totalTime * hourlyRate
  return { totalTime, totalCost }
}

/**
 * Kar oranından satış fiyatı hesapla
 */
export function calculateSalesPriceFromProfit(
  totalCost: number,
  profitRate: number
): number {
  return totalCost * (1 + profitRate / 100)
}

/**
 * Satış fiyatından kar oranı hesapla
 */
export function calculateProfitRateFromPrice(
  totalCost: number,
  salesPrice: number
): number {
  if (totalCost === 0) return 0
  return ((salesPrice - totalCost) / totalCost) * 100
}

/**
 * Para birimi formatla
 */
export function formatCurrency(
  amount: number | Decimal,
  currency: string = 'EUR',
  locale: string = 'tr-TR'
): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber()

  const currencyMap: Record<string, string> = {
    TRY: 'TRY',
    EUR: 'EUR',
    USD: 'USD',
    GBP: 'GBP',
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyMap[currency] || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Yüzde formatla
 */
export function formatPercentage(value: number | Decimal): string {
  const numValue = typeof value === 'number' ? value : value.toNumber()
  return `%${numValue.toFixed(1)}`
}
