import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { resolveUserDisplayName } from "@/lib/akademi-helpers";
import { parseDueDateEndOfDay } from "@/lib/akademi/due-date";
import { notifyAkademiEvent } from "@/lib/akademi-notify";
import type { AdminAssignmentCreateInput } from "@/types/akademi-admin";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.admin');
  if (error) return error;

  const courseId = req.nextUrl.searchParams.get("courseId");

  const userAssignments = await prisma.userCourseAssignment.findMany({
    where: courseId ? { assignment: { courseId } } : undefined,
    include: {
      assignment: {
        include: {
          course: {
            select: { id: true, title: true, isActive: true },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const progressMap = new Map<
    string,
    { percentage: number; completedAt: Date | null }
  >();
  const courseIds = Array.from(
    new Set(userAssignments.map((ua) => ua.assignment.courseId))
  );
  const userIds = Array.from(new Set(userAssignments.map((ua) => ua.userId)));

  if (courseIds.length > 0 && userIds.length > 0) {
    const progresses = await prisma.courseProgress.findMany({
      where: {
        courseId: { in: courseIds },
        userId: { in: userIds },
      },
      select: {
        userId: true,
        courseId: true,
        percentage: true,
        completedAt: true,
      },
    });
    progresses.forEach((p) => {
      progressMap.set(`${p.userId}:${p.courseId}`, {
        percentage: p.percentage,
        completedAt: p.completedAt,
      });
    });
  }

  return NextResponse.json({
    assignments: userAssignments.map((ua) => {
      const progress = progressMap.get(`${ua.userId}:${ua.assignment.courseId}`);
      return {
        userAssignmentId: ua.id,
        assignmentId: ua.assignmentId,
        courseId: ua.assignment.courseId,
        courseTitle: ua.assignment.course.title,
        courseIsActive: ua.assignment.course.isActive,
        userId: ua.userId,
        userName: resolveUserDisplayName(ua.user),
        userEmail: ua.user.email ?? "",
        userDepartment: ua.user.department ?? null,
        assignedAt: ua.assignedAt.toISOString(),
        dueDate: ua.dueDate?.toISOString() ?? null,
        progressPercent: progress?.percentage ?? 0,
        isCompleted: Boolean(progress?.completedAt),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.admin');
  if (error) return error;

  let body: AdminAssignmentCreateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Kurs gerekli" }, { status: 400 });
  }

  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    return NextResponse.json(
      { error: "En az bir kullanıcı seçmelisiniz" },
      { status: 400 }
    );
  }

  const userIds = Array.from(
    new Set(body.userIds.map((id) => id.trim()).filter(Boolean))
  );

  if (userIds.length > 500) {
    return NextResponse.json(
      { error: "Tek seferde en fazla 500 kullanıcıya atama yapılabilir" },
      { status: 400 }
    );
  }

  // PR-IFS-RAPOR-2a: gün SONUNA normalize (parseDueDateEndOfDay) — overdue ile uyum.
  const { dueDate, error: dueErr } = parseDueDateEndOfDay(body.dueDate);
  if (dueErr) {
    return NextResponse.json({ error: dueErr }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isActive: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Kurs bulunamadı" }, { status: 404 });
  }
  if (!course.isActive) {
    return NextResponse.json(
      { error: "Pasif kurslara atama yapılamaz" },
      { status: 400 }
    );
  }

  const validUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });
  const validUserIds = validUsers.map((u) => u.id);

  if (validUserIds.length === 0) {
    return NextResponse.json(
      { error: "Geçerli kullanıcı bulunamadı" },
      { status: 400 }
    );
  }

  let template = await prisma.courseAssignment.findFirst({
    where: { courseId, dueDate: null },
  });
  if (!template) {
    template = await prisma.courseAssignment.create({
      data: { courseId, dueDate: null },
    });
  }

  const createResult = await prisma.userCourseAssignment.createMany({
    data: validUserIds.map((userId) => ({
      userId,
      assignmentId: template!.id,
      dueDate,
    })),
    skipDuplicates: true,
  });

  const skippedCount = validUserIds.length - createResult.count;
  const invalidCount = userIds.length - validUserIds.length;

  // Bildirim — gerçekten yeni atanan user'lara (skipDuplicates yüzünden createResult.count yetmez)
  if (createResult.count > 0) {
    const courseInfo = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (courseInfo) {
      const newAssignments = await prisma.userCourseAssignment.findMany({
        where: {
          assignmentId: template!.id,
          userId: { in: validUserIds },
          assignedAt: { gte: new Date(Date.now() - 60_000) },
        },
        select: { userId: true, dueDate: true },
      });

      Promise.allSettled(
        newAssignments.map((a) =>
          notifyAkademiEvent({
            userId: a.userId,
            eventType: "COURSE_ASSIGNED",
            courseTitle: courseInfo.title,
            data: { deadline: a.dueDate },
            link: `/akademi/courses/${courseInfo.id}`,
          })
        )
      ).then((results) => {
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          console.error(
            `[akademi-notify] COURSE_ASSIGNED ${failed}/${results.length} failed`
          );
        }
      });
    }
  }

  return NextResponse.json({
    createdCount: createResult.count,
    skippedCount: skippedCount + invalidCount,
    message:
      createResult.count > 0
        ? `${createResult.count} atama oluşturuldu${
            skippedCount > 0 ? `, ${skippedCount} kişi zaten atanmıştı` : ""
          }${
            invalidCount > 0 ? `, ${invalidCount} kullanıcı bulunamadı` : ""
          }`
        : "Yeni atama oluşturulmadı (hepsi zaten atanmış veya geçersiz)",
  });
}
