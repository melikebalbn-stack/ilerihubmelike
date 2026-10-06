// IV-FR-27 · İV yönlendirmesi sonrası AKIŞIN DEVAMI (saf karar — DB/oturum yok).
//
// NEDEN AYRI DOSYA: yonlendir ucu, değerlendiriciyi değiştirirken formun geri
// kalanını da tutarlı bırakmak zorunda. 2. adım için bu düzeltme vardı; 1. adım
// için YOKTU ve 06.10.2026'da canlıda kilit üretti:
//
//   ILR-01118 (BEYAZ, İdari İşler) · tek puanlı form, deg1 = bölüm müdürü (MUDUR)
//   → İV, 1. değerlendiriciyi başka bölümün müdür yardımcısına yönlendirdi
//   → rol, formun KENDİ bölümündeki koltuktan çözülür: TAKIM_LIDERI
//   → form hâlâ tek puanlı (deg2 NULL), ama matriste TAKIM_LIDERI yalnız YUKARI
//     devredebilir (MUDUR_YRD_BEKLIYOR / MUDUR_BEKLIYOR) → "Gönder" 400 verdi.
//
// Kural: 1. adımda hedef TAKIM_LIDERI çözülüyor ve formda 2. adım yoksa, 2. adım
// AÇILIR (müdür yrd. varsa o + onay müdürde; yoksa müdür, onay yok). Böylece
// takım lideri puanını verince akış yukarı yürür. Hedef müdür/müdür yrd. ise
// davranış DEĞİŞMEZ — o roller tek puanlı formu kendi başına kapatabiliyor.

import type { DenemeDurum, DenemeDegerlendiriciRol } from "@/generated/prisma";

export type YonlendirmeAkisGirdi = {
  sira: 1 | 2;
  /** Hedefin formun BÖLÜMÜNDEKİ kademesi (yonlendir ucu çözer). */
  rol: DenemeDegerlendiriciRol;
  durum: DenemeDurum;
  mevcutDeg2Id: string | null;
  mevcutOnaylayanId: string | null;
  mudurId: string | null;
  mudurYardimcisiId: string | null;
  /** Değerlendirilen kişi — kendisi değerlendirici/onaylayan olamaz. */
  personnelId: string;
  /** Yönlendirmenin hedefi — aynı kişi iki rolde olamaz. */
  hedefId: string;
};

export type YonlendirmeAkisSonuc = {
  durum: DenemeDurum;
  onaylayanId: string | null;
  /** 1. adımda tek puanlı formu akışa bağlamak için açılan 2. adım (yoksa null). */
  eklenenDeg2: { id: string; rol: DenemeDegerlendiriciRol } | null;
  /** Akış kurulamıyorsa sebep — uç 400 ile reddeder. */
  hata?: string;
};

/** Kişi, bu formda değerlendirici/onaylayan olabilir mi? */
function uygun(adayId: string | null, g: YonlendirmeAkisGirdi, haric: (string | null)[] = []): boolean {
  if (!adayId) return false;
  if (adayId === g.personnelId) return false; // kendini değerlendirme
  if (adayId === g.hedefId) return false; // aynı kişi iki rolde
  return !haric.includes(adayId);
}

export function yonlendirmeAkisDuzeltmesi(g: YonlendirmeAkisGirdi): YonlendirmeAkisSonuc {
  // ── 2. ADIM (DAVRANIŞ DEĞİŞMEDİ) ──
  //   · 2. puanı MÜDÜR verirse ayrı onay adımı YOKTUR → onaylayan NULL
  //   · 2. puanı MÜDÜR YRD. verirse bölüm müdürü onaylar
  if (g.sira === 2) {
    if (g.rol === "MUDUR") {
      return {
        durum: g.durum === "MUDUR_YRD_BEKLIYOR" ? "MUDUR_BEKLIYOR" : g.durum,
        onaylayanId: null,
        eklenenDeg2: null,
      };
    }
    const onaylayanId = uygun(g.mudurId, g) ? g.mudurId : null;
    return {
      durum: g.durum === "MUDUR_BEKLIYOR" && onaylayanId ? "MUDUR_YRD_BEKLIYOR" : g.durum,
      onaylayanId,
      eklenenDeg2: null,
    };
  }

  // ── 1. ADIM ──
  // Müdür / müdür yrd. hedefte: tek puanlı form kendi başına kapanabilir
  // (matriste MUDUR → ONAY/IK, MUDUR_YARDIMCISI → IK/MUDUR izinli). Dokunma.
  if (g.rol !== "TAKIM_LIDERI" || g.mevcutDeg2Id) {
    return { durum: g.durum, onaylayanId: g.mevcutOnaylayanId, eklenenDeg2: null };
  }

  // Takım lideri + 2. adım yok → 2. adımı AÇ ki akış yukarı yürüsün.
  if (uygun(g.mudurYardimcisiId, g)) {
    const onaylayanId = uygun(g.mudurId, g, [g.mudurYardimcisiId]) ? g.mudurId : null;
    return {
      durum: g.durum,
      onaylayanId,
      eklenenDeg2: { id: g.mudurYardimcisiId!, rol: "MUDUR_YARDIMCISI" },
    };
  }
  if (uygun(g.mudurId, g)) {
    // 2. puan müdürde bitiyor → ayrı onay adımı yok.
    return { durum: g.durum, onaylayanId: null, eklenenDeg2: { id: g.mudurId!, rol: "MUDUR" } };
  }

  // Ne müdür yrd. ne müdür kullanılabilir (atanmamış / pasif değil ama kişinin
  // kendisi ya da hedefin kendisi) → akış kurulamaz, yönlendirmeyi REDDET.
  // Sessizce geçmek formu yine kilitli bırakırdı (06.10 vakası).
  return {
    durum: g.durum,
    onaylayanId: g.mevcutOnaylayanId,
    eklenenDeg2: null,
    hata:
      "Hedef kişi bu bölümde müdür/müdür yardımcısı koltuğunda değil ve formda 2. değerlendirici adımı kurulamıyor (bölümün müdürü atanmamış ya da ilgili kişilerle çakışıyor). İnsan Varlıkları ile iletişime geçin.",
  };
}
