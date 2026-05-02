import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { getLinkedBolums } from "@/lib/user-personnel";

export async function GET(_req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const bolums = await getLinkedBolums();

  const result = await Promise.all(
    bolums.map(async (bolum) => {
      const users = await prisma.user.findMany({
        where: { personnel: { bolum } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length === 0) {
        return {
          bolum,
          userCount: 0,
          completedCourses: 0,
          totalAttempts: 0,
          passedAttempts: 0,
          passRate: 0,
          certificateCount: 0,
        };
      }

      const [completedCourses, attempts, passedAttempts, certs] =
        await Promise.all([
          prisma.courseProgress.count({
            where: { userId: { in: userIds }, completedAt: { not: null } },
          }),
          prisma.userExamAttempt.count({
            where: { userId: { in: userIds }, status: "COMPLETED" },
          }),
          prisma.userExamAttempt.count({
            where: {
              userId: { in: userIds },
              status: "COMPLETED",
              passed: true,
            },
          }),
          prisma.akademiCertificate.count({
            where: { userId: { in: userIds } },
          }),
        ]);

      return {
        bolum,
        userCount: userIds.length,
        completedCourses,
        totalAttempts: attempts,
        passedAttempts,
        passRate:
          attempts > 0 ? Math.round((passedAttempts / attempts) * 100) : 0,
        certificateCount: certs,
      };
    })
  );

  result.sort((a, b) => b.userCount - a.userCount);
  return NextResponse.json({ departments: result });
}
