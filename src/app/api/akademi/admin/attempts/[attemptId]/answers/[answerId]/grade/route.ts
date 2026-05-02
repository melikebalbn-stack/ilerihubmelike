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

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"attempt:" + attemptId}))`;

    const answer = await tx.userExamAnswer.findUnique({
      where: { id: answerId },
      include: { question: true },
    });

    if (!answer) {
      return { ok: false as const, status: 404, error: "Cevap bulunamadı" };
    }
    if (answer.attemptId !== attemptId) {
      return {
        ok: false as const,
        status: 400,
        error: "Cevap bu attempt'e ait değil",
      };
    }
    if (!answer.question.isManualGraded) {
      return {
        ok: false as const,
        status: 400,
        error: "Bu soru otomatik puanlanır, manuel grade yapılamaz",
      };
    }
    if (score > answer.question.points) {
      return {
        ok: false as const,
        status: 400,
        error: `Puan ${answer.question.points}'i geçemez (sorunun max puanı)`,
      };
    }

    const attempt = await tx.userExamAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true },
    });
    if (!attempt) {
      return { ok: false as const, status: 404, error: "Attempt bulunamadı" };
    }
    if (attempt.status !== "PENDING_REVIEW") {
      return {
        ok: false as const,
        status: 400,
        error: "Bu attempt grade edilebilir durumda değil",
      };
    }

    const updated = await tx.userExamAnswer.update({
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

    return { ok: true as const, answer: updated };
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, answer: result.answer });
}
