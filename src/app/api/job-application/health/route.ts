import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { updateApplicationStatus } from "@/lib/recruitment/stage-log";
import { verifyConsentedDraft } from "@/lib/job-application/consent-guard";
import { DRAFT_COOKIE_NAME } from "@/lib/job-application/draft-cookie";
import { validateHealthInput } from "@/lib/job-application/health-validation";
import { F13_37 } from "@/content/f13-37-56";

const ITEM_LABEL = new Map(F13_37.maddeler.map((m) => [m.itemNo, m.itemLabel]));

// POST /api/job-application/health — akış 2. adımı: sağlık beyanı (F13.37 + F13.56).
// GUARD: verifyConsentedDraft — KVKK onayı olmayan taslak reddedilir (403).
// Idempotent: aynı taslağa ikinci POST → mevcut kaydı günceller (upsert + item replace).
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rl = checkRateLimit(`jobapp-health:${ip}`, {
      windowMs: 60 * 1000,
      maxAttempts: 5,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: `Çok fazla deneme. ${rl.resetIn} sn sonra tekrar deneyin.` },
        { status: 429 }
      );
    }

    // GUARD: geçerli + KVKK onaylı taslak zorunlu.
    const token = request.cookies.get(DRAFT_COOKIE_NAME)?.value;
    const applicationId = await verifyConsentedDraft(token);
    if (!applicationId) {
      return NextResponse.json(
        { error: "Önce KVKK onayını tamamlamalısınız." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const valid = validateHealthInput(body);
    if (!valid.ok) {
      return NextResponse.json(
        { error: valid.error, eksikItemNo: valid.eksikItemNo },
        { status: 400 }
      );
    }
    const d = valid.data;

    const healthData = {
      gecmisHastalikNotu: d.gecmisHastalikNotu,
      ameliyatOlduMu: d.ameliyatOlduMu,
      ameliyatNotu: d.ameliyatNotu,
      astimSoru1: d.astimSoru1,
      astimSoru1_1: d.astimSoru1_1,
      astimSoru1_2: d.astimSoru1_2,
      astimSoru2: d.astimSoru2,
      astimSoru3: d.astimSoru3,
      astimSoru4: d.astimSoru4,
      astimSoru5: d.astimSoru5,
      astimSoru6: d.astimSoru6,
      astimSoru7: d.astimSoru7,
      dogumTarihi: d.dogumTarihi ? new Date(d.dogumTarihi) : null,
      testTarihi: new Date(), // bugün — sunucu belirler (değiştirilemez)
      cinsiyet: d.cinsiyet,
      telefonGunduz: d.telefonGunduz,
      telefonGece: d.telefonGece,
    };

    await prisma.$transaction(async (tx) => {
      const health = await tx.jobApplicationHealth.upsert({
        where: { applicationId },
        create: { applicationId, ...healthData },
        update: healthData,
      });
      // Idempotent item replace (duplike yok; @@unique zaten korur).
      await tx.jobApplicationHealthItem.deleteMany({ where: { healthId: health.id } });
      await tx.jobApplicationHealthItem.createMany({
        data: d.items.map((it) => ({
          healthId: health.id,
          itemNo: it.itemNo,
          itemLabel: ITEM_LABEL.get(it.itemNo) ?? `Madde ${it.itemNo}`,
          deger: it.deger,
        })),
      });
      // Sonraki aşama: başvuru formu. Tek geçit — status + log aynı tx'te. Public → changedBy null.
      await updateApplicationStatus(tx, { applicationId, toStatus: "HEALTH_PENDING" });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[job-application/health] hata:", error);
    return NextResponse.json({ error: "Sunucu hatası oluştu" }, { status: 500 });
  }
}
