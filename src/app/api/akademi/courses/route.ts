import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { CourseListItem } from "@/types/akademi";

export async function GET() {
  // Katalog OKUMA: kurs.edit YA DA akademi.admin yeterli (OR). Yazma handler'ları
  // ayrı admin route'larında ve kurs.edit'te kalır — bu gevşeme YALNIZ GET.
  const { session, error } = await requirePermission(['akademi.kurs.edit', 'akademi.admin']);
  if (error) return error;
  const userId = await resolveAkademiUserId(session);

  const courses = await prisma.course.findMany({
    // IFS-6: IFS kursları genel katalogdan ayrı ("IFS Eğitimleri" başlığında).
    where: { isActive: true, isIfs: false },
    include: {
      _count: { select: { contents: { where: { isActive: true } } } },
      // KATALOG YÜZDESİ (19.09.2026): eskiden sabit 0/false dönüyordu — kullanıcı
      // kursu bitirip sınavı geçse de "Tüm Eğitimler" kartında %0 görünüyordu.
      progress: userId ? { where: { userId }, take: 1 } : false,
      directAssignments: userId
        ? { where: { userAssignments: { some: { userId } } }, take: 1, select: { id: true } }
        : false,
    },
    orderBy: { createdAt: "desc" },
  });

  const items: CourseListItem[] = courses.map((c) => {
    const prog = c.progress?.[0];
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
      isAssigned: (c.directAssignments?.length ?? 0) > 0,
    };
  });

  return NextResponse.json({ courses: items });
}
