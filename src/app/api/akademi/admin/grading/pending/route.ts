import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const where: Prisma.UserExamAttemptWhereInput = {
    status: "PENDING_REVIEW",
  };
  if (search) {
    where.OR = [
      { exam: { title: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const attempts = await prisma.userExamAttempt.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      exam: { select: { id: true, title: true, passingScore: true } },
      answers: {
        select: {
          id: true,
          gradedAt: true,
          question: { select: { isManualGraded: true } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const result = attempts.map((a) => {
    const manualAnswers = a.answers.filter(
      (ans) => ans.question.isManualGraded
    );
    const gradedManual = manualAnswers.filter(
      (ans) => ans.gradedAt !== null
    );
    return {
      id: a.id,
      score: a.score,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      user: a.user,
      exam: a.exam,
      manualTotal: manualAnswers.length,
      manualGraded: gradedManual.length,
      progress:
        manualAnswers.length > 0
          ? Math.round((gradedManual.length / manualAnswers.length) * 100)
          : 0,
    };
  });

  return NextResponse.json({ attempts: result });
}
