import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { stripDeptPrefix } from "@/lib/akademi-ifs";
import { NextResponse } from "next/server";

// IFS-6 Sv1: Departman = aktif isIfs CoursePackage'lar. Katalog davranışı —
// atanma şartı yok, herkes görebilir. Görünen ad = paket adından "IFS Geçiş · "
// prefix'i DISPLAY'de kırpılmış (veriye dokunulmaz).

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packages = await prisma.coursePackage.findMany({
    where: { isActive: true, isIfs: true },
    include: { _count: { select: { packageCourses: true } } },
    orderBy: { name: "asc" },
  });

  const departments = packages.map((p) => ({
    packageId: p.id,
    name: p.name,
    displayName: stripDeptPrefix(p.name),
    courseCount: p._count.packageCourses,
  }));

  return NextResponse.json({ departments });
}
