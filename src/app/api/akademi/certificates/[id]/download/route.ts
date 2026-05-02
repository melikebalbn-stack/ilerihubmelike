import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { generateCertificatePdf } from "@/lib/akademi/certificate-pdf";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const cert = await prisma.akademiCertificate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  if (!cert) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (cert.userId !== userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let needsGeneration = !cert.filePath;
  if (cert.filePath) {
    const fullPath = path.join(process.cwd(), "public", cert.filePath);
    try {
      await fs.access(fullPath);
    } catch {
      needsGeneration = true;
    }
  }

  let filePath = cert.filePath;
  if (needsGeneration) {
    const pdfPath = await generateCertificatePdf({
      certificateNo: cert.certificateNo,
      verificationCode: cert.verificationCode,
      userName: cert.user.name || cert.user.email,
      courseName: cert.course?.title ?? "Kurs",
      issuedAt: cert.issuedAt,
    });
    await prisma.akademiCertificate.update({
      where: { id: cert.id },
      data: { filePath: pdfPath },
    });
    filePath = pdfPath;
  }

  const fullPath = path.join(process.cwd(), "public", filePath!);
  const fileBuffer = await fs.readFile(fullPath);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  await prisma.akademiCertificateDownload
    .create({
      data: {
        certificateId: cert.id,
        downloadedAt: new Date(),
        ipAddress: ip,
      },
    })
    .catch((e) => {
      console.error("[cert-download] log fail:", e);
    });

  // Buffer'ı Uint8Array olarak dön (NextResponse Body uyumu için)
  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${cert.certificateNo}.pdf"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
