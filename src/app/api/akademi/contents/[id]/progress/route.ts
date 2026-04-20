import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProgressMarkResponse } from "@/types/akademi";

const XP_PER_CONTENT = 10;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id ?? "";
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { watchedSeconds?: unknown };
  const watchedSeconds: number | undefined =
    typeof body.watchedSeconds === "number" ? body.watchedSeconds : undefined;

  const content = await prisma.content.findFirst({
    where: { id, isActive: true },
    select: { id: true, courseId: true, title: true },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // Idempotency check — upsert'ten ÖNCE oku
  const existingProgress = await prisma.contentProgress.findUnique({
    where: { userId_contentId: { userId, contentId: content.id } },
  });
  const alreadyCompleted = Boolean(existingProgress?.completed);

  const result = await prisma.$transaction(async (tx) => {
    await tx.contentProgress.upsert({
      where: { userId_contentId: { userId, contentId: content.id } },
      create: {
        userId,
        contentId: content.id,
        completed: true,
        watchedSeconds: watchedSeconds ?? null,
        completedAt: new Date(),
      },
      update: {
        completed: true,
        watchedSeconds: watchedSeconds ?? null,
        completedAt: existingProgress?.completedAt ?? new Date(),
      },
    });

    const [totalContents, completedContents] = await Promise.all([
      tx.content.count({
        where: { courseId: content.courseId, isActive: true },
      }),
      tx.contentProgress.count({
        where: {
          userId,
          content: { courseId: content.courseId, isActive: true },
          completed: true,
        },
      }),
    ]);
    const percentage =
      totalContents === 0 ? 0 : (completedContents / totalContents) * 100;
    const courseCompleted = percentage >= 100;

    await tx.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId: content.courseId } },
      create: {
        userId,
        courseId: content.courseId,
        percentage,
        completedAt: courseCompleted ? new Date() : null,
      },
      update: {
        percentage,
        completedAt: courseCompleted ? new Date() : null,
      },
    });

    let xpGranted = 0;
    if (!alreadyCompleted) {
      xpGranted = XP_PER_CONTENT;

      await tx.xpHistory.create({
        data: {
          userId,
          amount: xpGranted,
          reason: `İçerik tamamlandı: ${content.title}`,
        },
      });

      await tx.userXp.upsert({
        where: { userId },
        create: { userId, total: xpGranted, level: 1 },
        update: { total: { increment: xpGranted } },
      });
    }

    return { percentage, isCompleted: courseCompleted, xpGranted };
  });

  const response: ProgressMarkResponse = {
    success: true,
    percentage: result.percentage,
    isCompleted: result.isCompleted,
    xpGranted: result.xpGranted,
  };

  return NextResponse.json(response);
}
