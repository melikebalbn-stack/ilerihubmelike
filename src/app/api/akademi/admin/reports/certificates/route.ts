import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseAkademiType, viaOptionalCourseWhere } from "@/lib/akademi/admin-type-filter";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const expiredOnly = searchParams.get("expiredOnly") === "true";
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  const { type, error: typeError } = parseAkademiType(searchParams);
  if (typeError) return typeError;

  // AND: viaOptionalCourseWhere kendi OR'unu taşır, üstteki OR/courseId ile çakışmasın.
  const where: Prisma.AkademiCertificateWhereInput = {
    AND: [viaOptionalCourseWhere(type)],
  };
  if (courseId) where.courseId = courseId;
  if (expiredOnly) {
    where.validUntil = { lt: new Date() };
  }

  const certs = await prisma.akademiCertificate.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          personnel: { select: { bolum: true } },
        },
      },
      course: { select: { id: true, title: true } },
      _count: { select: { downloads: true, verifications: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: 500,
  });

  const now = new Date();
  const result = certs.map((c) => ({
    id: c.id,
    certificateNo: c.certificateNo,
    verificationCode: c.verificationCode,
    user: {
      id: c.user.id,
      name: c.user.name ?? c.user.email,
      email: c.user.email,
      bolum: c.user.personnel?.bolum ?? null,
    },
    course: c.course,
    issuedAt: c.issuedAt,
    validUntil: c.validUntil,
    expired: c.validUntil ? new Date(c.validUntil) < now : false,
    downloadCount: c._count.downloads,
    verificationCount: c._count.verifications,
  }));

  return NextResponse.json({ certificates: result });
}
