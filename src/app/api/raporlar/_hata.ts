import { NextResponse } from 'next/server'
import { hataCevirNesne, hataOzeti, type CevrilmisHata, type HataBaglami } from '@/lib/rapor/hata-cevir'

/**
 * Rapor uçlarının ortak hata yanıtı: ham metin SUNUCU LOGUNDA kalır, istemciye çevrilmiş yapı gider.
 *
 * Gövde biçimi: { error, hata }
 *  - error: tek satırlık özet — eski istemciler ve loglar için (geriye dönük uyumluluk)
 *  - hata : { baslik, aciklama, cozum?, teknikDetay, agirlik } — ekranın gösterdiği yapı
 */
export function hataYaniti(e: unknown, baglam: HataBaglami = {}, durum = 400, etiket = 'rapor'): NextResponse {
  const h = hataCevirNesne(e, baglam)
  console.error(`[${etiket}] ${h.baslik} · ${h.teknikDetay.replace(/\s+/g, ' ').slice(0, 500)}`)
  return NextResponse.json({ error: hataOzeti(h), hata: h }, { status: durum })
}

/** Zaten çevrilmiş hatayı yanıta koyar (doğrulama gibi kendi mesajını üreten yerler). */
export function cevrilmisYanit(h: CevrilmisHata, durum = 400, ek: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error: hataOzeti(h), hata: h, ...ek }, { status: durum })
}
