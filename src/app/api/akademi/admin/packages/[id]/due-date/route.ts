import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { applyPackageDueDate } from "@/lib/akademi-package-materialize";
import { parseDueDateEndOfDay } from "@/lib/akademi/due-date";
import { notifyDueDateSetBatch } from "@/lib/akademi-notify";

// PR-IFS-RAPOR-2a: TOPLU son tarih aracı — paketin kurslarındaki TÜM mevcut
// UserCourseAssignment satırlarına tighten-only uygular (yeni atama oluşturmaz).
const bodySchema = z.object({
  dueDate: z.string().trim().min(1, "Son tarih zorunlu"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission("akademi.kurs.edit");
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

  const { dueDate, error: dueErr } = parseDueDateEndOfDay(parsed.data.dueDate);
  if (dueErr || !dueDate) {
    return NextResponse.json(
      { error: dueErr ?? "Geçersiz tarih" },
      { status: 400 }
    );
  }

  const pkg = await prisma.coursePackage.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const { updated, skipped, packageName, affectedUserIds } =
    await applyPackageDueDate(id, dueDate);

  // PR-IFS-RAPOR-2b: son tarihi yazılan/öne çekilen kullanıcılara mail
  // (fire-and-forget; mail patlarsa tarih yazımı GERİ ALINMAZ).
  if (affectedUserIds.length > 0) {
    void notifyDueDateSetBatch(
      affectedUserIds.map((userId) => ({ userId, dueDate })),
      { packageName }
    ).catch(() => {});
  }

  return NextResponse.json({ updated, skipped });
}
