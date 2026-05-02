import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { generateCertificatePdf } from "@/lib/akademi/certificate-pdf";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { id } = await params;

  const cert = await prisma.akademiCertificate.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  if (!cert) {
    return NextResponse.json({ error: "Sertifika bulunamadı" }, { status: 404 });
  }

  try {
    const pdfPath = await generateCertificatePdf({
      certificateNo: cert.certificateNo,
      verificationCode: cert.verificationCode,
      userName: cert.user.name || cert.user.email,
      courseName: cert.course?.title ?? "Kurs",
      issuedAt: cert.issuedAt,
      validUntil: cert.validUntil,
      templateId: cert.templateId,
    });
    await prisma.akademiCertificate.update({
      where: { id },
      data: { filePath: pdfPath },
    });
    return NextResponse.json({ ok: true, filePath: pdfPath });
  } catch (e) {
    console.error("[regenerate-pdf] failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "PDF üretimi başarısız", detail },
      { status: 500 }
    );
  }
}
