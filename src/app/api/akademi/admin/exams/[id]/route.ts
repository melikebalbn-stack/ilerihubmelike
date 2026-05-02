import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true } },
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ exam });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.exam.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = (body.title as string).toString().trim();
    if (title.length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: "Başlık 3-200 karakter olmalı" },
        { status: 400 }
      );
    }
    data.title = title;
  }

  if (body.description !== undefined) {
    data.description = body.description
      ? (body.description as string).toString().trim()
      : null;
  }

  if (body.courseId !== undefined) {
    const courseId = body.courseId ? (body.courseId as string).toString() : null;
    if (courseId) {
      const c = await prisma.course.findUnique({ where: { id: courseId } });
      if (!c) {
        return NextResponse.json({ error: "Kurs bulunamadı" }, { status: 400 });
      }
    }
    data.courseId = courseId;
  }

  if (body.passingScore !== undefined) {
    const ps = Number(body.passingScore);
    if (!Number.isInteger(ps) || ps < 0 || ps > 100) {
      return NextResponse.json(
        { error: "Geçme barajı 0-100 olmalı" },
        { status: 400 }
      );
    }
    data.passingScore = ps;
  }

  if (body.timeLimit !== undefined) {
    const tl =
      body.timeLimit === null || body.timeLimit === ""
        ? null
        : Number(body.timeLimit);
    if (tl !== null && (!Number.isInteger(tl) || tl < 1 || tl > 480)) {
      return NextResponse.json(
        { error: "Süre 1-480 dakika olmalı" },
        { status: 400 }
      );
    }
    data.timeLimit = tl;
  }

  if (body.maxAttempts !== undefined) {
    const ma = Number(body.maxAttempts);
    if (!Number.isInteger(ma) || ma < 1 || ma > 10) {
      return NextResponse.json(
        { error: "Max deneme 1-10 olmalı" },
        { status: 400 }
      );
    }
    data.maxAttempts = ma;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "En az bir alan güncellenmeli" },
      { status: 400 }
    );
  }

  const updated = await prisma.exam.update({ where: { id }, data });
  return NextResponse.json({ exam: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });

  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  if (exam._count.attempts > 0) {
    return NextResponse.json(
      {
        error: `Bu sınava ${exam._count.attempts} kullanıcı denemesi var, silinemez. Pasif yapın.`,
      },
      { status: 400 }
    );
  }

  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
