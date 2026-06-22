import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || !exam.isActive) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  const existing = await prisma.userExamAttempt.findFirst({
    where: { userId, examId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });

  if (existing) {
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      await prisma.userExamAttempt.update({
        where: { id: existing.id },
        data: { status: "EXPIRED" },
      });
    } else {
      return NextResponse.json({ attempt: existing, resumed: true });
    }
  }

  const usedCount = await prisma.userExamAttempt.count({
    where: {
      userId,
      examId,
      status: { in: ["SUBMITTED", "PENDING_REVIEW", "COMPLETED", "EXPIRED"] },
    },
  });

  if (usedCount >= exam.maxAttempts) {
    return NextResponse.json(
      {
        error: `Maksimum deneme sayısına ulaştınız (${exam.maxAttempts}). Admin'den reset talep edin.`,
      },
      { status: 400 }
    );
  }

  const startedAt = new Date();
  const expiresAt = exam.timeLimit
    ? new Date(startedAt.getTime() + exam.timeLimit * 60 * 1000)
    : null;

  const attempt = await prisma.userExamAttempt.create({
    data: {
      userId,
      examId,
      status: "IN_PROGRESS",
      startedAt,
      expiresAt,
    },
  });

  return NextResponse.json({ attempt, resumed: false }, { status: 201 });
}
