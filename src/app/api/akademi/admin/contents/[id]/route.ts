import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { hardDeleteContent } from "@/lib/akademi/hard-delete";
import { logAuditEvent } from "@/lib/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  let body: {
    title?: string;
    description?: string;
    type?: "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ" | "GOREV";
    duration?: number | null;
    order?: number;
    isActive?: boolean;
    filePath?: string | null;
    fileSize?: number | null;
    // IFS-3b: yalnız type=GOREV'de gelir (IfsTaskMeta upsert).
    ifsMeta?: {
      modul?: string | null;
      altModul?: string | null;
      ifsEkran?: string | null;
      refDocUrl?: string | null;
      refVideoUrl?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const t = body.title.trim();
    if (t.length < 2 || t.length > 200) {
      return NextResponse.json(
        { error: "Başlık 2-200 karakter arası olmalı" },
        { status: 400 }
      );
    }
    data.title = t;
  }

  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }

  if (body.type !== undefined) {
    if (!["VIDEO", "PDF", "DOCUMENT", "QUIZ", "GOREV"].includes(body.type)) {
      return NextResponse.json({ error: "Geçersiz tip" }, { status: 400 });
    }
    data.type = body.type;
  }

  if (body.duration !== undefined) {
    data.duration =
      body.duration != null && body.duration > 0
        ? Math.floor(body.duration)
        : null;
  }

  if (body.order !== undefined && body.order >= 0) {
    data.order = Math.floor(body.order);
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (body.filePath !== undefined) {
    data.filePath = body.filePath?.trim() || null;
  }

  if (body.fileSize !== undefined) {
    data.fileSize =
      body.fileSize != null && body.fileSize > 0
        ? Math.floor(body.fileSize)
        : null;
  }

  const resultType = body.type ?? existing.type;
  const hasIfsMeta = resultType === "GOREV" && body.ifsMeta != null;
  const hasContentChanges = Object.keys(data).length > 0;

  if (!hasContentChanges && !hasIfsMeta) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  const updated = hasContentChanges
    ? await prisma.content.update({ where: { id }, data })
    : existing;

  // IFS-3b: GOREV içeriklerde IfsTaskMeta upsert (contentId @unique). Diğer
  // tiplerde dokunulmaz (additive — mevcut akış bozulmaz).
  if (hasIfsMeta) {
    const m = body.ifsMeta!;
    const clean = (v: string | null | undefined) => v?.trim() || null;
    const metaData = {
      modul: clean(m.modul),
      altModul: clean(m.altModul),
      ifsEkran: clean(m.ifsEkran),
      refDocUrl: clean(m.refDocUrl),
      refVideoUrl: clean(m.refVideoUrl),
    };
    await prisma.ifsTaskMeta.upsert({
      where: { contentId: id },
      create: { contentId: id, ...metaData },
      update: metaData,
    });
  }

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    message: "İçerik güncellendi",
  });
}

// HARD DELETE — içerik ve bağımlıları (ContentProgress/IfsTaskEvaluation/
// IfsTaskMeta) kalıcı silinir. Pasifleştirme ayrı PATCH ile.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  const existing = await prisma.content.findUnique({
    where: { id },
    select: { id: true, title: true, courseId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  const counts = await prisma.$transaction((tx) => hardDeleteContent(tx, id));

  await logAuditEvent({
    action: "AKADEMI_CONTENT_HARD_DELETED",
    actorId: session.user.id,
    targetType: "AKADEMI_CONTENT",
    targetId: id,
    details: { title: existing.title, courseId: existing.courseId, ...counts },
  });

  return NextResponse.json({
    id,
    message: "İçerik kalıcı silindi",
    deleted: counts,
  });
}
