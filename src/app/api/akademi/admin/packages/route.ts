import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import type {
  AdminPackageCreateInput,
  AdminPackageListItem,
} from "@/types/akademi-package";
import { normalizeReferenceDocs } from "@/lib/akademi-package-docs";

// PR-3: server-side arama/Tür filtresi + sayfalama (Paketler sekmesi).
const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  type: z.enum(["normal", "ifs", "all"]).default("normal"),
  status: z.enum(["active", "passive", "all"]).default("active"),
  sortBy: z.enum(["name", "courseCount", "status"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function buildOrderBy(
  sortBy: z.infer<typeof listQuerySchema>["sortBy"],
  order: "asc" | "desc"
): Prisma.CoursePackageOrderByWithRelationInput {
  switch (sortBy) {
    case "courseCount":
      return { packageCourses: { _count: order } };
    case "status":
      return { isActive: order };
    case "name":
    default:
      return { name: order };
  }
}

const packageInclude = {
  referenceDocs: { orderBy: { sortOrder: "asc" } },
  _count: {
    select: {
      packageCourses: true,
      departmentPackages: true,
      userAssignments: true,
    },
  },
} satisfies Prisma.CoursePackageInclude;

function toItem(
  p: Prisma.CoursePackageGetPayload<{ include: typeof packageInclude }>
): AdminPackageListItem {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    iconColor: p.iconColor,
    coverImageUrl: p.coverImageUrl,
    isActive: p.isActive,
    isIfs: p.isIfs,
    courseCount: p._count.packageCourses,
    bolumCount: p._count.departmentPackages,
    userAssignmentCount: p._count.userAssignments,
    referenceDocs: p.referenceDocs.map((d) => ({
      id: d.id,
      title: d.title,
      fileUrl: d.fileUrl,
      sortOrder: d.sortOrder,
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const sp = req.nextUrl.searchParams;

  // ── Legacy mod (geriye uyum): `page` param yoksa eski {packages} şekli.
  // Endpoint'i kullanan diğer ekranlar (picker'lar, modal, IFS eğitim sekmesi,
  // paket detay) AYNEN çalışmaya devam eder.
  if (!sp.has("page")) {
    const includeInactive = sp.get("includeInactive") === "true";
    const packages = await prisma.coursePackage.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: packageInclude,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ packages: packages.map(toItem) });
  }

  // ── Yeni paginated mod (Paketler sekmesi).
  const parsed = listQuerySchema.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const q = parsed.data;

  const where: Prisma.CoursePackageWhereInput = {
    ...(q.status === "all" ? {} : { isActive: q.status === "active" }),
    ...(q.type === "all" ? {} : { isIfs: q.type === "ifs" }),
    ...(q.search
      ? { name: { contains: q.search, mode: "insensitive" } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.coursePackage.count({ where }),
    prisma.coursePackage.findMany({
      where,
      include: packageInclude,
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
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  let body: AdminPackageCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Paket adı zorunlu" }, { status: 400 });
  }

  if (body.name.length > 200) {
    return NextResponse.json(
      { error: "Paket adı 200 karakterden uzun olamaz" },
      { status: 400 }
    );
  }

  const refDocs = normalizeReferenceDocs(body.referenceDocs);

  const created = await prisma.coursePackage.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      iconColor: body.iconColor?.trim() || null,
      coverImageUrl: body.coverImageUrl?.trim() || null,
      isActive: body.isActive ?? true,
      referenceDocs: refDocs.length ? { create: refDocs } : undefined,
    },
  });

  return NextResponse.json({ package: created }, { status: 201 });
}
