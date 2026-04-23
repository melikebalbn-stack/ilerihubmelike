import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  let body: {
    title?: string;
    description?: string;
    type?: "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ";
    duration?: number | null;
    order?: number;
    isActive?: boolean;
    filePath?: string | null;
    fileSize?: number | null;
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
    if (!["VIDEO", "PDF", "DOCUMENT", "QUIZ"].includes(body.type)) {
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

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  const updated = await prisma.content.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    message: "İçerik güncellendi",
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  const existing = await prisma.content.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  await prisma.content.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({
    id,
    message: "İçerik pasif duruma alındı",
  });
}
