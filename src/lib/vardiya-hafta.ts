import { getISOWeek, getISOWeekYear, startOfISOWeek, addDays, format } from "date-fns"
import { tr } from "date-fns/locale"

// Vardiya Hafta Modu — ISO hafta biçimlendirme (tek kaynak: form UI + detay/liste gösterim + mail).
// Hafta = Pazartesi-Cuma (5 gece). date = haftanın Pazartesi'si (ISO week Monday).

/** "YYYY-MM-DD" veya Date/ISO → yerel (TZ-kaymasız) Date. @db.Date değerleri gün-bazlı. */
function toLocalDate(date: Date | string): Date {
  if (date instanceof Date) return date
  const s = String(date).slice(0, 10) // YYYY-MM-DD kısmı (ISO time kısmını at → TZ kayması yok)
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/**
 * "2026 - 38. Hafta (14-18 Temmuz)" — ay tam yazılır, ay değişen haftada
 * "28 Temmuz - 1 Ağustos". withYear=false → "38. Hafta (14-18 Temmuz)" (liste için).
 */
export function formatVardiyaHafta(date: Date | string, opts?: { withYear?: boolean }): string {
  const d = toLocalDate(date)
  const monday = startOfISOWeek(d) // ISO: Pazartesi
  const friday = addDays(monday, 4) // Pzt-Cuma (5 gece)
  const weekNo = getISOWeek(d)
  const year = getISOWeekYear(d)
  const sameMonth = monday.getMonth() === friday.getMonth()
  const aralik = sameMonth
    ? `${format(monday, "d", { locale: tr })}-${format(friday, "d MMMM", { locale: tr })}`
    : `${format(monday, "d MMMM", { locale: tr })} - ${format(friday, "d MMMM", { locale: tr })}`
  const prefix = opts?.withYear === false ? "" : `${year} - `
  return `${prefix}${weekNo}. Hafta (${aralik})`
}

/** Bu hafta + ileri (count-1) hafta → seçenek listesi. value = o Pazartesi (YYYY-MM-DD). Geçmiş YOK. */
export function getVardiyaHaftaOptions(count = 5): { value: string; label: string }[] {
  const thisMonday = startOfISOWeek(new Date())
  const opts: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const monday = addDays(thisMonday, i * 7)
    opts.push({ value: format(monday, "yyyy-MM-dd"), label: formatVardiyaHafta(monday) })
  }
  return opts
}
