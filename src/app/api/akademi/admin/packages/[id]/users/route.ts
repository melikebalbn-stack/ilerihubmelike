import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { materializePackage } from "@/lib/akademi-package-materialize";
import { notifyPackageAssignedBatch } from "@/lib/akademi-notify";
import type { AdminPackageUsersAddInput } from "@/types/akademi-package";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
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

  const requested = body.userIds.filter((uid) => validIds.has(uid));

  // İstek ÖNCESİ zaten direct atanmış kullanıcılar (idempotency: yalnız bu
  // istekte gerçekten yeni atananlara bildirim gider).
  const priorDirect = await prisma.userPackageAssignment.findMany({
    where: { packageId: id, userId: { in: requested } },
    select: { userId: true },
  });
  const priorSet = new Set(priorDirect.map((p) => p.userId));

  const created = await prisma.userPackageAssignment.createMany({
    data: requested.map((userId) => ({ userId, packageId: id })),
    skipDuplicates: true,
  });

  const materializeResult = await materializePackage(id);

  // Bildirim — yalnız bu istekte YENİ atanan kullanıcılar (alıcı=user, batch,
  // fire-and-forget: HTTP yanıtını kilitleme).
  const newUserIds = requested.filter((uid) => !priorSet.has(uid));
  if (newUserIds.length > 0) {
    void notifyPackageAssignedBatch(newUserIds, {
      packageName: pkg.name,
      courseCount: materializeResult.courseCount,
      link: "/akademi",
    }).catch(() => {});
  }

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
