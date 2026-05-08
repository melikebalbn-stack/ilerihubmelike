import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;
  const { id: examId } = await params;

  let body: { questionId?: unknown; direction?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const questionId =
    typeof body.questionId === "string" ? body.questionId : null;
  const direction = body.direction;
  if (!questionId || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ error: "Geçersiz parametre" }, { status: 400 });
  }

  const question = await prisma.examQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question || question.examId !== examId) {
    return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  }

  const neighbor = await prisma.examQuestion.findFirst({
    where: {
      examId,
      order:
        direction === "up"
          ? { lt: question.order }
          : { gt: question.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbor) {
    return NextResponse.json({ ok: true, noChange: true });
  }

  await prisma.$transaction([
    prisma.examQuestion.update({
      where: { id: question.id },
      data: { order: neighbor.order },
    }),
    prisma.examQuestion.update({
      where: { id: neighbor.id },
      data: { order: question.order },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
