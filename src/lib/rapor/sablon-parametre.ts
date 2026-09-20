/**
 * Şablon parametrelerini (SablonIcerik.parametreler) ham istek değerlerinden tipli değerlere çevirir.
 * calistir ve onizle uçları ortak kullanır. Zorunlu eksik / geçersiz → Türkçe hata listesi.
 */
import type { SablonIcerik } from './tipler'

export function parametreleriHazirla(icerik: SablonIcerik, ham: Record<string, unknown>): { degerler: Record<string, unknown>; hatalar: string[] } {
  const degerler: Record<string, unknown> = {}
  const hatalar: string[] = []
  for (const p of icerik.parametreler ?? []) {
    const v = ham[p.ad]
    const bos = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    if (bos) {
      if (p.zorunlu) hatalar.push(`'${p.etiket}' zorunludur`)
      continue
    }
    switch (p.tip) {
      case 'sayi': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) { hatalar.push(`'${p.etiket}' sayı olmalı`); continue }
        degerler[p.ad] = n
        break
      }
      case 'tarih': {
        const d = v instanceof Date ? v : new Date(String(v))
        if (Number.isNaN(d.getTime())) { hatalar.push(`'${p.etiket}' geçerli bir tarih olmalı`); continue }
        degerler[p.ad] = d
        break
      }
      default:
        degerler[p.ad] = typeof v === 'string' ? v.trim() : String(v)
    }
  }
  return { degerler, hatalar }
}
