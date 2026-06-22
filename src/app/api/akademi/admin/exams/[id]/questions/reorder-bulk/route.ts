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

  let body: { questionIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  if (
    !Array.isArray(body.questionIds) ||
    body.questionIds.length === 0
  ) {
    return NextResponse.json(
      { error: "questionIds[] gerekli" },
      { status: 400 }
    );
  }

  const ids = (body.questionIds as unknown[]).filter(
    (x): x is string => typeof x === "string" && x.length > 0
  );
  if (ids.length !== body.questionIds.length) {
    return NextResponse.json(
      { error: "questionIds geçerli string olmalı" },
      { status: 400 }
    );
  }

  // Aynı ID birden fazla gelmesin
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Aynı ID birden fazla kez gönderildi" },
      { status: 400 }
    );
  }

  const questions = await prisma.examQuestion.findMany({
    where: { examId, id: { in: ids } },
    select: { id: true },
  });

  if (questions.length !== ids.length) {
    return NextResponse.json(
      { error: "Bazı sorular bu sınava ait değil" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    ids.map((id, idx) =>
      prisma.examQuestion.update({
        where: { id },
        data: { order: idx + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true, count: ids.length });
}
