import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type { AdminPackageCoursesUpdateInput } from "@/types/akademi-package";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  let body: AdminPackageCoursesUpdateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.courses)) {
    return NextResponse.json(
      { error: "courses bir dizi olmalı" },
      { status: 400 }
    );
  }

  const pkg = await prisma.coursePackage.findUnique({ where: { id } });
  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const courseIds = body.courses.map((c) => c.courseId);
  if (courseIds.length > 0) {
    const validCourses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true },
    });
    const validIds = new Set(validCourses.map((c) => c.id));
    const invalid = courseIds.filter((cid) => !validIds.has(cid));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Geçersiz kurs ID'leri: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction([
    prisma.packageCourse.deleteMany({ where: { packageId: id } }),
    prisma.packageCourse.createMany({
      data: body.courses.map((c, idx) => ({
        packageId: id,
        courseId: c.courseId,
        order: c.order ?? idx,
        isRequired: c.isRequired ?? true,
      })),
    }),
  ]);

  return NextResponse.json({ success: true, count: body.courses.length });
}
