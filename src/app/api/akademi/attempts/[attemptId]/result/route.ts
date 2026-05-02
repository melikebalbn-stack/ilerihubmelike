import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { scoreQuestion, isAutoScoredType } from "@/lib/akademi/scoring";

export async function GET(
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
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
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
  if (attempt.status === "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Sınav henüz tamamlanmadı" },
      { status: 400 }
    );
  }

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const detailedQuestions = attempt.exam.questions.map((q) => {
    const answer = answerMap.get(q.id);
    const isAuto = isAutoScoredType(q.type);

    let autoScore: { earnedPoints: number; isCorrect: boolean } | null = null;
    if (isAuto) {
      const ans = answer
        ? {
            questionId: q.id,
            selectedOptionIds: answer.optionId
              ? [answer.optionId]
              : answer.selectedOptionIds.length > 0
              ? answer.selectedOptionIds
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
      manualGrade:
        !isAuto && answer
          ? {
              score: answer.manualScore,
              feedback: answer.manualFeedback,
              gradedAt: answer.gradedAt,
            }
          : null,
    };
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    },
    exam: {
      id: attempt.exam.id,
      title: attempt.exam.title,
      passingScore: attempt.exam.passingScore,
    },
    questions: detailedQuestions,
  });
}
