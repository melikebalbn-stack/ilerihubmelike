import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { stripDeptPrefix } from "@/lib/akademi-ifs";
import { NextResponse } from "next/server";

// IFS-6 Sv1: Departman = aktif isIfs CoursePackage'lar. Katalog davranışı —
// ATAMA şartı yok (atanmamış departman da görünür), ama izin şartı VAR.
// Görünen ad = paket adından "IFS Geçiş · " prefix'i DISPLAY'de kırpılmış.
//
// YETKİ (09.09.2026): eskiden yalnız oturum aranıyordu, yani giriş yapan
// herkes IFS katalogunu okuyabiliyordu. ifs.view'a bağlandı — sayfa kapısıyla
// aynı anahtar. Ölçüm: izni taşımayan 7 aktif hesap kaldı, hepsi terminal/kiosk.
export async function GET() {
  const { session, error } = await requirePermission("ifs.view");
  if (error) return error;

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
    coverImageUrl: p.coverImageUrl,
  }));

  return NextResponse.json({ departments });
}
