import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;

  const exams = await prisma.exam.findMany({
    where: { courseId, isActive: true },
    include: {
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
    const passed = attempts.some(
      (a) => a.status === "COMPLETED" && a.passed === true
    );
    const usedAttempts = attempts.filter(
      (a) =>
        a.status !== "IN_PROGRESS" ||
        (a.expiresAt && new Date(a.expiresAt).getTime() < now)
    ).length;

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      passingScore: e.passingScore,
      timeLimit: e.timeLimit,
      maxAttempts: e.maxAttempts,
      questionCount: e._count.questions,
      userStatus: {
        passed,
        hasInProgress: !!inProgress,
        inProgressAttemptId: inProgress?.id ?? null,
        usedAttempts,
        remainingAttempts: Math.max(0, e.maxAttempts - usedAttempts),
        canStart: !inProgress && usedAttempts < e.maxAttempts && !passed,
        lastAttempt: completed[0] ?? null,
      },
    };
  });

  return NextResponse.json({ exams: result });
}
