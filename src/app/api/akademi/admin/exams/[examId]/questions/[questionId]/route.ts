import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { QuestionType } from "@/generated/prisma";

const SUPPORTED_TYPES: QuestionType[] = [
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.TEXT_SHORT,
  QuestionType.TEXT_LONG,
  QuestionType.RATING,
  QuestionType.SCALE,
  QuestionType.YES_NO,
  QuestionType.DATE,
];

const AUTO_TYPES: QuestionType[] = [
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
];

const OPTION_BASED_TYPES: QuestionType[] = [
  ...AUTO_TYPES,
  QuestionType.YES_NO,
];

type IncomingOption = { text?: unknown; isCorrect?: unknown };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ examId: string; questionId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { questionId } = await params;

  const question = await prisma.examQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!question) {
    return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ question });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string; questionId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { questionId } = await params;

  const existing = await prisma.examQuestion.findUnique({
    where: { id: questionId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.question !== undefined) {
    const q = (body.question as string).toString().trim();
    if (q.length < 3) {
      return NextResponse.json(
        { error: "Soru en az 3 karakter" },
        { status: 400 }
      );
    }
    data.question = q;
  }

  if (body.points !== undefined) {
    const p = Number(body.points);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return NextResponse.json({ error: "Puan 1-100" }, { status: 400 });
    }
    data.points = p;
  }

  if (body.explanation !== undefined) {
    data.explanation = body.explanation
      ? (body.explanation as string).toString().trim()
      : null;
  }

  if (body.type !== undefined) {
    const t = body.type as QuestionType;
    if (!SUPPORTED_TYPES.includes(t)) {
      return NextResponse.json(
        { error: "Desteklenmeyen tip" },
        { status: 400 }
      );
    }
    data.type = t;
    data.isManualGraded = !AUTO_TYPES.includes(t);
  }

  const finalType = (data.type ?? existing.type) as QuestionType;
  const optionsProvided = Array.isArray(body.options);
  const opts: IncomingOption[] = optionsProvided
    ? (body.options as IncomingOption[])
    : [];

  if (optionsProvided && OPTION_BASED_TYPES.includes(finalType)) {
    if (finalType === QuestionType.TRUE_FALSE && opts.length !== 2) {
      return NextResponse.json(
        { error: "Doğru/Yanlış: tam 2 seçenek" },
        { status: 400 }
      );
    }
    if (finalType === QuestionType.YES_NO && opts.length !== 2) {
      return NextResponse.json(
        { error: "Evet/Hayır: tam 2 seçenek" },
        { status: 400 }
      );
    }
    if (
      (finalType === QuestionType.SINGLE_CHOICE ||
        finalType === QuestionType.MULTIPLE_CHOICE) &&
      opts.length < 2
    ) {
      return NextResponse.json(
        { error: "En az 2 seçenek" },
        { status: 400 }
      );
    }
    if (AUTO_TYPES.includes(finalType)) {
      const cc = opts.filter((o) => Boolean(o.isCorrect)).length;
      if (
        (finalType === QuestionType.SINGLE_CHOICE ||
          finalType === QuestionType.TRUE_FALSE) &&
        cc !== 1
      ) {
        return NextResponse.json(
          { error: "Tam 1 doğru cevap" },
          { status: 400 }
        );
      }
      if (finalType === QuestionType.MULTIPLE_CHOICE && cc < 1) {
        return NextResponse.json(
          { error: "En az 1 doğru cevap" },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId } }),
      prisma.examQuestion.update({
        where: { id: questionId },
        data: {
          ...data,
          options: {
            create: opts.map((o, idx) => ({
              text:
                ((o.text ?? "") as string).toString().trim() ||
                `Seçenek ${idx + 1}`,
              isCorrect: AUTO_TYPES.includes(finalType)
                ? Boolean(o.isCorrect)
                : false,
              order: idx + 1,
            })),
          },
        },
      }),
    ]);
  } else if (optionsProvided && !OPTION_BASED_TYPES.includes(finalType)) {
    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId } }),
      prisma.examQuestion.update({ where: { id: questionId }, data }),
    ]);
  } else if (Object.keys(data).length > 0) {
    await prisma.examQuestion.update({ where: { id: questionId }, data });
  }

  const updated = await prisma.examQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ question: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ examId: string; questionId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { questionId } = await params;

  const q = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!q) {
    return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  }

  await prisma.examQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
