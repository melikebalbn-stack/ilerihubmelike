import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { hardDeleteCourse } from "@/lib/akademi/hard-delete";
import { logAuditEvent } from "@/lib/audit-log";
import type { AdminCourseUpdateInput } from "@/types/akademi-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission("akademi.kurs.edit");
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  let body: AdminCourseUpdateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kurs bulunamadı" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (title.length < 2 || title.length > 200) {
      return NextResponse.json(
        { error: "Başlık 2-200 karakter arası olmalı" },
        { status: 400 }
      );
    }
    data.title = title;
  }

  if (body.description !== undefined) {
    data.description = body.description?.trim() || "";
  }

  if (body.thumbnail !== undefined) {
    data.thumbnail = body.thumbnail?.trim() || null;
  }

  if (body.category !== undefined) {
    data.category = body.category?.trim() || null;
  }

  if (body.difficulty !== undefined) {
    if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(body.difficulty)) {
      return NextResponse.json({ error: "Geçersiz zorluk" }, { status: 400 });
    }
    data.difficulty = body.difficulty;
  }

  if (body.duration !== undefined) {
    data.duration =
      body.duration != null && body.duration > 0
        ? Math.floor(body.duration)
        : null;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  const updated = await prisma.course.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    isActive: updated.isActive,
    message: "Kurs güncellendi",
  });
}

// HARD DELETE — kurs ve TÜM bağımlıları kalıcı silinir (geri alınamaz).
// Pasifleştirme (Aktif toggle) ayrı PATCH ile yapılır; burası kalıcı silme.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission("akademi.kurs.delete");
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({
    where: { id },
    select: { id: true, title: true, isIfs: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kurs bulunamadı" }, { status: 404 });
  }

  const counts = await prisma.$transaction((tx) => hardDeleteCourse(tx, id));

  await logAuditEvent({
    action: "AKADEMI_COURSE_HARD_DELETED",
    actorId: session.user.id,
    targetType: "AKADEMI_COURSE",
    targetId: id,
    details: { title: existing.title, isIfs: existing.isIfs, ...counts },
  });

  return NextResponse.json({
    id,
    message: "Kurs ve tüm bağımlıları kalıcı silindi",
    deleted: counts,
  });
}
