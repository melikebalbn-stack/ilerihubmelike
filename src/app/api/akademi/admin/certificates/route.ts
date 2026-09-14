import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseAkademiType, viaOptionalCourseWhere } from "@/lib/akademi/admin-type-filter";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const courseId = searchParams.get("courseId");
  const missingPdf = searchParams.get("missingPdf") === "true";
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  const { type, error: typeError } = parseAkademiType(searchParams);
  if (typeError) return typeError;

  // AND: viaOptionalCourseWhere kendi OR'unu taşır, arama OR'u ile çakışmasın.
  const where: Prisma.AkademiCertificateWhereInput = {
    AND: [viaOptionalCourseWhere(type)],
  };
  if (search) {
    where.OR = [
      { certificateNo: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { course: { title: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (courseId) where.courseId = courseId;
  if (missingPdf) where.filePath = null;

  const certs = await prisma.akademiCertificate.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
      _count: { select: { downloads: true, verifications: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ certificates: certs });
}
