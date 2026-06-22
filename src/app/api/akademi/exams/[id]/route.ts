import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          score: true,
          passed: true,
          startedAt: true,
          completedAt: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!exam || !exam.isActive) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ exam });
}
