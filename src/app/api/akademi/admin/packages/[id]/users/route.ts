import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { materializePackage } from "@/lib/akademi-package-materialize";
import { parseDueDateEndOfDay } from "@/lib/akademi/due-date";
import { notifyPackageAssignedBatch } from "@/lib/akademi-notify";

const bodySchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1, "userIds boş olamaz"),
  // PR-IFS-RAPOR-2a: opsiyonel paket son tarihi (bu atama akışına özel).
  dueDate: z.string().trim().nullish(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const { dueDate, error: dueErr } = parseDueDateEndOfDay(body.dueDate);
  if (dueErr) {
    return NextResponse.json({ error: dueErr }, { status: 400 });
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

  // PR-IFS-RAPOR-2a: verilen son tarih bu istekteki kullanıcılara tighten-only
  // taşınır (yeni satırlara yazılır, mevcut satırlar yalnız sıkışır).
  const materializeResult = await materializePackage(id, undefined, {
    overrideDueDate: dueDate,
    overrideUserIds: requested,
  });

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
      dueDateUpdated: materializeResult.dueDateUpdated,
      errors: materializeResult.errors,
    },
  });
}
