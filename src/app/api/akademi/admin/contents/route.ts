import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const courseId = req.nextUrl.searchParams.get("courseId");
  if (!courseId) {
    return NextResponse.json({ error: "courseId gerekli" }, { status: 400 });
  }

  const contents = await prisma.content.findMany({
    where: { courseId },
    orderBy: [{ isActive: "desc" }, { order: "asc" }],
    include: { ifsMeta: true },
  });

  return NextResponse.json({
    contents: contents.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      title: c.title,
      description: c.description,
      type: c.type,
      filePath: c.filePath,
      fileUrl: c.fileUrl,
      duration: c.duration,
      fileSize: c.fileSize,
      order: c.order,
      isActive: c.isActive,
      ifsMeta: c.ifsMeta
        ? {
            modul: c.ifsMeta.modul,
            altModul: c.ifsMeta.altModul,
            ifsEkran: c.ifsMeta.ifsEkran,
            refDocUrl: c.ifsMeta.refDocUrl,
            refVideoUrl: c.ifsMeta.refVideoUrl,
          }
        : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  let body: {
    courseId: string;
    title: string;
    description?: string;
    type: "VIDEO" | "PDF" | "DOCUMENT" | "QUIZ" | "GOREV";
    duration?: number | null;
    filePath?: string | null;
    fileSize?: number | null;
    // IFS-3b: yalnız type=GOREV'de gelir (IfsTaskMeta).
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

  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Kurs gerekli" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title || title.length < 2) {
    return NextResponse.json(
      { error: "Başlık en az 2 karakter olmalı" },
      { status: 400 }
    );
  }
  if (title.length > 200) {
    return NextResponse.json(
      { error: "Başlık en fazla 200 karakter olmalı" },
      { status: 400 }
    );
  }

  if (!["VIDEO", "PDF", "DOCUMENT", "QUIZ", "GOREV"].includes(body.type)) {
    return NextResponse.json({ error: "Geçersiz içerik tipi" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Kurs bulunamadı" }, { status: 404 });
  }

  const maxOrder = await prisma.content.aggregate({
    where: { courseId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const duration =
    body.duration != null && body.duration > 0 ? Math.floor(body.duration) : null;

  const fileSize =
    body.fileSize != null && body.fileSize > 0 ? Math.floor(body.fileSize) : null;

  const isGorev = body.type === "GOREV";
  const m = body.ifsMeta ?? {};
  const clean = (v: string | null | undefined) => v?.trim() || null;

  const content = await prisma.content.create({
    data: {
      courseId,
      title,
      description: body.description?.trim() || null,
      type: body.type,
      // GOREV görevinin kendi dosyası yoktur; filePath/fileSize null.
      filePath: isGorev ? null : body.filePath?.trim() || null,
      duration: isGorev ? null : duration,
      fileSize: isGorev ? null : fileSize,
      order: nextOrder,
      isActive: true,
      ...(isGorev
        ? {
            ifsMeta: {
              create: {
                modul: clean(m.modul),
                altModul: clean(m.altModul),
                ifsEkran: clean(m.ifsEkran),
                refDocUrl: clean(m.refDocUrl),
                refVideoUrl: clean(m.refVideoUrl),
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json(
    {
      id: content.id,
      title: content.title,
      order: content.order,
      message: "İçerik oluşturuldu",
    },
    { status: 201 }
  );
}
