/**
 * MAS MES datetime düzeltmesi. SAF FONKSİYON (server-only DEĞİL, DB'siz test edilebilir).
 *
 * SORUN: MAS MSSQL `datetime` timezone'suzdur ve İstanbul YEREL duvar saatini tutar. `mssql`/tedious
 * varsayılan `useUTC:true` ile bu ham değeri UTC sanıp Date'e "yanlış UTC etiketiyle" koyar — yani
 * dönen Date'in UTC bileşenleri (getUTCHours vb.) = MAS yerel duvar saati, epoch'u ise o duvar saatinin
 * UTC olarak yorumu. Sonuç: gerçek andan zone offset'i kadar (İstanbul +3s) İLERİ.
 *
 * ÇÖZÜM: Date'in UTC bileşenlerini `MAS_TZ` (IANA, default Europe/Istanbul) YEREL zamanı kabul edip
 * doğru UTC anına çevir. SABİT -3 YOK — offset IANA zone'undan (DST dahil) çözülür.
 */

/** MAS kaynak timezone'u (IANA). Prod İstanbul; test/başka kurulum env ile değişebilir. */
export function masTimeZone(): string {
  const z = (process.env.MAS_TZ ?? '').trim()
  return z || 'Europe/Istanbul'
}

/**
 * Bir UTC anının verilen IANA zone'daki offset'i (ms). Doğu (İstanbul) için POZİTİF (+3s = +10800000).
 * offset = (yerel duvar saatinin UTC olarak yorumu) - (gerçek epoch).
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const m: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value
  let hour = Number(m.hour)
  if (hour === 24) hour = 0 // bazı ortamlarda gece yarısı '24' döner
  const wallAsUtc = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), hour, Number(m.minute), Number(m.second))
  // formatToParts saliseyi düşürür; offset her IANA zone'da tam DAKİKA katıdır → yuvarla, salise
  // gürültüsünü ele (yoksa sub-saniye sapma + iki-geçiş birikir). Salise `masTarih`'te korunur.
  return Math.round((wallAsUtc - instant.getTime()) / 60_000) * 60_000
}

/**
 * Sürücüden gelen "yanlış UTC etiketli" MAS Date'ini doğru UTC anına çevirir.
 * Date'in UTC bileşenleri = MAS yerel duvar saati kabul edilir; o duvar saati `MAS_TZ`'de hangi UTC
 * anına denk geliyorsa o döner. DST kenarları için iki-geçişli sabit nokta (offset yerel saate bağlı).
 * null → null.
 */
export function masTarih(d: Date | null | undefined, timeZone: string = masTimeZone()): Date | null {
  if (d == null) return null
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  // Date'in epoch'u = "duvar saatinin UTC olarak yorumu" (naiveEpoch). Aranan: naiveEpoch - offset(gerçekUTC).
  const naiveEpoch = t
  const off1 = zoneOffsetMs(new Date(naiveEpoch), timeZone)
  let aday = naiveEpoch - off1
  const off2 = zoneOffsetMs(new Date(aday), timeZone)
  if (off2 !== off1) aday = naiveEpoch - off2 // DST geçişinde offset değiştiyse düzelt
  return new Date(aday)
}
