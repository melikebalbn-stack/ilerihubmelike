import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { CourseDetail } from "@/types/akademi";
import { izlemeDurumu } from "@/lib/akademi/video-izleme";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const course = await prisma.course.findFirst({
    where: { id, isActive: true },
    include: {
      contents: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
          progress: {
            where: { userId },
            take: 1,
          },
          // Kursiyerin kendi "Örnek Yaptım" açıklaması — modal prefill için.
          ifsEvaluations: {
            where: { userId },
            take: 1,
            select: { ornekAciklama: true, kursiyerDurum: true },
          },
          ifsMeta: true,
        },
      },
      progress: {
        where: { userId },
        take: 1,
      },
      directAssignments: {
        where: {
          userAssignments: { some: { userId } },
        },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const courseProgress = course.progress[0];
  const isAssigned = course.directAssignments.length > 0;

  const detail: CourseDetail = {
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail,
    category: course.category,
    difficulty: course.difficulty,
    duration: course.duration,
    contentCount: course.contents.length,
    progressPercent: courseProgress?.percentage ?? 0,
    isCompleted: Boolean(courseProgress?.completedAt),
    isAssigned,
    contents: course.contents.map((c) => {
      const contentProg = c.progress[0];
      const izleme = izlemeDurumu(
        { type: c.type, fileUrl: c.fileUrl, videoDurationSec: c.videoDurationSec, course: { isIfs: course.isIfs } },
        contentProg
      );
      return {
        id: c.id,
        courseId: c.courseId,
        title: c.title,
        description: c.description,
        type: c.type,
        filePath: c.filePath,
        fileUrl: c.fileUrl,
        duration: c.duration,
        order: c.order,
        completedByCurrentUser: Boolean(contentProg?.completed),
        // VIDEO izleme takibi (Dalga 1) — diğer tiplerde sartUygulanir=false.
        watchedSeconds: izleme.watchedSeconds,
        lastPositionSec: izleme.lastPositionSec,
        videoDurationSec: izleme.videoDurationSec,
        watchedPercent: izleme.watchedPercent,
        izlemeSartiUygulanir: izleme.sartUygulanir,
        ornekAciklama: c.ifsEvaluations[0]?.ornekAciklama ?? null,
        kursiyerDurum: c.ifsEvaluations[0]?.kursiyerDurum ?? null,
        ifsMeta: c.ifsMeta
          ? {
              modul: c.ifsMeta.modul,
              altModul: c.ifsMeta.altModul,
              ifsEkran: c.ifsMeta.ifsEkran,
              refDocUrl: c.ifsMeta.refDocUrl,
              refVideoUrl: c.ifsMeta.refVideoUrl,
            }
          : null,
      };
    }),
  };

  return NextResponse.json(detail);
}
