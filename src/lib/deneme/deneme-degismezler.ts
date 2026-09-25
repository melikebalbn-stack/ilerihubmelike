// IV-FR-27 · Deneme Değerlendirme — değerlendirici atamasının DEĞİŞMEZLERİ.
//
// NEDEN AYRI DOSYA: bu kurallar eskiden yalnız deneme-zincir.ts içinde, form
// AÇILIŞ anında uygulanıyordu. Değerlendiriciyi sonradan değiştiren her yol
// (İV yönlendirmesi, elle SQL) kuralı ATLIYORDU — 25.09.2026'da tam olarak bu
// oldu: yönlendirme istenen kişi formun 2. değerlendiricisiydi, düz uygulansa
// aynı kişi iki puan verecekti. Kurallar saf fonksiyona çıkarıldı ki hem zincir
// kurulurken hem de atama DEĞİŞTİRİLİRKEN aynı kapı işlesin.
//
// SAF: DB'ye, isteğe, oturuma bakmaz. Yalnız id'ler üzerinde karar verir —
// böylece hem sunucu ucundan hem zincir çözücüsünden çağrılabilir ve birim
// testi kurulum gerektirmez.

/** Değişmezlerin bakacağı asgari atama. null = o adım yok (tek puanlı yakalar). */
export type DegerlendiriciAtamasi = {
  /** Değerlendirilen personelin id'si. */
  personnelId: string;
  degerlendirici1Id: string | null;
  degerlendirici2Id: string | null;
};

export type DegismezSonuc = { ok: true } | { ok: false; sebep: string };

/**
 * Metinler SABİT tutulur: zincir çözücüsünün eski satır içi kontrolüyle birebir
 * aynı cümle döner, böylece İV'ye giden "zincir çözülemedi" bildirimleri ve
 * mevcut testler değişmez.
 */
export const AYNI_DEGERLENDIRICI_SEBEP =
  "1. ve 2. değerlendirici aynı kişiye düşüyor — iki ayrı puan verilemez.";

export const KENDINI_DEGERLENDIRME_SEBEP =
  "Değerlendirici, değerlendirilen kişinin kendisi olamaz.";

/**
 * İki değişmez:
 *   1) 1. ve 2. değerlendirici aynı kişi olamaz — çift puanı tek kişi veremez,
 *      aksi hâlde `ortalama` tek kişinin iki puanından hesaplanır ve onay adımı
 *      anlamını yitirir.
 *   2) Değerlendirici, değerlendirilen kişinin kendisi olamaz.
 *
 * FAIL-CLOSED: şüpheli atamada `ok:false` döner; çağıran işlemi durdurur.
 */
export function degerlendiriciAtamasiGecerliMi(a: DegerlendiriciAtamasi): DegismezSonuc {
  const { personnelId, degerlendirici1Id, degerlendirici2Id } = a;

  if (degerlendirici1Id && degerlendirici2Id && degerlendirici1Id === degerlendirici2Id) {
    return { ok: false, sebep: AYNI_DEGERLENDIRICI_SEBEP };
  }
  if (degerlendirici1Id === personnelId || degerlendirici2Id === personnelId) {
    return { ok: false, sebep: KENDINI_DEGERLENDIRME_SEBEP };
  }
  return { ok: true };
}
