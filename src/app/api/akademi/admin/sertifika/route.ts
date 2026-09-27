import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

// GET - Yönetici: bir kullanıcının bir kurstaki sertifikasına yönlendir (Bitti|Sertifika).
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const courseId = searchParams.get("courseId");
  if (!userId || !courseId) {
    return NextResponse.json({ error: "userId ve courseId zorunlu" }, { status: 400 });
  }

  const cert = await prisma.akademiCertificate.findFirst({
    where: { userId, courseId },
    select: { filePath: true, verificationCode: true },
    orderBy: { issuedAt: "desc" },
  });

  if (cert?.filePath) {
    // Dosya paylaşımlı uploads'tan servis edilir (public/uploads symlink).
    return NextResponse.redirect(new URL(cert.filePath, request.url));
  }
  if (cert?.verificationCode) {
    // Dosya henüz yoksa doğrulama sayfasına yönlendir.
    return NextResponse.redirect(new URL(`/akademi/verify/${cert.verificationCode}`, request.url));
  }
  return NextResponse.json({ error: "Bu kullanıcı için sertifika bulunamadı" }, { status: 404 });
}
