import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { CourseListItem } from "@/types/akademi";

export async function GET() {
  // Katalog OKUMA: kurs.edit YA DA akademi.admin yeterli (OR). Yazma handler'ları
  // ayrı admin route'larında ve kurs.edit'te kalır — bu gevşeme YALNIZ GET.
  const { error } = await requirePermission(['akademi.kurs.edit', 'akademi.admin']);
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
