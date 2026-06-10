import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextRequest, NextResponse } from "next/server";
import type { CourseListItem } from "@/types/akademi";
import { stripDeptPrefix, stripAreaPrefix } from "@/lib/akademi-ifs";

// IFS-6 Sv2: Alan = seçilen isIfs paketteki Course'lar. Görünen ad = kurs adından
// "<Departman> · " prefix'i DISPLAY'de kırpılmış. Katalog davranışı (atanmamış da
// görünür, %0). CourseCard reuse için CourseListItem şeklinde döner; kart Sv3'e
// (mevcut courses/[id] GOREV görünümü) linkler.

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packageId = req.nextUrl.searchParams.get("packageId")?.trim();
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }

  const pkg = await prisma.coursePackage.findFirst({
    where: { id: packageId, isActive: true, isIfs: true },
    include: {
      packageCourses: {
        orderBy: { order: "asc" },
        include: {
          course: {
            include: {
              _count: {
                select: { contents: { where: { isActive: true } } },
              },
              progress: { where: { userId }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!pkg) {
    return NextResponse.json({ error: "Departman bulunamadı" }, { status: 404 });
  }

  const departmentName = stripDeptPrefix(pkg.name);

  const courses: CourseListItem[] = pkg.packageCourses
    .filter((pc) => pc.course.isActive)
    .map((pc) => {
      const c = pc.course;
      const prog = c.progress[0];
      return {
        id: c.id,
        title: stripAreaPrefix(c.title, departmentName),
        description: c.description,
        thumbnail: c.thumbnail,
        category: null,
        difficulty: c.difficulty,
        duration: c.duration,
        contentCount: c._count.contents,
        progressPercent: prog?.percentage ?? 0,
        isCompleted: Boolean(prog?.completedAt),
        isAssigned: false,
      };
    });

  return NextResponse.json({ departmentName, courses });
}
