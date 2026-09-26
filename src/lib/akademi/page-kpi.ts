import type { CourseListItem } from "@/types/akademi";
import type { ExamCardInput } from "@/lib/akademi/exam-card-model";

export type CoursesKpi = {
  total: number;
  inProgress: number;
  completed: number;
  zorunluPending: number;
};

/** Eğitimler sayfası KPI: toplam / devam eden / tamamlanan / zorunlu (bekleyen). */
export function coursesKpi(courses: CourseListItem[]): CoursesKpi {
  return {
    total: courses.length,
    inProgress: courses.filter((c) => !c.isCompleted && c.progressPercent > 0).length,
    completed: courses.filter((c) => c.isCompleted).length,
    zorunluPending: courses.filter(
      (c) =>
        !c.isCompleted &&
        (c.category ?? "").trim().toLocaleLowerCase("tr-TR") === "zorunlu"
    ).length,
  };
}

export type ExamsKpi = {
  pending: number;
  passed: number;
  failed: number;
  avgScore: number; // 0-100, tamamlanmış deneme yoksa 0
};

/** Sınavlar sayfası KPI: bekleyen / geçilen / kalan / ortalama puan. */
export function examsKpi(exams: ExamCardInput[]): ExamsKpi {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  const scores: number[] = [];

  for (const e of exams) {
    const us = e.userStatus;
    if (us.passed) passed++;
    else if (us.lastResult && us.lastResult.passed === false) failed++;
    else pending++; // hiç girilmemiş veya sürüyor

    if (us.lastResult && us.lastResult.score != null) {
      scores.push(us.lastResult.score);
    }
  }

  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return { pending, passed, failed, avgScore };
}
