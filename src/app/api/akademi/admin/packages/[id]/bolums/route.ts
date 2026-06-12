import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { materializePackage } from "@/lib/akademi-package-materialize";
import { notifyPackageAssignedBatch } from "@/lib/akademi-notify";
import type { AdminPackageBolumsUpdateInput } from "@/types/akademi-package";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;

  let body: AdminPackageBolumsUpdateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.bolums)) {
    return NextResponse.json(
      { error: "bolums bir dizi olmalı" },
      { status: 400 }
    );
  }

  const pkg = await prisma.coursePackage.findUnique({ where: { id } });
  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const cleanBolums = Array.from(
    new Set(body.bolums.map((b) => b.trim()).filter((b) => b.length > 0))
  );

  // Seçili tüm bölümlere uygulanan tek son tarih (opsiyonel). Boş/null = süresiz.
  // Parse pattern'i assignments POST ile aynı (manuel validasyon, Zod yok).
  let dueDate: Date | null = null;
  if (body.dueDate) {
    const parsed = new Date(body.dueDate);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
    }
    dueDate = parsed;
  }

  // Değişiklik ÖNCESİ atanmış bölümler (idempotency: yalnız YENİ eklenen
  // bölümlerin kullanıcılarına bildirim gider; aynı set tekrar yazılırsa hiç).
  const oldBolumRows = await prisma.departmentPackage.findMany({
    where: { packageId: id },
    select: { bolum: true },
  });
  const oldBolums = new Set(oldBolumRows.map((r) => r.bolum));

  await prisma.$transaction([
    prisma.departmentPackage.deleteMany({ where: { packageId: id } }),
    prisma.departmentPackage.createMany({
      data: cleanBolums.map((bolum) => ({ packageId: id, bolum, dueDate })),
    }),
  ]);

  // dueDate, materialize sırasında UserCourseAssignment'lara propagate olur
  // (PR-1 kuralı: yeni atama → dueDate; mevcut → yalnız sıkılaştırma).
  const materializeResult = await materializePackage(id);

  // Bildirim — pakete YENİ kavuşan bölüm kullanıcıları (yeni eklenen bölümler;
  // direct atanmışlar hariç → mükerrer bildirim yok). Alıcı=user, batch, F&F.
  const newBolums = cleanBolums.filter((b) => !oldBolums.has(b));
  if (newBolums.length > 0) {
    const bolumUsers = await prisma.user.findMany({
      where: { isActive: true, personnel: { bolum: { in: newBolums } } },
      select: { id: true },
    });
    const directRows = await prisma.userPackageAssignment.findMany({
      where: { packageId: id },
      select: { userId: true },
    });
    const directSet = new Set(directRows.map((d) => d.userId));
    const newUserIds = bolumUsers
      .map((u) => u.id)
      .filter((uid) => !directSet.has(uid));
    if (newUserIds.length > 0) {
      void notifyPackageAssignedBatch(newUserIds, {
        packageName: pkg.name,
        courseCount: materializeResult.courseCount,
        link: "/akademi",
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    success: true,
    count: cleanBolums.length,
    dueDate: dueDate?.toISOString() ?? null,
    materialize: {
      courseCount: materializeResult.courseCount,
      targetUserCount: materializeResult.targetUserCount,
      newAssignments: materializeResult.newAssignments,
      skippedExisting: materializeResult.skippedExisting,
      errors: materializeResult.errors,
    },
  });
}
