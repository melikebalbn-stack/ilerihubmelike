import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { isAutoScored } from "@/lib/akademi/question-types";
import { scoreQuestion } from "@/lib/akademi/scoring";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("examId");

  if (examId) {
    return getSingleExamReport(examId);
  }

  const exams = await prisma.exam.findMany({
    select: {
      id: true,
      title: true,
      isActive: true,
      passingScore: true,
      timeLimit: true,
      maxAttempts: true,
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        select: {
          status: true,
          score: true,
          passed: true,
          completedAt: true,
          startedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = exams.map((e) => {
    const completed = e.attempts.filter((a) => a.status === "COMPLETED");
    const pending = e.attempts.filter(
      (a) => a.status === "PENDING_REVIEW"
    ).length;
    const passed = completed.filter((a) => a.passed).length;
    const passRate =
      completed.length > 0 ? Math.round((passed / completed.length) * 100) : 0;
    const avgScore =
      completed.length > 0
        ? Math.round(
            completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length
          )
        : 0;

    const durations = completed
      .filter((a) => a.completedAt && a.startedAt)
      .map(
        (a) =>
          (new Date(a.completedAt!).getTime() -
            new Date(a.startedAt).getTime()) /
          60000
      );
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0;

    return {
      id: e.id,
      title: e.title,
      isActive: e.isActive,
      passingScore: e.passingScore,
      timeLimit: e.timeLimit,
      maxAttempts: e.maxAttempts,
      course: e.course,
      questionCount: e._count.questions,
      totalAttempts: e.attempts.length,
      completedAttempts: completed.length,
      pendingReview: pending,
      passed,
      passRate,
      avgScore,
      avgDurationMinutes: avgDuration,
    };
  });

  return NextResponse.json({ exams: result });
}

async function getSingleExamReport(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: true,
          answers: {
            where: { attempt: { status: "COMPLETED" } },
            select: { optionId: true, selectedOptionIds: true },
          },
        },
      },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const questionStats = exam.questions.map((q) => {
    const totalAnswers = q.answers.length;
    let correctCount = 0;

    if (isAutoScored(q.type) && totalAnswers > 0) {
      for (const a of q.answers) {
        const ans = {
          questionId: q.id,
          selectedOptionIds: a.optionId
            ? [a.optionId]
            : a.selectedOptionIds.length > 0
            ? a.selectedOptionIds
            : [],
        };
        const r = scoreQuestion(
          {
            id: q.id,
            type: q.type,
            points: q.points,
            options: q.options.map((o) => ({
              id: o.id,
              isCorrect: o.isCorrect,
            })),
          },
          ans
        );
        if (r.isCorrect) correctCount++;
      }
    }

    const correctRate =
      totalAnswers > 0 && isAutoScored(q.type)
        ? Math.round((correctCount / totalAnswers) * 100)
        : null;

    let difficulty: "easy" | "medium" | "hard" | "manual";
    if (correctRate === null) difficulty = "manual";
    else if (correctRate >= 80) difficulty = "easy";
    else if (correctRate >= 50) difficulty = "medium";
    else difficulty = "hard";

    return {
      id: q.id,
      order: q.order,
      question: q.question,
      type: q.type,
      points: q.points,
      isManualGraded: q.isManualGraded,
      totalAnswers,
      correctCount: isAutoScored(q.type) ? correctCount : null,
      correctRate,
      difficulty,
    };
  });

  return NextResponse.json({
    exam: { id: exam.id, title: exam.title },
    questions: questionStats,
  });
}
