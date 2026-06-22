import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { resolveUserDisplayName } from "@/lib/akademi-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.admin');
  if (error) return error;

  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase();

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { department: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      jobTitle: true,
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  if (users.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const userIds = users.map((u) => u.id);

  const [xpRecords, assignmentCounts, completionCounts, levels] =
    await Promise.all([
      prisma.userXp.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, total: true },
      }),
      prisma.userCourseAssignment.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.courseProgress.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          completedAt: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.akademiLevel.findMany({ orderBy: { level: "asc" } }),
    ]);

  const xpMap = new Map(xpRecords.map((x) => [x.userId, x.total]));
  const assignMap = new Map(
    assignmentCounts.map((a) => [a.userId, a._count._all])
  );
  const completeMap = new Map(
    completionCounts.map((c) => [c.userId, c._count._all])
  );

  const getLevel = (xp: number) => {
    const found = levels.find(
      (l) => xp >= l.minXp && (l.maxXp === null || xp <= l.maxXp)
    );
    return found?.level ?? 1;
  };

  const items = users.map((u) => {
    const totalXp = xpMap.get(u.id) ?? 0;
    const assignmentCount = assignMap.get(u.id) ?? 0;
    const completedCount = completeMap.get(u.id) ?? 0;
    const completionRate =
      assignmentCount > 0
        ? Math.round((completedCount / assignmentCount) * 100)
        : 0;

    return {
      id: u.id,
      name: resolveUserDisplayName(u),
      email: u.email ?? "",
      department: u.department ?? null,
      jobTitle: u.jobTitle ?? null,
      totalXp,
      level: getLevel(totalXp),
      assignmentCount,
      completedCount,
      completionRate,
    };
  });

  return NextResponse.json({ users: items });
}
