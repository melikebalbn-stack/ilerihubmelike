import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  DEFAULT_FILE_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/akademi/question-types";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "exam-uploads"
);

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const questionIdRaw = formData.get("questionId");
  const questionId =
    typeof questionIdRaw === "string" ? questionIdRaw : null;

  if (!(file instanceof File) || !questionId) {
    return NextResponse.json(
      { error: "file ve questionId gerekli" },
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
      { error: "Sınav aktif değil" },
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

  const question = await prisma.examQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question || question.examId !== attempt.examId) {
    return NextResponse.json(
      { error: "Soru bu sınava ait değil" },
      { status: 400 }
    );
  }
  if (question.type !== "FILE_UPLOAD") {
    return NextResponse.json(
      { error: "Bu soru dosya yükleme tipi değil" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `Maksimum dosya boyutu ${
          MAX_UPLOAD_SIZE_BYTES / 1024 / 1024
        }MB`,
      },
      { status: 400 }
    );
  }

  const allowedExt = (question.allowedFileTypes || DEFAULT_FILE_TYPES)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ext || !allowedExt.includes(ext)) {
    return NextResponse.json(
      {
        error: `Geçersiz dosya tipi. İzin verilen: ${allowedExt.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const attemptDir = path.join(UPLOAD_DIR, attemptId);
  await fs.mkdir(attemptDir, { recursive: true });

  const safeName = `${questionId}-${crypto
    .randomBytes(6)
    .toString("hex")}.${ext}`;
  const fullPath = path.join(attemptDir, safeName);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  const fileUrl = `/uploads/akademi/exam-uploads/${attemptId}/${safeName}`;

  // Eski dosyayı temizle
  const existing = await prisma.userExamAnswer.findFirst({
    where: { attemptId, questionId },
    select: { id: true, fileUrl: true },
  });
  if (existing?.fileUrl) {
    const oldPath = path.join(process.cwd(), "public", existing.fileUrl);
    await fs.unlink(oldPath).catch(() => {});
  }

  if (existing) {
    await prisma.userExamAnswer.update({
      where: { id: existing.id },
      data: {
        fileUrl,
        optionId: null,
        selectedOptionIds: [],
        textAnswer: null,
      },
    });
  } else {
    await prisma.userExamAnswer.create({
      data: {
        attemptId,
        questionId,
        fileUrl,
        selectedOptionIds: [],
      },
    });
  }

  return NextResponse.json({
    ok: true,
    fileUrl,
    fileName: file.name,
  });
}
