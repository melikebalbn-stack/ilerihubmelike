import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { puanla, type SoruDegerlendirme, type CevapGirdi } from "@/lib/assessment/scoring";
import {
  PUBLIC_SINAV_HEADERS,
  getClientIp,
  invalidSinavResponse,
  logAttempt,
} from "@/lib/assessment/public";

const DK_MS = 60 * 1000;
const MAX_ANSWERS = 500; // makul üst sınır (DoS/aşırı payload reddi)
const MAX_OPTS_PER_ANSWER = 50;

function uniformHeaders(status: number, body: object) {
  return NextResponse.json(body, { status, headers: PUBLIC_SINAV_HEADERS });
}

// POST /api/public/sinav/[token]/submit — cevap gönder + SUNUCUDA puanla (PUBLIC).
// Tek-sefer. Zaman/puan yalnız sunucuda. Client'tan puan KABUL EDİLMEZ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req);

  // Rate-limit: submit spam / puan manipülasyonu denemesine karşı IP bazlı 3/dk.
  const rl = checkRateLimit(`sinav-submit:${ip}`, { windowMs: DK_MS, maxAttempts: 3 });
  if (!rl.success) {
    return uniformHeaders(429, { error: `Çok fazla deneme. ${rl.resetIn} sn sonra tekrar deneyin.` });
  }

  const { token } = await params;
  if (!token || typeof token !== "string") {
    await logAttempt("INVALID_TOKEN", ip, null);
    return invalidSinavResponse();
  }

  const body = await req.json().catch(() => null);
  const answers = (body?.answers ?? []) as CevapGirdi[];
  if (!Array.isArray(answers) || answers.length > MAX_ANSWERS) {
    return uniformHeaders(400, { error: "Geçersiz cevap gövdesi." });
  }
  if (answers.some((a) => !a || typeof a.questionId !== "string" ||
      !Array.isArray(a.selectedOptionIds) || a.selectedOptionIds.length > MAX_OPTS_PER_ANSWER)) {
    return uniformHeaders(400, { error: "Geçersiz cevap gövdesi." });
  }

  // Oturum + doğru cevaplar (SUNUCU tarafı; isCorrect client'a hiç gitmez).
  const oturum = await prisma.assessmentSession.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      startedAt: true,
      assessment: {
        select: {
          passingScore: true,
          durationMin: true,
          questions: {
            select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } },
          },
        },
      },
    },
  });

  if (!oturum) {
    await logAttempt("INVALID_TOKEN", ip, null);
    return invalidSinavResponse();
  }
  // Tek-sefer: tamamlanmış oturum tekrar gönderilemez.
  if (oturum.status === "TAMAMLANDI") {
    await logAttempt("ALREADY_DONE", ip, oturum.id);
    return uniformHeaders(409, { error: "Bu sınav zaten tamamlanmış." });
  }
  if (oturum.status === "SURESI_DOLDU" || oturum.status === "IPTAL") {
    await logAttempt("ALREADY_DONE", ip, oturum.id);
    return invalidSinavResponse();
  }

  const now = Date.now();

  // Süre geçmiş (72h) veya sınav süresi (durationMin) aşılmış → SURESI_DOLDU, REDDEDİLİR.
  // (Karar: kısmi puanlama YOK — client deadline'dan önce otomatik gönderir.)
  const sureBitis = oturum.startedAt
    ? oturum.startedAt.getTime() + oturum.assessment.durationMin * DK_MS
    : now; // startedAt yoksa GET hiç açılmamış → geçersiz
  if (now > oturum.expiresAt.getTime() || !oturum.startedAt || now > sureBitis) {
    await prisma.assessmentSession.update({ where: { id: oturum.id }, data: { status: "SURESI_DOLDU" } });
    await logAttempt("TIMEOUT", ip, oturum.id);
    return invalidSinavResponse();
  }

  // VALİDASYON: her questionId TOKEN'ın sınavına ait mi? Şıklar o soruya ait mi?
  const soruMap = new Map(
    oturum.assessment.questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))]),
  );
  for (const a of answers) {
    const opts = soruMap.get(a.questionId);
    if (!opts) {
      return uniformHeaders(400, { error: "Geçersiz soru." }); // başka sınavın sorusu enjekte edilemez
    }
    if (a.selectedOptionIds.some((id) => !opts.has(id))) {
      return uniformHeaders(400, { error: "Geçersiz şık." });
    }
  }

  // SUNUCUDA puanla (scoring.ts). Client'tan puan alınmaz.
  const sorular: SoruDegerlendirme[] = oturum.assessment.questions.map((q) => ({
    questionId: q.id,
    points: q.points,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
  }));
  const { cevapSonuclari, yuzde, gecti } = puanla(sorular, answers, oturum.assessment.passingScore);

  // Tek transaction: cevaplar + oturum kilidi (TAMAMLANDI). Idempotent yeniden yazım.
  await prisma.$transaction([
    prisma.assessmentAnswer.deleteMany({ where: { sessionId: oturum.id } }),
    prisma.assessmentAnswer.createMany({
      data: cevapSonuclari.map((c) => ({
        sessionId: oturum.id,
        questionId: c.questionId,
        selectedOptionIds: c.selectedOptionIds,
        isCorrect: c.isCorrect,
        points: c.points,
      })),
    }),
    prisma.assessmentSession.update({
      where: { id: oturum.id },
      data: {
        status: "TAMAMLANDI",
        finishedAt: new Date(now),
        score: yuzde,
        result: gecti ? "GECTI" : "KALDI",
      },
    }),
  ]);

  await logAttempt("SUBMIT", ip, oturum.id);

  // Adaya puan GÖSTERİLMEZ — yalnız tamamlandı bilgisi.
  return NextResponse.json(
    { ok: true, message: "Sınavınız tamamlandı. Katılımınız için teşekkür ederiz." },
    { headers: PUBLIC_SINAV_HEADERS },
  );
}
