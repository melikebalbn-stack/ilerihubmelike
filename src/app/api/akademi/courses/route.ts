import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { CourseListItem } from "@/types/akademi";

export async function GET() {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const courses = await prisma.course.findMany({
    // IFS-6: IFS kursları genel katalogdan ayrı ("IFS Eğitimleri" başlığında).
    where: { isActive: true, isIfs: false },
    include: {
      _count: { select: { contents: { where: { isActive: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: CourseListItem[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    thumbnail: c.thumbnail,
    category: c.category,
    difficulty: c.difficulty,
    duration: c.duration,
    contentCount: c._count.contents,
    progressPercent: 0,
    isCompleted: false,
    isAssigned: false,
  }));

  return NextResponse.json({ courses: items });
}
