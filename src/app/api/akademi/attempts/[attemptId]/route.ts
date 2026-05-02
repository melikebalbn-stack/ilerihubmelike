import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import type { AttemptStatus } from "@/generated/prisma";

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
            include: {
              options: {
                orderBy: { order: "asc" },
                select: { id: true, text: true, order: true },
              },
            },
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

  let status: AttemptStatus = attempt.status;
  if (
    status === "IN_PROGRESS" &&
    attempt.expiresAt &&
    new Date(attempt.expiresAt) < new Date()
  ) {
    await prisma.userExamAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED" },
    });
    status = "EXPIRED";
  }

  const questions = attempt.exam.questions.map((q) => ({
    id: q.id,
    question: q.question,
    type: q.type,
    points: q.points,
    order: q.order,
    options: q.options,
  }));

  const savedAnswers = attempt.answers.map((a) => ({
    questionId: a.questionId,
    optionId: a.optionId,
    selectedOptionIds: a.selectedOptionIds,
    textAnswer: a.textAnswer,
    ratingValue: a.ratingValue,
    scaleValue: a.scaleValue,
    dateValue: a.dateValue,
  }));

  const remainingMs = attempt.expiresAt
    ? Math.max(0, new Date(attempt.expiresAt).getTime() - Date.now())
    : null;

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingMs,
    },
    exam: {
      id: attempt.exam.id,
      title: attempt.exam.title,
      passingScore: attempt.exam.passingScore,
      timeLimit: attempt.exam.timeLimit,
    },
    questions,
    savedAnswers,
  });
}
