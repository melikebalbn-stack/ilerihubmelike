import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";
import { puanla, type SoruDegerlendirme, type CevapGirdi } from "@/lib/assessment/scoring";

// POST — oturuma cevapları gönder ve otomatik puanla (admin).
// Faz 1: İK/test amaçlı. Asıl aday (public token) akışı Faz 2.
// body: { answers: [{ questionId, selectedOptionIds: string[] }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { sessionId } = await params;

  const body = await req.json();
  const answers = (body?.answers ?? []) as CevapGirdi[];
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers dizi olmalı" }, { status: 400 });
  }

  const oturum = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      assessment: {
        select: {
          passingScore: true,
          questions: {
            select: { id: true, points: true, options: { select: { id: true, isCorrect: true } } },
          },
        },
      },
    },
  });
  if (!oturum) return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 404 });
  if (oturum.status === "TAMAMLANDI") {
    return NextResponse.json({ error: "Oturum zaten tamamlanmış" }, { status: 409 });
  }

  const sorular: SoruDegerlendirme[] = oturum.assessment.questions.map((q) => ({
    questionId: q.id,
    points: q.points,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
  }));

  const { cevapSonuclari, yuzde, gecti } = puanla(sorular, answers, oturum.assessment.passingScore);
  const now = new Date();

  // Cevapları tazele + oturumu tamamla (tek transaction).
  await prisma.$transaction([
    prisma.assessmentAnswer.deleteMany({ where: { sessionId } }),
    prisma.assessmentAnswer.createMany({
      data: cevapSonuclari.map((c) => ({
        sessionId,
        questionId: c.questionId,
        selectedOptionIds: c.selectedOptionIds,
        isCorrect: c.isCorrect,
        points: c.points,
      })),
    }),
    prisma.assessmentSession.update({
      where: { id: sessionId },
      data: {
        status: "TAMAMLANDI",
        startedAt: oturum.startedAt ?? now,
        finishedAt: now,
        score: yuzde,
        result: gecti ? "GECTI" : "KALDI",
      },
    }),
  ]);

  return NextResponse.json({ score: yuzde, result: gecti ? "GECTI" : "KALDI" });
}
