import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { NextResponse } from "next/server";
import type { LeaderboardEntry, LeaderboardResponse } from "@/types/akademi";

export async function GET() {
  const session = await getServerSession(authOptions);
  const currentUserId = await resolveAkademiUserId(session);
  if (!currentUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [topXp, levels] = await Promise.all([
    prisma.userXp.findMany({
      orderBy: { total: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    }),
    prisma.akademiLevel.findMany({ orderBy: { level: "asc" } }),
  ]);

  const getLevel = (xp: number) => {
    const found = levels.find(
      (l) => xp >= l.minXp && (l.maxXp === null || xp <= l.maxXp)
    );
    return {
      level: found?.level ?? 1,
      title: found?.title ?? "Başlangıç",
    };
  };

  const resolveName = (u: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string => {
    if (u.name) return u.name;
    const composed = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    return composed || "Kullanıcı";
  };

  const top: LeaderboardEntry[] = topXp.map((u, idx) => {
    const name = resolveName(u.user);
    const { level, title } = getLevel(u.total);
    return {
      userId: u.userId,
      rank: idx + 1,
      name,
      avatarInitials: getInitials(name),
      department: u.user.department ?? null,
      xp: u.total,
      level,
      levelTitle: title,
      streakDays: 0,
      isCurrentUser: u.userId === currentUserId,
    };
  });

  let currentUser: LeaderboardEntry | null =
    top.find((e) => e.isCurrentUser) ?? null;

  if (!currentUser) {
    const xp = await prisma.userXp.findUnique({
      where: { userId: currentUserId },
      include: {
        user: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    });

    if (xp) {
      const higherCount = await prisma.userXp.count({
        where: { total: { gt: xp.total } },
      });
      const name = resolveName(xp.user);
      const { level, title } = getLevel(xp.total);
      currentUser = {
        userId: currentUserId,
        rank: higherCount + 1,
        name,
        avatarInitials: getInitials(name),
        department: xp.user.department ?? null,
        xp: xp.total,
        level,
        levelTitle: title,
        streakDays: 0,
        isCurrentUser: true,
      };
    }
  }

  const response: LeaderboardResponse = { top, currentUser };
  return NextResponse.json(response);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
