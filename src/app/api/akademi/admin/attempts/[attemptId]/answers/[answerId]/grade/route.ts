import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ attemptId: string; answerId: string }> }
) {
  const { session, error } = await requireAkademiAdmin();
  if (error) return error;

  const adminId = await resolveAkademiUserId(session);
  if (!adminId) {
    return NextResponse.json(
      { error: "Admin User.id resolve edilemedi" },
      { status: 500 }
    );
  }

  const { attemptId, answerId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const score = Number(body.score);
  const feedback = body.feedback
    ? (body.feedback as string).toString().trim() || null
    : null;

  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json(
      { error: "Geçerli puan girin (0 veya pozitif)" },
      { status: 400 }
    );
  }

  const answer = await prisma.userExamAnswer.findUnique({
    where: { id: answerId },
    include: { question: true },
  });

  if (!answer) {
    return NextResponse.json({ error: "Cevap bulunamadı" }, { status: 404 });
  }
  if (answer.attemptId !== attemptId) {
    return NextResponse.json(
      { error: "Cevap bu attempt'e ait değil" },
      { status: 400 }
    );
  }
  if (!answer.question.isManualGraded) {
    return NextResponse.json(
      { error: "Bu soru otomatik puanlanır, manuel grade yapılamaz" },
      { status: 400 }
    );
  }
  if (score > answer.question.points) {
    return NextResponse.json(
      {
        error: `Puan ${answer.question.points}'i geçemez (sorunun max puanı)`,
      },
      { status: 400 }
    );
  }

  const attempt = await prisma.userExamAttempt.findUnique({
    where: { id: attemptId },
    select: { status: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt bulunamadı" }, { status: 404 });
  }
  if (attempt.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "Bu attempt grade edilebilir durumda değil" },
      { status: 400 }
    );
  }

  const updated = await prisma.userExamAnswer.update({
    where: { id: answerId },
    data: {
      manualScore: score,
      manualFeedback: feedback,
      gradedById: adminId,
      gradedAt: new Date(),
    },
    include: {
      gradedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ok: true, answer: updated });
}
