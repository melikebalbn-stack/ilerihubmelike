// İşe alım — maaş beklentisi doğrulama sınırları. TEK KAYNAK (client + sunucu aynı yerden okur).
//
// ASGARI_UCRET_BRUT_AYLIK_TL: aylık BRÜT asgari ücret alt sınırı.
//   Yürürlük: 2026. 2026 brüt asgari ücret = 33.030,00 TL/ay (net 28.075,50 TL).
//   Kaynak: T.C. Çalışma ve Sosyal Güvenlik Bakanlığı (csgb.gov.tr), 1 Ocak 2026'dan geçerli.
//   ⚠️ Her yıl OCAK ayında güncellenmeli (asgari ücret arttıkça). Amaç: "60"/"80" gibi bin'i
//   unutulmuş yazım hatalarını ve asgari-altı (brüt) değerleri yakalamak.
export const ASGARI_UCRET_BRUT_AYLIK_TL = 33030

// Makul tavan — fazladan sıfır gibi yazım hatalarını yakalar.
export const MAKS_MAAS_BEKLENTI_TL = 1_000_000

export interface MaasKontrolSonuc {
  ok: boolean
  hata?: string
}

// Verilen değeri sınırlara göre doğrular. null/boş → range kontrolü YOK (zorunluluk ayrı
// katmanda — required-fields). Sağlanan değer sayı ve [asgari brüt, tavan] aralığında olmalı.
export function maasBeklentisiGecerliMi(v: number | null | undefined): MaasKontrolSonuc {
  if (v === null || v === undefined) return { ok: true }
  if (!Number.isFinite(v) || !Number.isInteger(v)) {
    return { ok: false, hata: "Maaş beklentisi geçerli bir tam sayı olmalı." }
  }
  if (v < ASGARI_UCRET_BRUT_AYLIK_TL) {
    return {
      ok: false,
      hata: `Maaş beklentisi aylık brüt asgari ücretin (${ASGARI_UCRET_BRUT_AYLIK_TL.toLocaleString("tr-TR")} ₺) altında olamaz. Değeri tam TL olarak girin (örn. 45000).`,
    }
  }
  if (v > MAKS_MAAS_BEKLENTI_TL) {
    return { ok: false, hata: `Maaş beklentisi ${MAKS_MAAS_BEKLENTI_TL.toLocaleString("tr-TR")} ₺'yi aşamaz.` }
  }
  return { ok: true }
}
