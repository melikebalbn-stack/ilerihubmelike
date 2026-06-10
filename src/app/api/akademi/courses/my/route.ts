import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { CourseListItem } from "@/types/akademi";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      // IFS-6: IFS kursları genel katalogdan ayrı — "IFS Eğitimleri" başlığında.
      isIfs: false,
      directAssignments: {
        some: {
          userAssignments: {
            some: { userId },
          },
        },
      },
    },
    include: {
      _count: { select: { contents: { where: { isActive: true } } } },
      progress: {
        where: { userId },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: CourseListItem[] = courses.map((c) => {
    const prog = c.progress[0];
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      category: c.category,
      difficulty: c.difficulty,
      duration: c.duration,
      contentCount: c._count.contents,
      progressPercent: prog?.percentage ?? 0,
      isCompleted: Boolean(prog?.completedAt),
      isAssigned: true,
    };
  });

  return NextResponse.json({ courses: items });
}
