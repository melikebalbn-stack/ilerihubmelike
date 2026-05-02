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

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"attempt:" + attemptId}))`;

    const attempt = await tx.userExamAttempt.findUnique({
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
      return { ok: false as const, status: 404, error: "Bulunamadı" };
    }
    if (attempt.status !== "PENDING_REVIEW") {
      return {
        ok: false as const,
        status: 409,
        error: "Bu attempt başka bir admin tarafından finalize edildi",
      };
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
      return {
        ok: false as const,
        status: 400,
        error: `${ungraded.length} manuel soru henüz değerlendirilmedi. Önce hepsini grade edin.`,
        ungradedCount: ungraded.length,
      };
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

    const u = await tx.userExamAttempt.updateMany({
      where: { id: attemptId, status: "PENDING_REVIEW" },
      data: {
        status: "COMPLETED",
        score: final.percentage,
        passed: final.passed,
      },
    });

    if (u.count === 0) {
      return {
        ok: false as const,
        status: 409,
        error: "Race condition: başka bir işlem finalize etti",
      };
    }

    await tx.akademiNotification.create({
      data: {
        userId: attempt.userId,
        title: final.passed
          ? "Tebrikler! Sınavı geçtiniz"
          : "Sınavı geçemediniz",
        message: `"${attempt.exam.title}" — Manuel değerlendirme tamamlandı. Toplam: ${final.totalEarned}/${final.totalMax} (%${final.percentage}). Geçme barajı: %${attempt.exam.passingScore}.`,
        type: final.passed ? "EXAM_PASSED" : "EXAM_FAILED",
        link: `/akademi/exams/${attempt.examId}/result/${attemptId}`,
      },
    });

    return {
      ok: true as const,
      userId: attempt.userId,
      courseId: attempt.exam.courseId,
      final,
    };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.final.passed && result.courseId) {
    try {
      await recomputeCourseProgress(result.userId, result.courseId);
    } catch (e) {
      console.error("[finalize] recomputeCourseProgress failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    score: result.final.percentage,
    passed: result.final.passed,
    totalEarned: result.final.totalEarned,
    totalMax: result.final.totalMax,
  });
}
