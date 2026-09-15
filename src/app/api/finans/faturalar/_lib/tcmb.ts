import { prisma } from '@/lib/prisma'
import { InvoiceCurrency } from '@/generated/prisma'

function parseTCMBXml(xmlText: string, currency: string): number | null {
  const regex = new RegExp(
    `<Currency[^>]*Kod="${currency}"[^>]*>[\\s\\S]*?<ForexBuying>([^<]*)</ForexBuying>[\\s\\S]*?</Currency>`
  )
  const match = xmlText.match(regex)
  if (!match || !match[1].trim()) return null
  return parseFloat(match[1].trim())
}

function tcmbUrlFor(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) return 'https://www.tcmb.gov.tr/kurlar/today.xml'

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`
}

// Hafta sonu/resmi tatil günlerinde TCMB yayın yapmaz; bulunana kadar geriye doğru dener
async function fetchFromTCMBWithFallback(
  date: Date,
  currency: string,
  maxLookback = 7
): Promise<{ rate: number; usedDate: Date } | null> {
  const d = new Date(date)
  for (let i = 0; i <= maxLookback; i++) {
    try {
      const response = await fetch(tcmbUrlFor(d), { headers: { 'User-Agent': 'ILERIHub/1.0' } })
      if (response.ok) {
        const xmlText = await response.text()
        const rate = parseTCMBXml(xmlText, currency)
        if (rate) return { rate, usedDate: new Date(d) }
      }
    } catch {
      // sıradaki güne düş
    }
    d.setDate(d.getDate() - 1)
  }
  return null
}

export type RateResult = { rate: number; usedDate: string; source: 'cache' | 'tcmb' }

/**
 * Verilen tarih için TCMB döviz alış kurunu getirir (TRY bazında).
 * Önce DB cache'e bakar, yoksa TCMB'den çeker ve cache'ler.
 */
export async function getRateForDate(dateStr: string, currency: InvoiceCurrency): Promise<RateResult> {
  if (currency === 'TRY') return { rate: 1, usedDate: dateStr, source: 'cache' }

  const date = new Date(dateStr)
  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

  const cached = await prisma.tcmbRateCache.findUnique({
    where: { date_currency: { date: dateOnly, currency } },
  })
  if (cached) {
    return { rate: Number(cached.rate), usedDate: dateStr, source: 'cache' }
  }

  const result = await fetchFromTCMBWithFallback(date, currency)
  if (!result) {
    throw new Error(`${currency} için TCMB kuru alınamadı (${dateStr} ve öncesi denendi)`)
  }

  await prisma.tcmbRateCache.upsert({
    where: { date_currency: { date: dateOnly, currency } },
    create: { date: dateOnly, currency, rate: result.rate },
    update: { rate: result.rate },
  })

  return { rate: result.rate, usedDate: result.usedDate.toISOString().split('T')[0], source: 'tcmb' }
}
