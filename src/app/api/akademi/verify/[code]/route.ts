import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 6) {
    return NextResponse.json(
      { valid: false, error: "Geçersiz kod" },
      { status: 400 }
    );
  }

  const cert = await prisma.akademiCertificate.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true } },
      course: { select: { title: true } },
    },
  });

  if (!cert) {
    return NextResponse.json({ valid: false });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  await prisma.akademiCertificateVerification
    .create({
      data: {
        certificateId: cert.id,
        verifiedAt: new Date(),
        ipAddress: ip,
      },
    })
    .catch(() => {
      /* log fail kritik değil */
    });

  return NextResponse.json({
    valid: true,
    certificate: {
      certificateNo: cert.certificateNo,
      userName: cert.user?.name ?? "Bilinmeyen",
      courseName: cert.course?.title ?? "Kurs",
      issuedAt: cert.issuedAt,
    },
  });
}
