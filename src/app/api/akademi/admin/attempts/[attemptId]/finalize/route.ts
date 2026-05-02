import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import {
  scoreQuestion,
  isAutoScoredType,
  computeFinalScore,
  type GradedAnswer,
} from "@/lib/akademi/scoring";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
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
  if (attempt.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "Bu attempt finalize edilebilir durumda değil" },
      { status: 400 }
    );
  }

  const manualQuestions = attempt.exam.questions.filter(
    (q) => q.isManualGraded
  );
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const ungraded: string[] = [];
  for (const q of manualQuestions) {
    const a = answerMap.get(q.id);
    if (!a || !a.gradedAt) {
      ungraded.push(q.id);
    }
  }

  if (ungraded.length > 0) {
    return NextResponse.json(
      {
        error: `${ungraded.length} manuel soru henüz değerlendirilmedi. Önce hepsini grade edin.`,
        ungradedCount: ungraded.length,
      },
      { status: 400 }
    );
  }

  const graded: GradedAnswer[] = attempt.exam.questions.map((q) => {
    const a = answerMap.get(q.id);
    let earnedPoints = 0;

    if (isAutoScoredType(q.type)) {
      const ans = a
        ? {
            questionId: q.id,
            selectedOptionIds: a.optionId
              ? [a.optionId]
              : a.selectedOptionIds.length > 0
              ? a.selectedOptionIds
              : [],
          }
        : undefined;
      const r = scoreQuestion(
        {
          id: q.id,
          type: q.type,
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
        },
        ans
      );
      earnedPoints = r.earnedPoints;
    } else {
      earnedPoints = a?.manualScore ?? 0;
    }

    return {
      questionId: q.id,
      earnedPoints,
      maxPoints: q.points,
    };
  });

  const final = computeFinalScore(graded, attempt.exam.passingScore);

  await prisma.$transaction([
    prisma.userExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        score: final.percentage,
        passed: final.passed,
      },
    }),
    prisma.akademiNotification.create({
      data: {
        userId: attempt.userId,
        title: final.passed
          ? "Tebrikler! Sınavı geçtiniz"
          : "Sınavı geçemediniz",
        message: `"${attempt.exam.title}" — Manuel değerlendirme tamamlandı. Toplam: ${final.totalEarned}/${final.totalMax} (%${final.percentage}). Geçme barajı: %${attempt.exam.passingScore}.`,
        type: final.passed ? "EXAM_PASSED" : "EXAM_FAILED",
        link: `/akademi/exams/${attempt.examId}/result/${attemptId}`,
      },
    }),
  ]);

  if (final.passed && attempt.exam.courseId) {
    try {
      await recomputeCourseProgress(attempt.userId, attempt.exam.courseId);
    } catch (e) {
      console.error("[finalize] recomputeCourseProgress failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    score: final.percentage,
    passed: final.passed,
    totalEarned: final.totalEarned,
    totalMax: final.totalMax,
  });
}
