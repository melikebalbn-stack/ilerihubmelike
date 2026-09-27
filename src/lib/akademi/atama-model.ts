import { normalizeTr } from "@/lib/normalize-tr";

/**
 * Akademi Atamalar — SAF görünüm/hesap mantığı (test edilir). Prisma/DOM yok.
 * Veri modeli: CourseAssignment(container) + UserCourseAssignment + ayrı CourseProgress.
 * "Zorunlu" kurs alanı şemada YOK → kategori "Zorunlu" konvansiyonu (bkz. kursZorunluMu).
 */

export type YakaRengi = "MAVI" | "BEYAZ" | "GRI";
export type AtamaDurum = "BASLAMADI" | "DEVAM" | "BITTI" | "GECIKTI";

/** Kurs "zorunlu" mu? Şemada alan yok; kategori adı "zorunlu" ise zorunlu sayılır. */
export function kursZorunluMu(category: string | null | undefined): boolean {
  return normalizeTr(category ?? "") === "zorunlu";
}

/**
 * Bir kişinin bir kurstaki atama durumu. Tamamlandıysa BITTI; değilse son tarih
 * geçmişse GECIKTI (başlamamış/devam olsa bile); ilerleme varsa DEVAM; yoksa BASLAMADI.
 */
export function siniflandirDurum(
  input: { progressPercent: number; isCompleted: boolean; dueDate: string | Date | null | undefined },
  now: Date = new Date()
): AtamaDurum {
  if (input.isCompleted) return "BITTI";
  if (input.dueDate) {
    const d = new Date(input.dueDate);
    if (!isNaN(d.getTime()) && d < now) return "GECIKTI";
  }
  if (input.progressPercent > 0) return "DEVAM";
  return "BASLAMADI";
}

export const DURUM_ETIKET: Record<AtamaDurum, string> = {
  BASLAMADI: "Başlamadı",
  DEVAM: "Devam",
  BITTI: "Bitti",
  GECIKTI: "Gecikti",
};

// ─── KPI ────────────────────────────────────────────────────────────────
export type AtamaSatir = {
  dueDate: string | Date | null;
  isCompleted: boolean;
  courseId: string;
};

export type AtamaKpi = {
  atamaliKurs: number; // atama içeren kurs sayısı
  toplamAtama: number; // toplam kişi-kurs ataması
  gecikmis: number; // dueDate geçmiş & tamamlanmamış
  tamamlanmaYuzde: number; // tamamlanan / toplam
};

export function atamaKpiHesap(rows: AtamaSatir[], now: Date = new Date()): AtamaKpi {
  const kurslar = new Set<string>();
  let tamamlanan = 0;
  let gecikmis = 0;
  for (const r of rows) {
    kurslar.add(r.courseId);
    if (r.isCompleted) tamamlanan++;
    else if (r.dueDate) {
      const d = new Date(r.dueDate);
      if (!isNaN(d.getTime()) && d < now) gecikmis++;
    }
  }
  const toplam = rows.length;
  return {
    atamaliKurs: kurslar.size,
    toplamAtama: toplam,
    gecikmis,
    tamamlanmaYuzde: toplam === 0 ? 0 : Math.round((tamamlanan / toplam) * 100),
  };
}

// ─── Kurs araması (ad + kategori, normalizeTr) ───────────────────────────
export function kursAra<T extends { title: string; category?: string | null }>(
  courses: T[],
  query: string
): T[] {
  const q = normalizeTr(query.trim());
  if (!q) return courses;
  return courses.filter((c) => normalizeTr(`${c.title} ${c.category ?? ""}`).includes(q));
}

// ─── Önizleme hesabı (audience ∖ atanmış) ────────────────────────────────
export function previewHesap(
  audienceUserIds: string[],
  atanmisUserIds: string[]
): { atanacak: number; zatenAtanmis: number } {
  const atanmis = new Set(atanmisUserIds);
  const uniq = new Set(audienceUserIds);
  let zaten = 0;
  for (const u of uniq) if (atanmis.has(u)) zaten++;
  return { atanacak: uniq.size - zaten, zatenAtanmis: zaten };
}
