import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { NextResponse } from "next/server";
import type { ProgressMarkResponse } from "@/types/akademi";
import { izlemeDurumu } from "@/lib/akademi/video-izleme";

const XP_PER_CONTENT = 10;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { watchedSeconds?: unknown };
  const watchedSeconds: number | undefined =
    typeof body.watchedSeconds === "number" ? body.watchedSeconds : undefined;

  const content = await prisma.content.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      courseId: true,
      title: true,
      type: true,
      fileUrl: true,
      videoDurationSec: true,
      course: { select: { isIfs: true } },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const existingProgress = await prisma.contentProgress.findUnique({
    where: { userId_contentId: { userId, contentId: content.id } },
  });
  const alreadyCompleted = Boolean(existingProgress?.completed);

  // %90 İZLEME ŞARTI (17.09.2026) — yalnız yüklenmiş VIDEO + IFS dışı kurs.
  // Harici URL video ve PDF/DOCUMENT/GOREV eskisi gibi manuel. Fail-closed:
  // gerçek süre henüz bilinmiyorsa (videoDurationSec null) %0 sayılır → 409.
  const izleme = izlemeDurumu(content, existingProgress);
  if (!alreadyCompleted && !izleme.tamamlanabilir) {
    return NextResponse.json(
      {
        error: `Videonun %90'ı izlenmeli (%${izleme.watchedPercent})`,
        watchedPercent: izleme.watchedPercent,
      },
      { status: 409 }
    );
  }

  const xpGranted = await prisma.$transaction(async (tx) => {
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
        // Heartbeat'in biriktirdiği süreyi EZME: yalnız daha büyük değer yazılır.
        ...(watchedSeconds !== undefined &&
        watchedSeconds > (existingProgress?.watchedSeconds ?? 0)
          ? { watchedSeconds }
          : {}),
        completedAt: existingProgress?.completedAt ?? new Date(),
      },
    });

    if (alreadyCompleted) return 0;

    await tx.xpHistory.create({
      data: {
        userId,
        amount: XP_PER_CONTENT,
        reason: `İçerik tamamlandı: ${content.title}`,
      },
    });

    await tx.userXp.upsert({
      where: { userId },
      create: { userId, total: XP_PER_CONTENT, level: 1 },
      update: { total: { increment: XP_PER_CONTENT } },
    });

    return XP_PER_CONTENT;
  });

  // Transaction dışında: kurs progress'ini sınav ağırlığı dahil yeniden hesapla.
  // %100 olursa sertifika otomatik tetiklenir.
  const progress = await recomputeCourseProgress(userId, content.courseId);

  const response: ProgressMarkResponse = {
    success: true,
    percentage: progress?.percentage ?? 0,
    isCompleted: !!progress?.completedAt,
    xpGranted,
  };

  return NextResponse.json(response);
}
