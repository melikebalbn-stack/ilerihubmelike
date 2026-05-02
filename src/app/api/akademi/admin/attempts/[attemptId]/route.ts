import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { scoreQuestion, isAutoScoredType } from "@/lib/akademi/scoring";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { attemptId } = await params;

  const attempt = await prisma.userExamAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      exam: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      answers: {
        include: {
          gradedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const detailedQuestions = attempt.exam.questions.map((q) => {
    const answer = answerMap.get(q.id);
    const isAuto = isAutoScoredType(q.type);

    let autoScore: { earnedPoints: number; isCorrect: boolean } | null = null;
    if (isAuto && answer) {
      const ans = {
        questionId: q.id,
        selectedOptionIds: answer.optionId
          ? [answer.optionId]
          : answer.selectedOptionIds.length > 0
          ? answer.selectedOptionIds
          : [],
      };
      const r = scoreQuestion(
        {
          id: q.id,
          type: q.type,
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
        },
        ans
      );
      autoScore = { earnedPoints: r.earnedPoints, isCorrect: r.isCorrect };
    }

    return {
      id: q.id,
      question: q.question,
      type: q.type,
      points: q.points,
      order: q.order,
      explanation: q.explanation,
      isManualGraded: q.isManualGraded,
      matrixConfig: q.matrixConfig,
      allowedFileTypes: q.allowedFileTypes,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      userAnswer: answer
        ? {
            id: answer.id,
            optionId: answer.optionId,
            selectedOptionIds: answer.selectedOptionIds,
            textAnswer: answer.textAnswer,
            ratingValue: answer.ratingValue,
            scaleValue: answer.scaleValue,
            dateValue: answer.dateValue,
            fileUrl: answer.fileUrl,
            matrixAnswer: answer.matrixAnswer,
          }
        : null,
      autoScore,
      manualGrade: answer
        ? {
            score: answer.manualScore,
            feedback: answer.manualFeedback,
            gradedAt: answer.gradedAt,
            gradedBy: answer.gradedBy,
          }
        : null,
    };
  });

  const manualQuestions = detailedQuestions.filter((q) => q.isManualGraded);
  const gradedManual = manualQuestions.filter((q) => q.manualGrade?.gradedAt);
  const allManualGraded =
    manualQuestions.length > 0 &&
    gradedManual.length === manualQuestions.length;

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    },
    user: attempt.user,
    exam: {
      id: attempt.exam.id,
      title: attempt.exam.title,
      passingScore: attempt.exam.passingScore,
    },
    questions: detailedQuestions,
    summary: {
      manualTotal: manualQuestions.length,
      manualGraded: gradedManual.length,
      allManualGraded,
    },
  });
}
