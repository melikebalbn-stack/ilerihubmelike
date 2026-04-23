import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";
import { resolveUserDisplayName } from "@/lib/akademi-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      jobTitle: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  const [xp, assignments, progresses, history, levels] = await Promise.all([
    prisma.userXp.findUnique({ where: { userId: id } }),
    prisma.userCourseAssignment.findMany({
      where: { userId: id },
      include: {
        assignment: {
          include: {
            course: {
              select: { id: true, title: true, isActive: true },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.courseProgress.findMany({
      where: { userId: id },
      select: {
        courseId: true,
        percentage: true,
        completedAt: true,
      },
    }),
    prisma.xpHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.akademiLevel.findMany({ orderBy: { level: "asc" } }),
  ]);

  const progressMap = new Map(progresses.map((p) => [p.courseId, p]));

  const totalXp = xp?.total ?? 0;
  const currentLevel = levels.find(
    (l) => totalXp >= l.minXp && (l.maxXp === null || totalXp <= l.maxXp)
  );

  const courses = assignments.map((ua) => {
    const p = progressMap.get(ua.assignment.courseId);
    return {
      assignmentId: ua.id,
      courseId: ua.assignment.courseId,
      courseTitle: ua.assignment.course.title,
      courseIsActive: ua.assignment.course.isActive,
      assignedAt: ua.assignedAt.toISOString(),
      dueDate: ua.dueDate?.toISOString() ?? null,
      progressPercent: p?.percentage ?? 0,
      isCompleted: Boolean(p?.completedAt),
      completedAt: p?.completedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: resolveUserDisplayName(user),
      email: user.email ?? "",
      department: user.department ?? null,
      jobTitle: user.jobTitle ?? null,
    },
    totalXp,
    level: currentLevel?.level ?? 1,
    levelTitle: currentLevel?.title ?? "Başlangıç",
    courses,
    recentHistory: history.map((h) => ({
      id: h.id,
      amount: h.amount,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}
