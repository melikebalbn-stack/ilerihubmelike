import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { canViewJobAppSensitive, maskTc } from "@/lib/job-application/hr-access";

export const dynamic = "force-dynamic";

// GET /api/job-application/[id]/consent — İK: KVKK onay kaydı (dijital imza).
// Rol-gate (VIEW_ROLES). TC varsayılan MASKELİ; ?unmask=true + rol ile açık.
// Her başarılı görüntüleme accessLog'a yazılır (VIEW_CONSENT / UNMASK_CONSENT).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await requireUser();
    if (error) return error;
    if (!canViewJobAppSensitive(user.role)) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const consent = await prisma.jobApplicationConsent.findUnique({
      where: { applicationId: id },
    });
    if (!consent) {
      return NextResponse.json({ consent: null });
    }

    const unmask = request.nextUrl.searchParams.get("unmask") === "true";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await prisma.jobApplicationAccessLog.create({
      data: {
        applicationId: id,
        accessedBy: user.id,
        accessType: unmask ? "UNMASK_CONSENT" : "VIEW_CONSENT",
        ipAddress,
      },
    });

    return NextResponse.json({
      consent: {
        adSoyad: consent.adSoyad,
        tcKimlikNo: unmask ? consent.tcKimlikNo : maskTc(consent.tcKimlikNo),
        documentCode: consent.documentCode,
        documentRev: consent.documentRev,
        consentTextHash: consent.consentTextHash,
        signedAt: consent.signedAt,
        signatureImage: consent.signatureImage,
        ipAddress: consent.ipAddress,
      },
    });
  } catch (err) {
    console.error("[job-application/[id]/consent] hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu" }, { status: 500 });
  }
}
