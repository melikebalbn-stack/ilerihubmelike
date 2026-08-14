/**
 * İşe alım metrikleri — KÜÇÜK ÖRNEKLEM EŞİĞİ. TEK KAYNAK.
 *
 * Desen kaynağı: IT destek KPI panosu (`it-support/_components/kpi-dashboard.tsx` →
 * `ornekNotu()` + `api/tickets/reports` → `respondedCount/resolvedCountForAvg/ratedCount`).
 * Oradaki iki ilke aynen alındı:
 *   1) Ortalama, veri yokken 0 döner ve bu "gerçekten 0" ile karışır → 0 kayıtta değer
 *      HİÇ gösterilmez.
 *   2) Ortalamanın kaç kayıttan hesaplandığı SUNUCUDAN taşınır; client tahmin etmez.
 *
 * BURADA BİR FARK VAR (bilinçli): IT panosunda n<3'te değer gösterilip uyarı düşülüyor.
 * İşe alımda değer <MIN_ORNEK iken HİÇ DÖNMEZ. Gerekçe MAHREMİYET: bu modülde örneklem
 * kişi demek — 2026-08 ölçümünde "işe alınan" n=1'di, yani "ortalama işe alım süresi"
 * rakamı doğrudan TEK bir adayın süreç süresiydi. Bir kişilik ortalama istatistik değil,
 * kişi bazlı ifşadır. Aynısı pozisyon bazlı ortalamalar için de geçerli (13 pozisyonun
 * hepsi n=1).
 *
 * KAPSAM: yalnız ORTALAMA / TÜRETİLMİŞ metrikler (ortTimeToHire, ortTimeToFill,
 * costPerHire ve pozisyon bazlı ortalamalar). HAM SAYIMLAR (toplam başvuru, huni adetleri,
 * ret sayısı, toplam maliyet) bu eşikten ETKİLENMEZ — onlar ortalama değil.
 */

/** Ortalamanın gösterilebilmesi için gereken en az kayıt sayısı. Tek yer burası. */
export const MIN_ORNEK = 3;

export type OrnekliDeger = {
  /** Eşiğin altındaysa null — client "—" basar, yanıltıcı sayı görünmez. */
  deger: number | null;
  /** Ortalamanın hesaplandığı kayıt sayısı (her zaman dolu, dürüstlük için). */
  ornek: number;
  /** Kullanıcıya gösterilecek açıklama; eşik sağlanıyorsa "N kayıt". */
  not: string;
};

/**
 * Ortalama/türetilmiş bir metriği örneklem sayısıyla birlikte paketler.
 * `deger` zaten null ise (hesaplanamadı) örneklem ne olursa olsun null kalır.
 */
export function ornekliDeger(deger: number | null, ornek: number): OrnekliDeger {
  if (ornek === 0) return { deger: null, ornek: 0, not: "Henüz veri yok" };
  if (ornek < MIN_ORNEK) {
    return { deger: null, ornek, not: `yalnız ${ornek} kayıttan hesaplandı — gösterilmiyor` };
  }
  return { deger, ornek, not: `${ornek} kayıt` };
}
