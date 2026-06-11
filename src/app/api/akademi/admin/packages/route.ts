import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type {
  AdminPackageCreateInput,
  AdminPackageListItem,
} from "@/types/akademi-package";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const includeInactive =
    req.nextUrl.searchParams.get("includeInactive") === "true";

  const packages = await prisma.coursePackage.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: {
        select: {
          packageCourses: true,
          departmentPackages: true,
          userAssignments: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  const result: AdminPackageListItem[] = packages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    iconColor: p.iconColor,
    coverImageUrl: p.coverImageUrl,
    isActive: p.isActive,
    isIfs: p.isIfs,
    courseCount: p._count.packageCourses,
    bolumCount: p._count.departmentPackages,
    userAssignmentCount: p._count.userAssignments,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ packages: result });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  let body: AdminPackageCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Paket adı zorunlu" }, { status: 400 });
  }

  if (body.name.length > 200) {
    return NextResponse.json(
      { error: "Paket adı 200 karakterden uzun olamaz" },
      { status: 400 }
    );
  }

  const created = await prisma.coursePackage.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      iconColor: body.iconColor?.trim() || null,
      coverImageUrl: body.coverImageUrl?.trim() || null,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ package: created }, { status: 201 });
}
