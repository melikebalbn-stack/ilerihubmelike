import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const courseId = searchParams.get("courseId");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (courseId) where.courseId = courseId;

  const exams = await prisma.exam.findMany({
    where,
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ exams });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const title = ((body.title ?? "") as string).toString().trim();
  if (title.length < 3 || title.length > 200) {
    return NextResponse.json(
      { error: "Başlık 3-200 karakter olmalı" },
      { status: 400 }
    );
  }

  const description =
    body.description ? (body.description as string).toString().trim() : null;

  const courseId = body.courseId ? (body.courseId as string).toString() : null;
  if (courseId) {
    const courseExists = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!courseExists) {
      return NextResponse.json(
        { error: "Belirtilen kurs bulunamadı" },
        { status: 400 }
      );
    }
  }

  const passingScore = Number(body.passingScore);
  if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
    return NextResponse.json(
      { error: "Geçme barajı 0-100 arası olmalı" },
      { status: 400 }
    );
  }

  const rawTimeLimit = body.timeLimit;
  const timeLimit =
    rawTimeLimit === null || rawTimeLimit === undefined || rawTimeLimit === ""
      ? null
      : Number(rawTimeLimit);
  if (
    timeLimit !== null &&
    (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 480)
  ) {
    return NextResponse.json(
      { error: "Süre 1-480 dakika arası olmalı (boş bırakılabilir)" },
      { status: 400 }
    );
  }

  const maxAttempts = Number(body.maxAttempts ?? 3);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    return NextResponse.json(
      { error: "Max deneme 1-10 arası olmalı" },
      { status: 400 }
    );
  }

  const isActive = Boolean(body.isActive ?? true);

  const exam = await prisma.exam.create({
    data: {
      title,
      description,
      courseId,
      passingScore,
      timeLimit,
      maxAttempts,
      isActive,
    },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
