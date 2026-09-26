import type { SplitBadgeColor } from "@/components/akademi/SplitBadge";

export type ExamUserStatus = {
  canStart: boolean;
  passed?: boolean;
  passedScore?: number | null;
  hasInProgress: boolean;
  inProgressAttemptId: string | null;
  usedAttempts: number;
  remainingAttempts: number;
  lastResult: {
    attemptId: string;
    score: number | null;
    passed: boolean | null;
    status: string;
    completedAt: string | null;
  } | null;
};

export type ExamCardInput = {
  id: string;
  title: string;
  passingScore: number;
  timeLimit: number | null;
  maxAttempts: number;
  questionCount: number;
  course: { id: string; title: string } | null;
  userStatus: ExamUserStatus;
};

export type ExamCardModel = {
  id: string;
  title: string;
  href: string; // kart tıklaması
  coverGradient: string;
  tag: { label: string; color: "green" | "red" | "gray" | "amber" } | null;
  durationBadge: string;
  metaLine: string;
  lastScore: { label: string; passed: boolean } | null;
  footerLeft: string;
  badge: { color: SplitBadgeColor; left: string; right: string; href: string };
};

const EXAM_URL = (id: string) => `/akademi/exams/${id}`;
const TAKE_URL = (id: string) => `/akademi/exams/${id}/take`;
const RESULT_URL = (id: string, attemptId: string) =>
  `/akademi/exams/${id}/result/${attemptId}`;
const COURSE_URL = (id: string) => `/akademi/courses/${id}`;

/**
 * Sınav kartının görünüm kararları (saf, test edilir). Sınava girme koşulu
 * (userStatus.canStart) API'den gelir; burada değiştirilmez, yalnız gösterilir.
 */
export function buildExamCardModel(e: ExamCardInput): ExamCardModel {
  const us = e.userStatus;
  const lr = us.lastResult;
  const lrScore = lr?.score != null ? Math.round(lr.score) : null;

  // Kapak sağ-alt rozeti
  const durationBadge = e.timeLimit
    ? `${e.questionCount} soru · ${e.timeLimit} dk`
    : `${e.questionCount} soru`;

  // Meta satırı
  const parcalar: string[] = [];
  if (e.course?.title) parcalar.push(e.course.title);
  parcalar.push(`Geçme %${e.passingScore}`);
  parcalar.push(`Deneme ${us.usedAttempts}/${e.maxAttempts}`);
  const metaLine = parcalar.join(" · ");

  // Son deneme puanı rozeti
  const lastScore =
    lr && lrScore != null
      ? { label: `Son: %${lrScore}`, passed: !!lr.passed }
      : null;

  // Durum → etiket + rozet (öncelik sırası)
  let tag: ExamCardModel["tag"] = null;
  let badge: ExamCardModel["badge"];
  let footerLeft = "";

  if (us.hasInProgress) {
    tag = { label: "Bekliyor", color: "amber" };
    badge = {
      color: "amber",
      left: "Devam ediyor",
      right: "Devam Et",
      href: TAKE_URL(e.id),
    };
    footerLeft = "Sınav sürüyor";
  } else if (us.passed) {
    tag = { label: "Geçti", color: "green" };
    badge = {
      color: "green",
      left: "Geçti",
      right: "Sonucu Gör",
      href: lr ? RESULT_URL(e.id, lr.attemptId) : EXAM_URL(e.id),
    };
    footerLeft =
      us.passedScore != null ? `Puan %${Math.round(us.passedScore)}` : "Tamamlandı";
  } else if (lr && us.canStart) {
    // Kaldı, hakkı var → tekrar dene
    tag = { label: "Kaldı", color: "red" };
    badge = {
      color: "blue",
      left: lrScore != null ? `%${lrScore}` : "Tekrar",
      right: "Tekrar Dene",
      href: EXAM_URL(e.id),
    };
    footerLeft = `Kalan deneme: ${us.remainingAttempts}`;
  } else if (lr && !us.canStart) {
    // Kaldı, hak bitti
    tag = { label: "Süresi doldu", color: "gray" };
    badge = {
      color: "gray",
      left: "Hak bitti",
      right: "Sonucu Gör",
      href: RESULT_URL(e.id, lr.attemptId),
    };
    footerLeft = "Deneme hakkı kalmadı";
  } else if (us.canStart) {
    // Hiç girilmemiş → başla
    tag = { label: "Bekliyor", color: "amber" };
    badge = {
      color: "red",
      left: "Bekliyor",
      right: "Sınava Başla",
      href: EXAM_URL(e.id),
    };
    footerLeft = `Deneme hakkı: ${e.maxAttempts}`;
  } else {
    // Girilememiş + başlanamıyor (ör. eğitim tamamlanmadan kilitli)
    tag = null;
    badge = {
      color: "gray",
      left: "Kilitli",
      right: e.course ? "Eğitime git" : "Sonucu Gör",
      href: e.course ? COURSE_URL(e.course.id) : EXAM_URL(e.id),
    };
    footerLeft = "Şu an başlatılamıyor";
  }

  return {
    id: e.id,
    title: e.title,
    href: EXAM_URL(e.id),
    coverGradient: "linear-gradient(135deg,#12325E,#12B5CB)",
    tag,
    durationBadge,
    metaLine,
    lastScore,
    footerLeft,
    badge,
  };
}
