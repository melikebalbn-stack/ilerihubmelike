import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";

// DELETE — soruyu sil (admin). Şıklar Cascade ile gider.
// Cevaplanmış oturum varsa engelle (puanlama bütünlüğü).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { id, questionId } = await params;

  const soru = await prisma.assessmentQuestion.findFirst({
    where: { id: questionId, assessmentId: id },
    select: { id: true },
  });
  if (!soru) return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });

  const cevapSayisi = await prisma.assessmentAnswer.count({ where: { questionId } });
  if (cevapSayisi > 0) {
    return NextResponse.json(
      { error: "Bu soru cevaplanmış oturumlarda kullanılmış; silinemez." },
      { status: 409 },
    );
  }

  await prisma.assessmentQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
