import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { CourseDetail } from "@/types/akademi";

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
            select: { ornekAciklama: true },
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
        ornekAciklama: c.ifsEvaluations[0]?.ornekAciklama ?? null,
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
