// İşe alım — maaş beklentisi doğrulama sınırları. TEK KAYNAK (client + sunucu aynı yerden okur).
//
// ASGARI_UCRET_NET_AYLIK_TL: aylık NET asgari ücret alt sınırı. 2025 net asgari ücret
//   ≈ 22.104 TL baz alındı. ⚠️ YILDA BİR GÜNCELLENMELİ (asgari ücret arttıkça). Amaç:
//   "60"/"80" gibi bin'i unutulmuş yazım hatalarını ve asgari-altı değerleri yakalamak.
//   (İdealde bir ayar/parametre tablosundan okunur; şimdilik tek sabit + yorum.)
export const ASGARI_UCRET_NET_AYLIK_TL = 22104

// Makul tavan — fazladan sıfır gibi yazım hatalarını yakalar.
export const MAKS_MAAS_BEKLENTI_TL = 1_000_000

export interface MaasKontrolSonuc {
  ok: boolean
  hata?: string
}

// Verilen değeri sınırlara göre doğrular. null/boş → range kontrolü YOK (zorunluluk ayrı
// katmanda — required-fields). Sağlanan değer sayı ve [asgari, tavan] aralığında olmalı.
export function maasBeklentisiGecerliMi(v: number | null | undefined): MaasKontrolSonuc {
  if (v === null || v === undefined) return { ok: true }
  if (!Number.isFinite(v) || !Number.isInteger(v)) {
    return { ok: false, hata: "Maaş beklentisi geçerli bir tam sayı olmalı." }
  }
  if (v < ASGARI_UCRET_NET_AYLIK_TL) {
    return {
      ok: false,
      hata: `Maaş beklentisi aylık net asgari ücretin (${ASGARI_UCRET_NET_AYLIK_TL.toLocaleString("tr-TR")} ₺) altında olamaz. Değeri tam TL olarak girin (örn. 45000).`,
    }
  }
  if (v > MAKS_MAAS_BEKLENTI_TL) {
    return { ok: false, hata: `Maaş beklentisi ${MAKS_MAAS_BEKLENTI_TL.toLocaleString("tr-TR")} ₺'yi aşamaz.` }
  }
  return { ok: true }
}
