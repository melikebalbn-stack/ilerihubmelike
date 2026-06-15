import { prisma } from "@/lib/prisma";
import { issueCertificateIfEligible } from "./certificate-issue";

/**
 * Bir user'ın bir kurs için ilerlemesini yeniden hesaplar.
 *
 * Formula (normal kurs):
 * - Hem content hem exam: percentage = (contentRatio * 0.7 + examRatio * 0.3) * 100
 * - Sadece content varsa: percentage = (completedContent / totalContent) * 100
 * - Sadece exam varsa:    percentage = (passedExams / totalExams) * 100
 * - Hiçbiri yoksa: 0
 *
 * IFS kursu (course.isIfs, PR-2): percentage = BASARILI örnek / toplam GOREV;
 * isComplete = IfsCourseEvaluation.seviye == BASARILI (kursiyerin self-mark'ı
 * ETKİ ETMEZ). Tetik: ifs-evaluations PATCH + ifs-course-evaluation PATCH.
 *
 * %100'e ulaşıldığında completedAt set + sertifika tetiklenir (idempotent).
 *
 * Trigger noktaları:
 * - /api/akademi/contents/[id]/progress (content tamamlanınca)
 * - /api/akademi/attempts/[attemptId]/submit (otomatik passed=true)
 * - /api/akademi/admin/attempts/[attemptId]/finalize (manuel grading sonrası)
 */
export async function recomputeCourseProgress(
  userId: string,
  courseId: string
) {
  if (!userId || !courseId) return null;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      contents: {
        where: { isActive: true },
        select: { id: true, type: true },
      },
      exams: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!course) return null;

  let percentage = 0;
  let isComplete = false;

  if (course.isIfs) {
    // IFS: BAR = kursiyer SELF-MARK (ContentProgress.completed=true olan GOREV
    // oranı) → kursiyer eğitmen onayını beklemeden ilerlemesini görür.
    // TAMAMLANMA/sertifika = eğitmen ders seviyesi (IfsCourseEvaluation.seviye=
    // BASARILI); isComplete buna bağlı → self-mark %100 sertifika TETİKLEMEZ.
    // RAPORLAR ayrı kalır: hâlâ eğitmen ornekStatus/seviye===BASARILI sayar.
    const gorevIds = course.contents
      .filter((c) => c.type === "GOREV")
      .map((c) => c.id);
    const totalGorev = gorevIds.length;

    let selfMarkedCount = 0;
    if (totalGorev > 0) {
      selfMarkedCount = await prisma.contentProgress.count({
        where: {
          userId,
          contentId: { in: gorevIds },
          completed: true,
        },
      });
    }
    percentage =
      totalGorev > 0 ? Math.round((selfMarkedCount / totalGorev) * 100) : 0;

    const courseEval = await prisma.ifsCourseEvaluation.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { seviye: true },
    });
    isComplete = courseEval?.seviye === "BASARILI";
  } else {
    // Normal kurs yolu — DEĞİŞMEDİ.
    const totalContent = course.contents.length;
    const totalExams = course.exams.length;

    let completedContent = 0;
    if (totalContent > 0) {
      const contentIds = course.contents.map((c) => c.id);
      completedContent = await prisma.contentProgress.count({
        where: {
          userId,
          contentId: { in: contentIds },
          completed: true,
        },
      });
    }

    let passedExams = 0;
    if (totalExams > 0) {
      const examIds = course.exams.map((e) => e.id);
      const passedAttempts = await prisma.userExamAttempt.findMany({
        where: {
          userId,
          examId: { in: examIds },
          status: "COMPLETED",
          passed: true,
        },
        select: { examId: true },
        distinct: ["examId"],
      });
      passedExams = passedAttempts.length;
    }

    if (totalContent > 0 && totalExams > 0) {
      const contentRatio = completedContent / totalContent;
      const examRatio = passedExams / totalExams;
      percentage = Math.round((contentRatio * 0.7 + examRatio * 0.3) * 100);
    } else if (totalContent > 0) {
      percentage = Math.round((completedContent / totalContent) * 100);
    } else if (totalExams > 0) {
      percentage = Math.round((passedExams / totalExams) * 100);
    }

    isComplete = percentage >= 100;
  }

  // Race-safe upsert: ilk %100 anını koru, paralel tetiklerde P2002 yutulup update'e geç
  let progress;
  try {
    progress = await prisma.courseProgress.create({
      data: {
        userId,
        courseId,
        percentage,
        completedAt: isComplete ? new Date() : null,
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code !== "P2002") throw e;

    const existing = await prisma.courseProgress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    progress = await prisma.courseProgress.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        percentage,
        completedAt: existing?.completedAt ?? (isComplete ? new Date() : null),
      },
    });
  }

  if (isComplete) {
    try {
      await issueCertificateIfEligible(userId, courseId);
    } catch (e) {
      console.error("[recomputeCourseProgress] cert issue failed:", e);
    }
  }

  return progress;
}
