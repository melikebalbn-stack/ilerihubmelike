import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET(_req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCourses,
    activeCourses,
    totalAssignments,
    activeUsers,
    xpAgg,
    totalExams,
    activeExams,
    totalAttempts,
    completedAttempts,
    pendingReviewCount,
    passedAttempts,
    avgScoreAgg,
    totalCertificates,
    certsLast30Days,
    totalVerifications,
  ] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { isActive: true } }),
    prisma.userCourseAssignment.count(),
    prisma.userXp.count({ where: { total: { gt: 0 } } }),
    prisma.xpHistory.aggregate({ _sum: { amount: true } }),
    prisma.exam.count(),
    prisma.exam.count({ where: { isActive: true } }),
    prisma.userExamAttempt.count(),
    prisma.userExamAttempt.count({ where: { status: "COMPLETED" } }),
    prisma.userExamAttempt.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.userExamAttempt.count({
      where: { status: "COMPLETED", passed: true },
    }),
    prisma.userExamAttempt.aggregate({
      _avg: { score: true },
      where: { status: "COMPLETED", score: { not: null } },
    }),
    prisma.akademiCertificate.count(),
    prisma.akademiCertificate.count({
      where: { issuedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.akademiCertificateVerification.count(),
  ]);

  const passRate =
    completedAttempts > 0
      ? Math.round((passedAttempts / completedAttempts) * 100)
      : 0;
  const avgScore = Math.round(avgScoreAgg._avg.score ?? 0);

  // 12 aylık trend (sıralı şekilde, paralel değil — N+N query yükü kabul edilebilir)
  const trends: { month: string; attempts: number; certificates: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [attempts, certs] = await Promise.all([
      prisma.userExamAttempt.count({
        where: { startedAt: { gte: start, lt: end } },
      }),
      prisma.akademiCertificate.count({
        where: { issuedAt: { gte: start, lt: end } },
      }),
    ]);
    trends.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
        2,
        "0"
      )}`,
      attempts,
      certificates: certs,
    });
  }

  return NextResponse.json({
    courses: { total: totalCourses, active: activeCourses },
    assignments: { total: totalAssignments },
    users: { active: activeUsers },
    xp: { totalGranted: xpAgg._sum.amount ?? 0 },
    exams: {
      total: totalExams,
      active: activeExams,
      totalAttempts,
      completedAttempts,
      pendingReview: pendingReviewCount,
      passRate,
      avgScore,
    },
    certificates: {
      total: totalCertificates,
      last30Days: certsLast30Days,
      totalVerifications,
    },
    trends,
  });
}
