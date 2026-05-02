import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import type { Prisma } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const bolum = searchParams.get("bolum")?.trim();

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (bolum) {
    where.personnel = { bolum };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true } },
      _count: {
        select: {
          akademiCertificates: true,
        },
      },
    },
    take: 500,
    orderBy: { name: "asc" },
  });

  // İlerleme + sınav verileri ayrı queries ile (relation'lar büyük olabilir)
  const userIds = users.map((u) => u.id);

  if (userIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const [progressRows, attemptRows] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, percentage: true, completedAt: true },
    }),
    prisma.userExamAttempt.findMany({
      where: { userId: { in: userIds }, status: "COMPLETED" },
      select: { userId: true, score: true, passed: true },
    }),
  ]);

  const progressByUser = new Map<
    string,
    { total: number; completed: number }
  >();
  for (const p of progressRows) {
    const cur = progressByUser.get(p.userId) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (p.completedAt) cur.completed += 1;
    progressByUser.set(p.userId, cur);
  }

  const attemptsByUser = new Map<
    string,
    { total: number; passed: number; scoreSum: number }
  >();
  for (const a of attemptRows) {
    const cur =
      attemptsByUser.get(a.userId) ?? { total: 0, passed: 0, scoreSum: 0 };
    cur.total += 1;
    if (a.passed) cur.passed += 1;
    cur.scoreSum += a.score ?? 0;
    attemptsByUser.set(a.userId, cur);
  }

  const result = users.map((u) => {
    const p = progressByUser.get(u.id) ?? { total: 0, completed: 0 };
    const a = attemptsByUser.get(u.id) ?? { total: 0, passed: 0, scoreSum: 0 };
    const avgScore = a.total > 0 ? Math.round(a.scoreSum / a.total) : 0;
    return {
      id: u.id,
      name: u.name ?? u.email ?? "—",
      email: u.email,
      bolum: u.personnel?.bolum ?? null,
      completedCourses: p.completed,
      totalCourseProgress: p.total,
      passedExams: a.passed,
      totalAttempts: a.total,
      avgScore,
      certificateCount: u._count.akademiCertificates,
    };
  });

  return NextResponse.json({ users: result });
}
