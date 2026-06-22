import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import type { AdminCourseCreateInput } from "@/types/akademi-admin";

// PR-1: server-side arama/sıralama/filtre/sayfalama (Kurslar sekmesi).
const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  status: z.enum(["active", "passive", "all"]).default("active"),
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  type: z.enum(["normal", "ifs", "all"]).default("normal"),
  sortBy: z
    .enum([
      "title",
      "category",
      "difficulty",
      "duration",
      "content",
      "assignment",
      "status",
    ])
    .default("title"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function buildOrderBy(
  sortBy: z.infer<typeof listQuerySchema>["sortBy"],
  order: "asc" | "desc"
): Prisma.CourseOrderByWithRelationInput {
  switch (sortBy) {
    case "category":
      return { category: order };
    case "difficulty":
      return { difficulty: order };
    case "duration":
      return { duration: order };
    case "content":
      return { contents: { _count: order } };
    case "assignment":
      return { directAssignments: { _count: order } };
    case "status":
      return { isActive: order };
    case "title":
    default:
      return { title: order };
  }
}

const courseInclude = {
  _count: {
    select: {
      contents: { where: { isActive: true } },
      directAssignments: true,
    },
  },
} satisfies Prisma.CourseInclude;

function toItem(
  c: Prisma.CourseGetPayload<{ include: typeof courseInclude }>
) {
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? "",
    thumbnail: c.thumbnail,
    category: c.category,
    difficulty: c.difficulty,
    duration: c.duration,
    isActive: c.isActive,
    isIfs: c.isIfs,
    contentCount: c._count.contents,
    assignmentCount: c._count.directAssignments,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission("akademi.kurs.edit");
  if (error) return error;

  const sp = req.nextUrl.searchParams;

  // ── Legacy mod (geriye uyum): `page` param yoksa eski {courses} şekli.
  // Bu endpoint'i kullanan diğer ekranlar (picker, atamalar, sınavlar, IFS
  // eğitim, modal) AYNEN çalışmaya devam eder.
  if (!sp.has("page")) {
    const includeInactive = sp.get("includeInactive") === "true";
    const courses = await prisma.course.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: courseInclude,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ courses: courses.map(toItem) });
  }

  // ── Yeni paginated mod (Kurslar sekmesi).
  const parsed = listQuerySchema.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const q = parsed.data;

  const where: Prisma.CourseWhereInput = {
    ...(q.status === "all" ? {} : { isActive: q.status === "active" }),
    ...(q.type === "all" ? {} : { isIfs: q.type === "ifs" }),
    ...(q.category ? { category: q.category } : {}),
    ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    ...(q.search
      ? { title: { contains: q.search, mode: "insensitive" } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: courseInclude,
      orderBy: buildOrderBy(q.sortBy, q.order),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return NextResponse.json({
    items: rows.map(toItem),
    total,
    page: q.page,
    pageSize: q.pageSize,
    pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("akademi.kurs.create");
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
      // contextual: yalnız "Yeni IFS Kursu" akışı true → IFS Eğitimleri'ne düşer.
      isIfs: body.isIfs ?? false,
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
