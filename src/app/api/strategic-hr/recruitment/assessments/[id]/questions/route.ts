import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";
import type { AssessmentQuestionType } from "@/generated/prisma";

type SikGirdi = { text: string; isCorrect?: boolean };

// POST — sınava soru + şıkları ekle (admin). Tek transaction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;

  const body = await req.json();
  const { text, type, points, options } = body ?? {};
  const qType = (type as AssessmentQuestionType) ?? "TEK_SECIM";

  if (!text || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "text ve en az 2 şık zorunlu" }, { status: 400 });
  }
  const dogruSayisi = (options as SikGirdi[]).filter((o) => o.isCorrect).length;
  if (dogruSayisi < 1) {
    return NextResponse.json({ error: "En az bir doğru şık işaretlenmeli" }, { status: 400 });
  }
  if (qType !== "COKLU_SECIM" && dogruSayisi > 1) {
    return NextResponse.json(
      { error: "Bu soru tipinde yalnız bir doğru şık olabilir" },
      { status: 400 },
    );
  }

  const sinav = await prisma.candidateAssessment.findUnique({ where: { id }, select: { id: true } });
  if (!sinav) return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });

  // Sıradaki order = mevcut soru sayısı.
  const mevcut = await prisma.assessmentQuestion.count({ where: { assessmentId: id } });

  const soru = await prisma.assessmentQuestion.create({
    data: {
      assessmentId: id,
      type: qType,
      text: String(text),
      points: points != null ? Number(points) : 1,
      order: mevcut,
      options: {
        create: (options as SikGirdi[]).map((o, i) => ({
          text: String(o.text),
          isCorrect: Boolean(o.isCorrect),
          order: i,
        })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(soru, { status: 201 });
}
