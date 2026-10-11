/**
 * Sınav raporu — KİŞİ bazlı durum dağılımı.
 *
 * Eski rapor yalnız DENEME sayıyordu ("39/40 deneme, %97 geçme"): kaç kişiye
 * atandığı, kaçının hiç girmediği görünmüyordu. Burada her kişi tek bir
 * durumda sayılır, toplam = atanan ∪ deneyen.
 *
 * Durumlar:
 *   GECTI    en az bir COMPLETED deneme, passed = true
 *   KALDI    COMPLETED denemesi var, hiçbiri geçmemiş
 *   DEVAM    yalnız IN_PROGRESS / SUBMITTED / PENDING_REVIEW denemesi var
 *   BASLAMADI atanmış ama hiç denemesi yok (EXPIRED dışında)
 *
 * Atanmadan sınava giren kişi de sayılır (kursa atanmadan girilebiliyor);
 * aksi halde "geçen" sayısı atanandan büyük çıkıp tablo anlamsızlaşır.
 */

export type SinavKisiDurum = "GECTI" | "KALDI" | "DEVAM" | "BASLAMADI";

export type SinavDenemeGirdi = {
  userId: string;
  /** Prisma AttemptStatus */
  status: string;
  passed: boolean | null;
  score: number | null;
};

export type SinavKpi = {
  /** Sınavın kursuna atanmış tekil kişi sayısı */
  atanan: number;
  gecti: number;
  kaldi: number;
  devam: number;
  baslamadi: number;
  /** atanan ∪ deneyen — yüzdelerin paydası */
  kapsam: number;
  /** gecti / (gecti + kaldi) — denemesi tamamlanmış kişiler arasında */
  basariOrani: number | null;
  /** Tamamlanmış denemelerin ortalama puanı */
  ortPuan: number | null;
  /** Toplam deneme adedi (kişi değil) */
  toplamDeneme: number;
};

const TAMAMLANMIS = "COMPLETED";
const DEVAM_EDEN = new Set(["IN_PROGRESS", "SUBMITTED", "PENDING_REVIEW"]);

/** Bir kişinin tüm denemelerinden tek durum üretir. */
export function kisiDurumu(denemeler: SinavDenemeGirdi[]): SinavKisiDurum {
  const tamamlanan = denemeler.filter((d) => d.status === TAMAMLANMIS);
  if (tamamlanan.some((d) => d.passed === true)) return "GECTI";
  if (tamamlanan.length > 0) return "KALDI";
  if (denemeler.some((d) => DEVAM_EDEN.has(d.status))) return "DEVAM";
  return "BASLAMADI";
}

export function sinavKpiHesapla(
  atananUserIds: readonly string[],
  denemeler: readonly SinavDenemeGirdi[]
): SinavKpi {
  const kisiDenemeleri = new Map<string, SinavDenemeGirdi[]>();
  for (const d of denemeler) {
    const list = kisiDenemeleri.get(d.userId);
    if (list) list.push(d);
    else kisiDenemeleri.set(d.userId, [d]);
  }

  // Kapsam: atananlar + atanmadan girenler.
  const kapsamIds = new Set<string>(atananUserIds);
  for (const uid of kisiDenemeleri.keys()) kapsamIds.add(uid);

  let gecti = 0;
  let kaldi = 0;
  let devam = 0;
  let baslamadi = 0;
  for (const uid of kapsamIds) {
    switch (kisiDurumu(kisiDenemeleri.get(uid) ?? [])) {
      case "GECTI":
        gecti++;
        break;
      case "KALDI":
        kaldi++;
        break;
      case "DEVAM":
        devam++;
        break;
      default:
        baslamadi++;
    }
  }

  const tamamlananDenemeler = denemeler.filter(
    (d) => d.status === TAMAMLANMIS
  );
  const puanli = tamamlananDenemeler.filter((d) => d.score != null);

  return {
    atanan: new Set(atananUserIds).size,
    gecti,
    kaldi,
    devam,
    baslamadi,
    kapsam: kapsamIds.size,
    basariOrani:
      gecti + kaldi > 0 ? Math.round((gecti / (gecti + kaldi)) * 100) : null,
    ortPuan:
      puanli.length > 0
        ? Math.round(
            puanli.reduce((t, d) => t + (d.score ?? 0), 0) / puanli.length
          )
        : null,
    toplamDeneme: denemeler.length,
  };
}

/** Tekil sınav grafiği için puan dağılımı (10'luk kovalar). */
export function puanDagilimi(
  denemeler: readonly SinavDenemeGirdi[]
): { aralik: string; adet: number }[] {
  const kovalar = Array.from({ length: 10 }, (_, i) => ({
    aralik: `${i * 10}-${i * 10 + 9}`,
    adet: 0,
  }));
  kovalar[9].aralik = "90-100";
  for (const d of denemeler) {
    if (d.status !== TAMAMLANMIS || d.score == null) continue;
    const s = Math.max(0, Math.min(100, d.score));
    kovalar[Math.min(9, Math.floor(s / 10))].adet++;
  }
  return kovalar;
}
