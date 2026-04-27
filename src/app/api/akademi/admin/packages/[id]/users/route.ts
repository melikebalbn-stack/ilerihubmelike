import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";
import { materializePackage } from "@/lib/akademi-package-materialize";
import type { AdminPackageUsersAddInput } from "@/types/akademi-package";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;

  let body: AdminPackageUsersAddInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    return NextResponse.json({ error: "userIds boş olamaz" }, { status: 400 });
  }

  const pkg = await prisma.coursePackage.findUnique({ where: { id } });
  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const validUsers = await prisma.user.findMany({
    where: { id: { in: body.userIds } },
    select: { id: true },
  });
  const validIds = new Set(validUsers.map((u) => u.id));

  const created = await prisma.userPackageAssignment.createMany({
    data: body.userIds
      .filter((uid) => validIds.has(uid))
      .map((userId) => ({ userId, packageId: id })),
    skipDuplicates: true,
  });

  const materializeResult = await materializePackage(id);

  return NextResponse.json({
    success: true,
    count: created.count,
    materialize: {
      courseCount: materializeResult.courseCount,
      targetUserCount: materializeResult.targetUserCount,
      newAssignments: materializeResult.newAssignments,
      skippedExisting: materializeResult.skippedExisting,
      errors: materializeResult.errors,
    },
  });
}
