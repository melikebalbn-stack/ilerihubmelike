import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logInitialStage } from "@/lib/recruitment/stage-log";
import { validateConsentInput } from "@/lib/job-application/consent-validation";
import { IK_T_866, ikT866FullText } from "@/content/ik-t-866";
import {
  signDraftToken,
  DRAFT_COOKIE_NAME,
} from "@/lib/job-application/draft-cookie";

// POST /api/job-application/consent — İş başvurusu akışının 1. adımı: KVKK onayı.
// Public (middleware matcher dışında). Taslak başvuru + consent tek transaction'da
// oluşturulur; imzalı httpOnly cookie ile sonraki adımlara taşınır.
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Bot koruması: IP bazlı 5/dk (mevcut rate-limit helper reuse).
    const rl = checkRateLimit(`jobapp-consent:${ip}`, {
      windowMs: 60 * 1000,
      maxAttempts: 5,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: `Çok fazla deneme. ${rl.resetIn} sn sonra tekrar deneyin.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }
    const { adSoyad, tcKimlikNo, consentAccepted, signatureImage } = body as {
      adSoyad?: string;
      tcKimlikNo?: string;
      consentAccepted?: boolean;
      signatureImage?: string;
    };

    // Alan doğrulama (TC algoritması + imza-boş + onay) — saf mantık.
    const valid = validateConsentInput({
      adSoyad,
      tcKimlikNo,
      consentAccepted,
      signatureImage,
    });
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || null;
    // Hash: aydınlatma + muvafakatname birleşimi (tamper-evidence).
    const consentTextHash = crypto
      .createHash("sha256")
      .update(ikT866FullText())
      .digest("hex");

    // Taslak başvuru + consent TEK transaction.
    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.publicJobApplication.create({
        data: {
          fullName: adSoyad!.trim(),
          tcKimlikNo: tcKimlikNo!.trim(),
          status: "CONSENT_PENDING",
          ipAddress: ip,
          userAgent,
        },
        select: { id: true },
      });
      await tx.jobApplicationConsent.create({
        data: {
          applicationId: app.id,
          adSoyad: adSoyad!.trim(),
          tcKimlikNo: tcKimlikNo!.trim(),
          documentCode: IK_T_866.documentCode,
          documentRev: IK_T_866.documentRev,
          consentTextHash,
          signatureImage: signatureImage!,
          ipAddress: ip,
          userAgent,
        },
      });
      // Aşama logu: başlangıç satırı (from=null → CONSENT_PENDING). Public → changedBy null.
      await logInitialStage(tx, { applicationId: app.id, toStatus: "CONSENT_PENDING" });
      return app;
    });

    const res = NextResponse.json({ ok: true }, { status: 201 });
    // İmzalı httpOnly cookie — sonraki adımların taslak referansı.
    res.cookies.set(DRAFT_COOKIE_NAME, signDraftToken(application.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 6, // 6 saat
    });
    return res;
  } catch (error) {
    // JOBAPP_COOKIE_SECRET tanımlı değil → açık hata (sessiz fallback yok).
    const msg =
      error instanceof Error && error.message.includes("JOBAPP_COOKIE_SECRET")
        ? error.message
        : "Sunucu hatası oluştu";
    const status = msg.includes("JOBAPP_COOKIE_SECRET") ? 500 : 500;
    console.error("[job-application/consent] hata:", error);
    return NextResponse.json({ error: msg }, { status });
  }
}
