import type { SplitBadgeColor } from "@/components/akademi/SplitBadge";

export type CourseCardInput = {
  id: string;
  title: string;
  thumbnail: string | null;
  category: string | null;
  duration: number | null; // dakika
  videoCount: number;
  examQuestionCount: number;
  progressPercent: number;
  isCompleted: boolean;
  dueDate: Date | string | null;
  assignedAt: Date | string | null;
};

export type CourseCardModel = {
  id: string;
  title: string;
  href: string;
  coverImage: string | null;
  coverGradient: string;
  durationLabel: string | null;
  metaLine: string;
  progressPercent: number;
  tag: { label: string; color: "red" | "green" | "orange" } | null;
  due: { label: string; warn: boolean } | null;
  badge: { color: SplitBadgeColor; left: string; right: string; href: string };
};

const TR_AY = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Dakika → "30 dk" | "1 sa 10 dk" | "2 sa". */
export function sureEtiketi(dakika: number | null): string | null {
  if (!dakika || dakika <= 0) return null;
  const sa = Math.floor(dakika / 60);
  const dk = dakika % 60;
  if (sa === 0) return `${dk} dk`;
  if (dk === 0) return `${sa} sa`;
  return `${sa} sa ${dk} dk`;
}

function gunFarki(due: Date, now: Date): number {
  const g = 86400000;
  const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d1 = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.round((d1 - d0) / g);
}

const KURS_URL = (id: string) => `/akademi/courses/${id}`;
const SERTIFIKA_URL = "/akademi/certificates";

/**
 * Kartın tüm görünüm kararlarını (saf, zamanı dışarıdan alır) üretir.
 * Test edilir: durum → rozet rengi eşlemesi (4 durum: Tamamlandı / son-tarih≤3 /
 * başlanmadı / devam eden).
 */
export function buildCourseCardModel(
  c: CourseCardInput,
  now: Date = new Date()
): CourseCardModel {
  const progress = Math.max(0, Math.min(100, Math.round(c.progressPercent)));
  const due = c.dueDate ? new Date(c.dueDate) : null;
  const assigned = c.assignedAt ? new Date(c.assignedAt) : null;
  const daysLeft = due ? gunFarki(due, now) : null;
  const isNew =
    !c.isCompleted && assigned
      ? gunFarki(now, assigned) >= -7 && assigned.getTime() <= now.getTime()
      : false;

  // Üst-sol etiket
  let tag: CourseCardModel["tag"] = null;
  if (c.isCompleted) tag = { label: "Tamamlandı", color: "green" };
  else if ((c.category ?? "").trim().toLocaleLowerCase("tr-TR") === "zorunlu")
    tag = { label: "Zorunlu", color: "red" };
  else if (isNew) tag = { label: "Yeni", color: "orange" };

  // Son tarih satırı
  let dueLine: CourseCardModel["due"] = null;
  if (c.isCompleted) dueLine = { label: "Sertifika hazır", warn: false };
  else if (due && daysLeft !== null) {
    if (daysLeft <= 3)
      dueLine = {
        label: daysLeft < 0 ? "Süresi geçti" : `Son tarih ${daysLeft} gün`,
        warn: true,
      };
    else
      dueLine = {
        label: `Son tarih ${due.getUTCDate()} ${TR_AY[due.getUTCMonth()]}`,
        warn: false,
      };
  }

  // Aksiyon rozeti (öncelik: tamamlandı > son-tarih≤3 > başlanmadı > devam eden)
  let badge: CourseCardModel["badge"];
  if (c.isCompleted)
    badge = { color: "green", left: "Tamamlandı", right: "Sertifika", href: SERTIFIKA_URL };
  else if (daysLeft !== null && daysLeft <= 3)
    badge = {
      color: "amber",
      left: daysLeft < 0 ? "Gecikti" : `${daysLeft} gün kaldı`,
      right: "Devam et",
      href: KURS_URL(c.id),
    };
  else if (progress === 0)
    badge = { color: "red", left: "Zorunlu", right: "Başla", href: KURS_URL(c.id) };
  else
    badge = { color: "blue", left: `%${progress}`, right: "Devam et", href: KURS_URL(c.id) };

  // Meta satırı — gerçek sayılar
  const parcalar = [c.category?.trim() || "Eğitim", `${c.videoCount} video`];
  if (c.examQuestionCount > 0) parcalar.push(`${c.examQuestionCount} soru sınav`);
  const metaLine = parcalar.join(" · ");

  return {
    id: c.id,
    title: c.title,
    href: KURS_URL(c.id),
    coverImage: c.thumbnail,
    coverGradient: "linear-gradient(135deg,#12325E,#12B5CB)",
    durationLabel: sureEtiketi(c.duration),
    metaLine,
    progressPercent: progress,
    tag,
    due: dueLine,
    badge,
  };
}
