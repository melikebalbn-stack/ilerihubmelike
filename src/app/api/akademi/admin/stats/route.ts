import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  akademiTypeSchema,
  courseTypeWhere,
  viaCourseWhere,
  viaOptionalCourseWhere,
} from "@/lib/akademi/admin-type-filter";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  // XP ve sertifika doğrulama sayaçlarının kurs bağı yok → süzülmez.
  const parsedType = akademiTypeSchema.safeParse(
    req.nextUrl.searchParams.get("type") ?? undefined
  );
  if (!parsedType.success) {
    return NextResponse.json({ error: "Geçersiz type" }, { status: 400 });
  }
  const type = parsedType.data;
  const courseW = courseTypeWhere(type);
  const assignmentW = viaCourseWhere(type); // CourseAssignment.course zorunlu
  const examW = viaOptionalCourseWhere(type); // Exam.course opsiyonel
  const attemptW = { exam: examW };
  const certW = viaOptionalCourseWhere(type); // AkademiCertificate.course opsiyonel

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
    prisma.course.count({ where: courseW }),
    prisma.course.count({ where: { ...courseW, isActive: true } }),
    prisma.userCourseAssignment.count({ where: { assignment: assignmentW } }),
    prisma.userXp.count({ where: { total: { gt: 0 } } }),
    prisma.xpHistory.aggregate({ _sum: { amount: true } }),
    prisma.exam.count({ where: examW }),
    prisma.exam.count({ where: { ...examW, isActive: true } }),
    prisma.userExamAttempt.count({ where: attemptW }),
    prisma.userExamAttempt.count({ where: { ...attemptW, status: "COMPLETED" } }),
    prisma.userExamAttempt.count({ where: { ...attemptW, status: "PENDING_REVIEW" } }),
    prisma.userExamAttempt.count({
      where: { ...attemptW, status: "COMPLETED", passed: true },
    }),
    prisma.userExamAttempt.aggregate({
      _avg: { score: true },
      where: { ...attemptW, status: "COMPLETED", score: { not: null } },
    }),
    prisma.akademiCertificate.count({ where: certW }),
    prisma.akademiCertificate.count({
      where: { ...certW, issuedAt: { gte: thirtyDaysAgo } },
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
        where: { ...attemptW, startedAt: { gte: start, lt: end } },
      }),
      prisma.akademiCertificate.count({
        where: { ...certW, issuedAt: { gte: start, lt: end } },
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
