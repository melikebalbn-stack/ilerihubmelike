import { NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const [
    totalCourses,
    activeCourses,
    totalAssignments,
    activeUsers,
    xpAgg,
  ] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { isActive: true } }),
    prisma.userCourseAssignment.count(),
    prisma.userXp.count({ where: { total: { gt: 0 } } }),
    prisma.xpHistory.aggregate({ _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    totalCourses,
    activeCourses,
    totalAssignments,
    activeUsers,
    totalXpGranted: xpAgg._sum.amount ?? 0,
  });
}
