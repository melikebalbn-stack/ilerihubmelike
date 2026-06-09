import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type {
  AdminPackageDetail,
  AdminPackageUpdateInput,
} from "@/types/akademi-package";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  const pkg = await prisma.coursePackage.findUnique({
    where: { id },
    include: {
      packageCourses: {
        orderBy: { order: "asc" },
        include: {
          course: { select: { id: true, title: true, difficulty: true } },
        },
      },
      departmentPackages: { orderBy: { bolum: "asc" } },
      userAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: {
          packageCourses: true,
          departmentPackages: true,
          userAssignments: true,
        },
      },
    },
  });

  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const result: AdminPackageDetail = {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    iconColor: pkg.iconColor,
    isActive: pkg.isActive,
    isIfs: pkg.isIfs,
    courseCount: pkg._count.packageCourses,
    bolumCount: pkg._count.departmentPackages,
    userAssignmentCount: pkg._count.userAssignments,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
    courses: pkg.packageCourses.map((pc) => ({
      id: pc.id,
      courseId: pc.courseId,
      courseTitle: pc.course.title,
      courseDifficulty: pc.course.difficulty,
      order: pc.order,
      isRequired: pc.isRequired,
    })),
    bolums: pkg.departmentPackages.map((dp) => ({
      id: dp.id,
      bolum: dp.bolum,
      createdAt: dp.createdAt.toISOString(),
      dueDate: dp.dueDate?.toISOString() ?? null,
    })),
    userAssignments: pkg.userAssignments.map((ua) => ({
      id: ua.id,
      userId: ua.userId,
      userName: ua.user.name,
      userEmail: ua.user.email,
      assignedAt: ua.assignedAt.toISOString(),
    })),
  };

  return NextResponse.json({ package: result });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  let body: AdminPackageUpdateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.coursePackage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "Paket adı boş olamaz" },
        { status: 400 }
      );
    }
    if (trimmed.length > 200) {
      return NextResponse.json(
        { error: "Paket adı 200 karakterden uzun olamaz" },
        { status: 400 }
      );
    }
    data.name = trimmed;
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }
  if (body.iconColor !== undefined) {
    data.iconColor = body.iconColor?.trim() || null;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.coursePackage.update({ where: { id }, data });

  return NextResponse.json({ package: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.coursePackage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  await prisma.coursePackage.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
