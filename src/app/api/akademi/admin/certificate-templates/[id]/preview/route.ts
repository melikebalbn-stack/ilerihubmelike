import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { generateCertificatePdf } from "@/lib/akademi/certificate-pdf";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;
  const { id } = await params;

  const template = await prisma.akademiCertificateTemplate.findUnique({
    where: { id },
  });
  if (!template) {
    return NextResponse.json(
      { error: "Şablon bulunamadı" },
      { status: 404 }
    );
  }

  const validUntil = template.defaultValidityMonths
    ? new Date(
        Date.now() +
          template.defaultValidityMonths * 30 * 24 * 60 * 60 * 1000
      )
    : null;

  const previewPath = await generateCertificatePdf({
    certificateNo: "CERT-PREVIEW-2026",
    verificationCode: "PREVIEWCODE0",
    userName: "Örnek Kullanıcı",
    courseName: "Şablon Önizlemesi",
    issuedAt: new Date(),
    validUntil,
    templateId: id,
  });

  const fullPath = path.join(process.cwd(), "public", previewPath);
  const fileBuffer = await fs.readFile(fullPath);
  // Geçici preview dosyasını sil — disk dolmasın
  await fs.unlink(fullPath).catch(() => {});

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
