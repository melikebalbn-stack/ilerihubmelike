// PR-C: İstihdam dönemlerinden kıdem/çalışma süresi hesabı.
// "Toplam çalışma süresi" = Σ (cikisTarihi ?? bugün − girisTarihi) — DÖNEM ARASI BOŞLUKLAR SAYILMAZ.
// Ay-farkı mantığı mevcut workingPeriod hesabı ile birebir (drift önler).
// Server (route) ve client (detay sayfası) tarafından ortak kullanılır — pure fonksiyonlar.

export interface TenurePeriodInput {
  girisTarihi: Date | string
  cikisTarihi: Date | string | null
}

export interface DurationParts {
  years: number
  months: number
  totalMonths: number
}

export interface TenureSummary extends DurationParts {
  firstEntryDate: string | null // ISO (yyyy-mm-dd), MIN(girisTarihi)
  periodCount: number
}

// Mevcut workingPeriod ile aynı ay-farkı: takvim ayı farkı, gün düzeltmeli, negatif → 0.
function monthsBetween(start: Date, end: Date): number {
  let m = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) m -= 1
  return m < 0 ? 0 : m
}

function toParts(totalMonths: number): DurationParts {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, totalMonths }
}

// Tek dönemin süresi (açık dönemde end = now). UI liste satırı için.
export function periodDuration(
  girisTarihi: Date | string,
  cikisTarihi: Date | string | null,
  now: Date = new Date()
): DurationParts {
  const start = new Date(girisTarihi)
  const end = cikisTarihi ? new Date(cikisTarihi) : now
  return toParts(monthsBetween(start, end))
}

// Tüm dönemlerden toplam kıdem + ilk giriş + dönem sayısı. DEĞER UYDURMAZ.
export function computeTenure(periods: TenurePeriodInput[], now: Date = new Date()): TenureSummary {
  if (!periods || periods.length === 0) {
    return { years: 0, months: 0, totalMonths: 0, firstEntryDate: null, periodCount: 0 }
  }
  let total = 0
  let firstEntry: Date | null = null
  for (const p of periods) {
    const start = new Date(p.girisTarihi)
    const end = p.cikisTarihi ? new Date(p.cikisTarihi) : now
    total += monthsBetween(start, end)
    if (!firstEntry || start < firstEntry) firstEntry = start
  }
  return {
    ...toParts(total),
    firstEntryDate: firstEntry ? firstEntry.toISOString().slice(0, 10) : null,
    periodCount: periods.length,
  }
}

// "2 yıl 3 ay" / "5 ay" / "0 ay" gibi insan-okur biçim (TR).
export function formatDuration(d: DurationParts): string {
  if (d.totalMonths <= 0) return "0 ay"
  const parts: string[] = []
  if (d.years > 0) parts.push(`${d.years} yıl`)
  if (d.months > 0) parts.push(`${d.months} ay`)
  return parts.join(" ")
}
