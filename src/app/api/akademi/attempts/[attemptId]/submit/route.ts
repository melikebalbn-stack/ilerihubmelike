import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { scoreExam, type AnswerInput } from "@/lib/akademi/scoring";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { notifyAkademiEvent } from "@/lib/akademi-notify";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  const attempt = await prisma.userExamAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: { include: { options: true } },
        },
      },
      answers: true,
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (attempt.userId !== userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Bu sınav zaten tamamlandı" },
      { status: 400 }
    );
  }

  const questionsInput = attempt.exam.questions.map((q) => ({
    id: q.id,
    type: q.type,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
  }));

  const answersInput: AnswerInput[] = attempt.answers.map((a) => ({
    questionId: a.questionId,
    selectedOptionIds: a.optionId
      ? [a.optionId]
      : a.selectedOptionIds.length > 0
      ? a.selectedOptionIds
      : [],
    textAnswer: a.textAnswer ?? undefined,
    ratingValue: a.ratingValue ?? undefined,
    scaleValue: a.scaleValue ?? undefined,
    dateValue: a.dateValue ?? undefined,
  }));

  const result = scoreExam(
    questionsInput,
    answersInput,
    attempt.exam.passingScore
  );

  const completedAt = new Date();
  let newStatus: "COMPLETED" | "PENDING_REVIEW";
  let finalScore: number;
  let passed: boolean | null;

  if (result.hasManualQuestions) {
    newStatus = "PENDING_REVIEW";
    finalScore = result.percentage;
    passed = null;
  } else {
    newStatus = "COMPLETED";
    finalScore = result.percentage;
    passed = result.passed ?? false;
  }

  // PENDING_REVIEW için in-app burada (notify-akademi 9 event tipinde EXAM_PENDING_REVIEW yok).
  // PASSED/FAILED durumları aşağıdaki notifyAkademiEvent tarafından yönetilir (in-app + mail).
  if (result.hasManualQuestions) {
    await prisma.$transaction([
      prisma.userExamAttempt.update({
        where: { id: attemptId },
        data: { status: newStatus, completedAt, score: finalScore, passed },
      }),
      prisma.akademiNotification.create({
        data: {
          userId,
          title: "Sınavınız değerlendirme bekleniyor",
          message: `"${attempt.exam.title}" — Otomatik puan: ${result.totalEarned}/${result.autoMax}. Manuel sorular admin tarafından değerlendirildikten sonra sonuç netleşecek.`,
          type: "EXAM_PENDING_REVIEW",
          link: `/akademi/exams/${attempt.examId}/result/${attemptId}`,
        },
      }),
    ]);
  } else {
    await prisma.userExamAttempt.update({
      where: { id: attemptId },
      data: { status: newStatus, completedAt, score: finalScore, passed },
    });
  }

  // Otomatik geçildi ve kursa bağlıysa kurs ilerlemesini yeniden hesapla
  // (sertifika tetiklenebilir; PENDING_REVIEW'da bekletilecek, finalize'da yeniden çağrılır)
  if (passed === true && attempt.exam.courseId) {
    try {
      await recomputeCourseProgress(userId, attempt.exam.courseId);
    } catch (e) {
      console.error("[submit] recomputeCourseProgress failed:", e);
    }
  }

  // Mail bildirim — manuel review değilse direkt EXAM_PASSED/FAILED gönder
  if (passed !== null) {
    const courseTitle = attempt.exam.courseId
      ? (
          await prisma.course.findUnique({
            where: { id: attempt.exam.courseId },
            select: { title: true },
          })
        )?.title ?? attempt.exam.title
      : attempt.exam.title;

    notifyAkademiEvent({
      userId,
      eventType: passed ? "EXAM_PASSED" : "EXAM_FAILED",
      courseTitle,
      data: {
        score: finalScore,
        passingScore: attempt.exam.passingScore,
        attemptNumber: 1,
        canRetake: !passed,
      },
      link: `/akademi/exams/${attempt.examId}/result/${attemptId}`,
    }).catch((err) =>
      console.error(`[submit] notify ${passed ? "PASSED" : "FAILED"}:`, err)
    );
  }

  return NextResponse.json({
    attemptId,
    status: newStatus,
    score: finalScore,
    totalEarned: result.totalEarned,
    totalMax: result.totalMax,
    autoMax: result.autoMax,
    manualMax: result.manualMax,
    percentage: result.percentage,
    passed,
    hasManualQuestions: result.hasManualQuestions,
  });
}
