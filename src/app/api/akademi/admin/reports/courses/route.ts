import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";

export async function GET(_req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      isActive: true,
      _count: {
        select: {
          contents: true,
          exams: true,
          directAssignments: true,
          certificates: true,
        },
      },
      progress: {
        select: { percentage: true, completedAt: true },
      },
      exams: {
        where: { isActive: true },
        select: {
          id: true,
          attempts: {
            where: { status: "COMPLETED" },
            select: { passed: true, score: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = courses.map((c) => {
    const enrolled = c.progress.length;
    const completed = c.progress.filter((p) => p.completedAt).length;
    const completionRate =
      enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

    const allAttempts = c.exams.flatMap((e) => e.attempts);
    const passedCount = allAttempts.filter((a) => a.passed).length;
    const passRate =
      allAttempts.length > 0
        ? Math.round((passedCount / allAttempts.length) * 100)
        : 0;
    const avgScore =
      allAttempts.length > 0
        ? Math.round(
            allAttempts.reduce((s, a) => s + (a.score ?? 0), 0) /
              allAttempts.length
          )
        : 0;

    return {
      id: c.id,
      title: c.title,
      isActive: c.isActive,
      contentCount: c._count.contents,
      examCount: c._count.exams,
      assignmentCount: c._count.directAssignments,
      certificateCount: c._count.certificates,
      enrolled,
      completed,
      completionRate,
      avgScore,
      passRate,
      totalAttempts: allAttempts.length,
    };
  });

  return NextResponse.json({ courses: result });
}
