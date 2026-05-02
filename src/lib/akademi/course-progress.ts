import { prisma } from "@/lib/prisma";
import { issueCertificateIfEligible } from "./certificate-issue";

/**
 * Bir user'ın bir kurs için ilerlemesini yeniden hesaplar.
 *
 * Formula:
 * - Hem content hem exam: percentage = (contentRatio * 0.7 + examRatio * 0.3) * 100
 * - Sadece content varsa: percentage = (completedContent / totalContent) * 100
 * - Sadece exam varsa:    percentage = (passedExams / totalExams) * 100
 * - Hiçbiri yoksa: 0
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
        select: { id: true },
      },
      exams: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!course) return null;

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

  let percentage = 0;
  if (totalContent > 0 && totalExams > 0) {
    const contentRatio = completedContent / totalContent;
    const examRatio = passedExams / totalExams;
    percentage = Math.round((contentRatio * 0.7 + examRatio * 0.3) * 100);
  } else if (totalContent > 0) {
    percentage = Math.round((completedContent / totalContent) * 100);
  } else if (totalExams > 0) {
    percentage = Math.round((passedExams / totalExams) * 100);
  }

  const isComplete = percentage >= 100;

  const existing = await prisma.courseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  let progress;
  if (existing) {
    progress = await prisma.courseProgress.update({
      where: { id: existing.id },
      data: {
        percentage,
        // İlk tamamlanma anını koru; daha sonra tekrar 100 olursa zaten timestamp duruyor
        completedAt: existing.completedAt ?? (isComplete ? new Date() : null),
      },
    });
  } else {
    progress = await prisma.courseProgress.create({
      data: {
        userId,
        courseId,
        percentage,
        completedAt: isComplete ? new Date() : null,
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
