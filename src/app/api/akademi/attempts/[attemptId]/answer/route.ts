import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { QuestionType, Prisma } from "@/generated/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const questionId =
    typeof body.questionId === "string" ? body.questionId : null;
  if (!questionId) {
    return NextResponse.json(
      { error: "questionId zorunlu" },
      { status: 400 }
    );
  }

  const attempt = await prisma.userExamAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      examId: true,
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (attempt.userId !== userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Bu sınav artık aktif değil" },
      { status: 400 }
    );
  }
  if (attempt.expiresAt && new Date(attempt.expiresAt) < new Date()) {
    await prisma.userExamAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "Süre doldu" }, { status: 400 });
  }

  const q = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!q || q.examId !== attempt.examId) {
    return NextResponse.json(
      { error: "Soru bu sınava ait değil" },
      { status: 400 }
    );
  }

  const data: {
    attemptId: string;
    questionId: string;
    optionId: string | null;
    selectedOptionIds: string[];
    textAnswer: string | null;
    ratingValue: number | null;
    scaleValue: number | null;
    dateValue: Date | null;
    matrixAnswer?: Record<string, number> | typeof Prisma.JsonNull;
  } = {
    attemptId,
    questionId,
    optionId: null,
    selectedOptionIds: [],
    textAnswer: null,
    ratingValue: null,
    scaleValue: null,
    dateValue: null,
  };

  switch (q.type) {
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.TRUE_FALSE:
    case QuestionType.YES_NO:
    case QuestionType.DROPDOWN:
      data.optionId =
        typeof body.optionId === "string" ? body.optionId : null;
      break;
    case QuestionType.MULTIPLE_CHOICE:
      data.selectedOptionIds = Array.isArray(body.selectedOptionIds)
        ? (body.selectedOptionIds as unknown[]).filter(
            (s): s is string => typeof s === "string"
          )
        : [];
      break;
    case QuestionType.TEXT_SHORT:
    case QuestionType.TEXT_LONG:
      data.textAnswer = body.textAnswer
        ? (body.textAnswer as string).toString()
        : null;
      break;
    case QuestionType.RATING: {
      const rv =
        body.ratingValue !== null && body.ratingValue !== undefined
          ? Number(body.ratingValue)
          : null;
      if (rv !== null && (!Number.isFinite(rv) || rv < 1 || rv > 5)) {
        return NextResponse.json(
          { error: "Rating 1-5 arası olmalı" },
          { status: 400 }
        );
      }
      data.ratingValue = rv;
      break;
    }
    case QuestionType.SCALE: {
      const sv =
        body.scaleValue !== null && body.scaleValue !== undefined
          ? Number(body.scaleValue)
          : null;
      if (sv !== null && (!Number.isFinite(sv) || sv < 1 || sv > 10)) {
        return NextResponse.json(
          { error: "Scale 1-10 arası olmalı" },
          { status: 400 }
        );
      }
      data.scaleValue = sv;
      break;
    }
    case QuestionType.DATE:
      data.dateValue = body.dateValue
        ? new Date(body.dateValue as string)
        : null;
      if (data.dateValue && isNaN(data.dateValue.getTime())) {
        return NextResponse.json(
          { error: "Geçersiz tarih" },
          { status: 400 }
        );
      }
      break;
    case QuestionType.MATRIX: {
      // matrixAnswer: { rowIndex (string): colIndex (number) }
      const raw = body.matrixAnswer;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (Number.isInteger(Number(k)) && Number.isInteger(Number(v))) {
            cleaned[String(Number(k))] = Number(v);
          }
        }
        data.matrixAnswer = cleaned;
      } else {
        data.matrixAnswer = Prisma.JsonNull;
      }
      break;
    }
    case QuestionType.FILE_UPLOAD:
      // FILE_UPLOAD ayrı endpoint kullanıyor (/upload)
      return NextResponse.json(
        {
          error:
            "FILE_UPLOAD soruları için /api/akademi/attempts/[attemptId]/upload endpoint'ini kullanın",
        },
        { status: 400 }
      );
    default:
      return NextResponse.json(
        { error: "Bu soru tipi desteklenmiyor" },
        { status: 400 }
      );
  }

  const existing = await prisma.userExamAnswer.findFirst({
    where: { attemptId, questionId },
    select: { id: true },
  });

  if (existing) {
    await prisma.userExamAnswer.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.userExamAnswer.create({ data });
  }

  return NextResponse.json({ ok: true });
}
