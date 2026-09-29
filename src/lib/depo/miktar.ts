/**
 * Depo terminali miktar kuralı (istemci + sunucu ortak; server-only DEĞİL):
 * pozitif, virgül ya da nokta ondalık ayırıcı, en fazla 4 ondalık basamak.
 */
export const MIKTAR_ONDALIK = 4

/** Ekrandan girilen metin → sayı; geçersiz / boş → null. "0,5" ve "0.5" aynı. */
export function miktarOku(ham: string): number | null {
  const s = (ham ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Sayı en fazla 4 ondalık basamak mı (sunucu şeması için). */
export const ondalikUygun = (n: number) => Number.isFinite(n) && Math.abs(n * 1e4 - Math.round(n * 1e4)) < 1e-6

/** Tuş takımı girişi: rakam / ',' / '⌫'; ondalık 4 basamakla, toplam 12 karakterle sınırlı. */
export function miktarTusla(m: string, k: string): string {
  if (k === '⌫') return m.slice(0, -1)
  if (k === ',' || k === '.') return m.includes(',') ? m : m === '' ? '0,' : `${m},`
  const next = m === '0' ? k : m + k
  const ond = next.split(',')[1]
  if (ond && ond.length > MIKTAR_ONDALIK) return m
  return next.length > 12 ? m : next
}

/** Rezerve sınırı aşıldığında ortak mesaj. */
export const rezerveMesaji = (kullanilabilir: number, rezerve: number, birim = '', fiil = 'taşınabilir') =>
  `En fazla ${fmtMiktar(kullanilabilir)}${birim ? ` ${birim}` : ''} ${fiil} (${fmtMiktar(rezerve)} rezerve)`

export const fmtMiktar = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: MIKTAR_ONDALIK })
