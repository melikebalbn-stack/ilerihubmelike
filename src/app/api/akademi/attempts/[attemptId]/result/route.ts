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

  // CEVAP ANAHTARI SIZINTISI KAPATILDI (16.09.2026): bu uç kullanıcıya soru
  // listesi, seçenekler, isCorrect ve explanation DÖNDÜRMEZ — 3 hakkı olan biri
  // ilk denemeden sonra anahtarı görüp ikincide %100 alıyordu. Yalnız özet.
  // Soru bazlı görünüm admin puanlama ucunda (akademi.grade.manual) kalır.
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  let totalEarned = 0;
  let totalMax = 0;
  let autoGradedCount = 0;
  let manualPending = 0;

  for (const q of attempt.exam.questions) {
    const answer = answerMap.get(q.id);
    totalMax += q.points;
    if (isAutoScoredType(q.type)) {
      autoGradedCount += 1;
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
      totalEarned += r.earnedPoints;
    } else if (answer?.gradedAt && answer.manualScore !== null) {
      totalEarned += answer.manualScore;
    } else {
      manualPending += 1;
    }
  }

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
    summary: {
      totalEarned,
      totalMax,
      questionCount: attempt.exam.questions.length,
      autoGradedCount,
      manualPending,
    },
  });
}
