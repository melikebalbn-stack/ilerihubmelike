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
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.YES_NO,
];

type IncomingOption = { text?: unknown; isCorrect?: unknown };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  const questions = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ questions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;
  const { examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const question = ((body.question ?? "") as string).toString().trim();
  if (question.length < 3) {
    return NextResponse.json(
      { error: "Soru metni en az 3 karakter olmalı" },
      { status: 400 }
    );
  }

  const type = body.type as QuestionType;
  if (!SUPPORTED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Desteklenmeyen soru tipi" },
      { status: 400 }
    );
  }

  const points = Number(body.points ?? 1);
  if (!Number.isFinite(points) || points <= 0 || points > 100) {
    return NextResponse.json(
      { error: "Puan 1-100 arası olmalı" },
      { status: 400 }
    );
  }

  const explanation = body.explanation
    ? (body.explanation as string).toString().trim()
    : null;

  const options: IncomingOption[] = Array.isArray(body.options)
    ? (body.options as IncomingOption[])
    : [];

  if (OPTION_BASED_TYPES.includes(type)) {
    if (type === QuestionType.TRUE_FALSE && options.length !== 2) {
      return NextResponse.json(
        { error: "Doğru/Yanlış sorusunda tam 2 seçenek olmalı" },
        { status: 400 }
      );
    }
    if (type === QuestionType.YES_NO && options.length !== 2) {
      return NextResponse.json(
        { error: "Evet/Hayır sorusunda tam 2 seçenek olmalı" },
        { status: 400 }
      );
    }
    if (
      (type === QuestionType.SINGLE_CHOICE ||
        type === QuestionType.MULTIPLE_CHOICE) &&
      options.length < 2
    ) {
      return NextResponse.json(
        { error: "En az 2 seçenek gerekli" },
        { status: 400 }
      );
    }

    if (AUTO_TYPES.includes(type)) {
      const correctCount = options.filter((o) => Boolean(o.isCorrect)).length;
      if (
        (type === QuestionType.SINGLE_CHOICE ||
          type === QuestionType.TRUE_FALSE) &&
        correctCount !== 1
      ) {
        return NextResponse.json(
          { error: "Tam 1 doğru cevap işaretli olmalı" },
          { status: 400 }
        );
      }
      if (type === QuestionType.MULTIPLE_CHOICE && correctCount < 1) {
        return NextResponse.json(
          { error: "En az 1 doğru cevap işaretli olmalı" },
          { status: 400 }
        );
      }
    }
  }

  const last = await prisma.examQuestion.findFirst({
    where: { examId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const isManualGraded = !AUTO_TYPES.includes(type);

  const created = await prisma.examQuestion.create({
    data: {
      examId,
      question,
      type,
      points,
      order: nextOrder,
      explanation,
      isManualGraded,
      options: OPTION_BASED_TYPES.includes(type)
        ? {
            create: options.map((o, idx) => ({
              text:
                ((o.text ?? "") as string).toString().trim() ||
                `Seçenek ${idx + 1}`,
              isCorrect: AUTO_TYPES.includes(type)
                ? Boolean(o.isCorrect)
                : false,
              order: idx + 1,
            })),
          }
        : undefined,
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ question: created }, { status: 201 });
}
