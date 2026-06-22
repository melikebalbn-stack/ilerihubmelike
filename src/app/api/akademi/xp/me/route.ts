import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { XpSummary } from "@/types/akademi";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [xp, levels, history] = await Promise.all([
    prisma.userXp.findUnique({ where: { userId } }),
    prisma.akademiLevel.findMany({ orderBy: { level: "asc" } }),
    prisma.xpHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const total = xp?.total ?? 0;
  const currentLevel = levels.find(
    (l) => total >= l.minXp && (l.maxXp === null || total <= l.maxXp)
  );
  const nextLevel = levels.find((l) => l.minXp > total);

  const summary: XpSummary = {
    xp: total,
    level: currentLevel?.level ?? 1,
    levelTitle: currentLevel?.title ?? "Başlangıç",
    nextLevelAt: nextLevel?.minXp ?? null,
    streakDays: 0,
    recentHistory: history.map((h) => ({
      id: h.id,
      amount: h.amount,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(summary);
}
