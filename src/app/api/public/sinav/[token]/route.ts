import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  PUBLIC_SINAV_HEADERS,
  getClientIp,
  invalidSinavResponse,
  logAttempt,
} from "@/lib/assessment/public";

const GUN_MS = 60 * 1000;
const TERMINAL = new Set(["TAMAMLANDI", "SURESI_DOLDU", "IPTAL"]);

// GET /api/public/sinav/[token] — aday sınav yüzeyi (PUBLIC, auth yok).
// Tüm yetki TOKEN'dan türetilir. Doğru cevaplar (isCorrect) ASLA dönmez.
// Kişisel veri: YALNIZ fullName. Zaman sunucuda.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);

  // Rate-limit: token deneme brute-force'a karşı IP bazlı 10/dk.
  const rl = checkRateLimit(`sinav-get:${ip}`, { windowMs: GUN_MS, maxAttempts: 10 });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Çok fazla deneme. ${rl.resetIn} sn sonra tekrar deneyin.` },
      { status: 429, headers: PUBLIC_SINAV_HEADERS },
    );
  }

  const { token } = await params;
  if (!token || typeof token !== "string") {
    await logAttempt("INVALID_TOKEN", ip, null);
    return invalidSinavResponse();
  }

  const oturum = await prisma.assessmentSession.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      startedAt: true,
      assessment: {
        select: {
          name: true,
          durationMin: true,
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              text: true,
              order: true,
              type: true,
              // isCorrect ASLA seçilmez — yalnız görünür alanlar.
              options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } },
            },
          },
        },
      },
      publicJobApplication: { select: { fullName: true } },
    },
  });

  if (!oturum) {
    await logAttempt("INVALID_TOKEN", ip, null);
    return invalidSinavResponse();
  }

  const now = Date.now();

  // Terminal statü → uniform hata (ayırt edilmez).
  if (TERMINAL.has(oturum.status)) {
    await logAttempt("ALREADY_DONE", ip, oturum.id);
    return invalidSinavResponse();
  }

  // Süre geçmiş (72h) → SURESI_DOLDU yaz + uniform hata.
  if (now > oturum.expiresAt.getTime()) {
    await prisma.assessmentSession.update({
      where: { id: oturum.id },
      data: { status: "SURESI_DOLDU" },
    });
    await logAttempt("EXPIRED", ip, oturum.id);
    return invalidSinavResponse();
  }

  // İlk açılış: ATANDI → BASLADI + startedAt (sunucu saati). Zaten BASLADI ise EZME.
  let startedAt = oturum.startedAt;
  if (oturum.status === "ATANDI" || !startedAt) {
    startedAt = new Date(now);
    await prisma.assessmentSession.update({
      where: { id: oturum.id },
      data: { status: "BASLADI", startedAt },
    });
  }

  // Süre limiti sunucuda: startedAt + durationMin. Aşılmışsa TIMEOUT → SURESI_DOLDU.
  const bitis = startedAt.getTime() + oturum.assessment.durationMin * 60 * 1000;
  if (now > bitis) {
    await prisma.assessmentSession.update({
      where: { id: oturum.id },
      data: { status: "SURESI_DOLDU" },
    });
    await logAttempt("TIMEOUT", ip, oturum.id);
    return invalidSinavResponse();
  }
  const kalanSaniye = Math.max(0, Math.floor((bitis - now) / 1000));

  await logAttempt("OPEN", ip, oturum.id);

  return NextResponse.json(
    {
      assessmentName: oturum.assessment.name,
      durationMin: oturum.assessment.durationMin,
      kalanSaniye,
      adayAdi: oturum.publicJobApplication.fullName,
      sorular: oturum.assessment.questions.map((q) => ({
        id: q.id,
        text: q.text,
        order: q.order,
        type: q.type,
        secenekler: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
      })),
    },
    { headers: PUBLIC_SINAV_HEADERS },
  );
}
