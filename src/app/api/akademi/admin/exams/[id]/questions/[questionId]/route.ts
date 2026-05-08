import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { QuestionType } from "@/generated/prisma";
import {
  SUPPORTED_TYPES,
  AUTO_SCORED_TYPES,
  OPTION_BASED_TYPES,
  isFileUpload,
  requiresMatrixConfig,
} from "@/lib/akademi/question-types";

type IncomingOption = { text?: unknown; isCorrect?: unknown };
type IncomingMatrixConfig = { rows?: unknown; cols?: unknown } | null;

function validateMatrixConfig(
  raw: IncomingMatrixConfig
): { rows: string[]; cols: string[] } | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "MATRIX: matrixConfig.rows[] ve cols[] gerekli" };
  }
  if (!Array.isArray(raw.rows) || !Array.isArray(raw.cols)) {
    return { error: "MATRIX: matrixConfig.rows[] ve cols[] dizi olmalı" };
  }
  const rows = (raw.rows as unknown[])
    .map((r) => (r ?? "").toString().trim())
    .filter(Boolean);
  const cols = (raw.cols as unknown[])
    .map((c) => (c ?? "").toString().trim())
    .filter(Boolean);
  if (rows.length < 1 || cols.length < 2) {
    return { error: "MATRIX: en az 1 satır ve 2 sütun olmalı" };
  }
  if (rows.length > 20 || cols.length > 10) {
    return { error: "MATRIX: max 20 satır × 10 sütun" };
  }
  return { rows, cols };
}

function normalizeAllowedFileTypes(raw: unknown): string | null | { error: string } {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = (raw as string).toString().toLowerCase().trim();
  if (!s) return null;
  if (!/^[a-z0-9]+(,[a-z0-9]+)*$/.test(s)) {
    return { error: "allowedFileTypes formatı: pdf,doc,jpg gibi virgüllü" };
  }
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
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
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
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
    data.isManualGraded = !AUTO_SCORED_TYPES.includes(t);
  }

  const finalType = (data.type ?? existing.type) as QuestionType;
  const optionsProvided = Array.isArray(body.options);
  const opts: IncomingOption[] = optionsProvided
    ? (body.options as IncomingOption[])
    : [];

  // matrixConfig
  if (body.matrixConfig !== undefined) {
    if (requiresMatrixConfig(finalType)) {
      const result = validateMatrixConfig(
        body.matrixConfig as IncomingMatrixConfig
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      data.matrixConfig = result;
    } else {
      // tip MATRIX değilse temizle
      data.matrixConfig = null;
    }
  } else if (data.type !== undefined && !requiresMatrixConfig(finalType)) {
    // tip değişti ve MATRIX değil; eski matrixConfig'i sıfırla
    data.matrixConfig = null;
  }

  // allowedFileTypes
  if (body.allowedFileTypes !== undefined) {
    if (isFileUpload(finalType)) {
      const result = normalizeAllowedFileTypes(body.allowedFileTypes);
      if (result && typeof result === "object" && "error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      data.allowedFileTypes = (result as string | null) ?? null;
    } else {
      data.allowedFileTypes = null;
    }
  } else if (data.type !== undefined && !isFileUpload(finalType)) {
    data.allowedFileTypes = null;
  }

  // Options validation
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
        finalType === QuestionType.MULTIPLE_CHOICE ||
        finalType === QuestionType.DROPDOWN) &&
      opts.length < 2
    ) {
      return NextResponse.json({ error: "En az 2 seçenek" }, { status: 400 });
    }
    if (AUTO_SCORED_TYPES.includes(finalType)) {
      const cc = opts.filter((o) => Boolean(o.isCorrect)).length;
      if (
        (finalType === QuestionType.SINGLE_CHOICE ||
          finalType === QuestionType.TRUE_FALSE ||
          finalType === QuestionType.DROPDOWN) &&
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
              isCorrect: AUTO_SCORED_TYPES.includes(finalType)
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
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;
  const { questionId } = await params;

  const q = await prisma.examQuestion.findUnique({ where: { id: questionId } });
  if (!q) {
    return NextResponse.json({ error: "Soru bulunamadı" }, { status: 404 });
  }

  await prisma.examQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
