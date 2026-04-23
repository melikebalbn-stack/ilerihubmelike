import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";
import type { AdminCourseCreateInput } from "@/types/akademi-admin";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const includeInactive =
    req.nextUrl.searchParams.get("includeInactive") === "true";

  const courses = await prisma.course.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: {
        select: {
          contents: { where: { isActive: true } },
          directAssignments: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      thumbnail: c.thumbnail,
      category: c.category,
      difficulty: c.difficulty,
      duration: c.duration,
      isActive: c.isActive,
      contentCount: c._count.contents,
      assignmentCount: c._count.directAssignments,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  let body: AdminCourseCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
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

  const difficulty = body.difficulty ?? "BEGINNER";
  if (!["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(difficulty)) {
    return NextResponse.json({ error: "Geçersiz zorluk" }, { status: 400 });
  }

  const duration =
    body.duration != null && body.duration > 0 ? Math.floor(body.duration) : null;

  const course = await prisma.course.create({
    data: {
      title,
      description: body.description?.trim() || "",
      thumbnail: body.thumbnail?.trim() || null,
      category: body.category?.trim() || null,
      difficulty,
      duration,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json(
    {
      id: course.id,
      title: course.title,
      message: "Kurs oluşturuldu",
    },
    { status: 201 }
  );
}
