import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exams = await prisma.exam.findMany({
    where: { isActive: true },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          score: true,
          passed: true,
          startedAt: true,
          completedAt: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();

  const result = exams.map((e) => {
    const attempts = e.attempts;
    const inProgress = attempts.find(
      (a) =>
        a.status === "IN_PROGRESS" &&
        (!a.expiresAt || new Date(a.expiresAt).getTime() > now)
    );
    const completed = attempts.filter(
      (a) => a.status === "COMPLETED" || a.status === "PENDING_REVIEW"
    );
    const lastCompleted = completed[0];
    const usedAttempts = attempts.filter(
      (a) =>
        a.status !== "IN_PROGRESS" ||
        (a.expiresAt && new Date(a.expiresAt).getTime() < now)
    ).length;
    const canStart = !inProgress && usedAttempts < e.maxAttempts;

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      passingScore: e.passingScore,
      timeLimit: e.timeLimit,
      maxAttempts: e.maxAttempts,
      questionCount: e._count.questions,
      course: e.course,
      userStatus: {
        canStart,
        hasInProgress: !!inProgress,
        inProgressAttemptId: inProgress?.id ?? null,
        usedAttempts,
        remainingAttempts: Math.max(0, e.maxAttempts - usedAttempts),
        lastResult: lastCompleted
          ? {
              attemptId: lastCompleted.id,
              score: lastCompleted.score,
              passed: lastCompleted.passed,
              status: lastCompleted.status,
              completedAt: lastCompleted.completedAt,
            }
          : null,
      },
    };
  });

  return NextResponse.json({ exams: result });
}
