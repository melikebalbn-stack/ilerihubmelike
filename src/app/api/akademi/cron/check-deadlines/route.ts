import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAkademiEvent } from "@/lib/akademi-notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysStart = new Date(now);
  sevenDaysStart.setDate(now.getDate() + 7);
  sevenDaysStart.setHours(0, 0, 0, 0);
  const sevenDaysEnd = new Date(sevenDaysStart);
  sevenDaysEnd.setHours(23, 59, 59, 999);

  // 1) DEADLINE_APPROACHING — dueDate tam 7 gün sonra (gün hassasiyetinde),
  //    reminderSentAt boş, completedAt yok (CourseProgress üzerinden join)
  const approaching = await prisma.userCourseAssignment.findMany({
    where: {
      dueDate: { gte: sevenDaysStart, lte: sevenDaysEnd },
      reminderSentAt: null,
    },
    include: {
      assignment: {
        include: { course: { select: { id: true, title: true } } },
      },
    },
  });

  let approachingSent = 0;
  for (const a of approaching) {
    // Tamamlandıysa atla (CourseProgress.completedAt)
    const progress = await prisma.courseProgress.findUnique({
      where: {
        userId_courseId: {
          userId: a.userId,
          courseId: a.assignment.courseId,
        },
      },
      select: { completedAt: true },
    });
    if (progress?.completedAt) continue;

    try {
      await notifyAkademiEvent({
        userId: a.userId,
        eventType: "DEADLINE_APPROACHING",
        courseTitle: a.assignment.course.title,
        data: { deadline: a.dueDate, daysLeft: 7 },
        link: `/akademi/courses/${a.assignment.courseId}`,
      });
      approachingSent++;
    } catch (err) {
      console.error("[cron-deadlines] approaching notify:", err);
    }

    await prisma.userCourseAssignment.update({
      where: { id: a.id },
      data: { reminderSentAt: now },
    });
  }

  // 2) DEADLINE_MISSED — dueDate geçmiş, missedNotifiedAt boş, tamamlanmamış
  const missed = await prisma.userCourseAssignment.findMany({
    where: {
      dueDate: { lt: now },
      missedNotifiedAt: null,
    },
    include: {
      assignment: {
        include: { course: { select: { id: true, title: true } } },
      },
    },
  });

  let missedSent = 0;
  for (const a of missed) {
    const progress = await prisma.courseProgress.findUnique({
      where: {
        userId_courseId: {
          userId: a.userId,
          courseId: a.assignment.courseId,
        },
      },
      select: { completedAt: true },
    });
    if (progress?.completedAt) continue;
    if (!a.dueDate) continue;

    const daysLate = Math.floor(
      (now.getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    try {
      await notifyAkademiEvent({
        userId: a.userId,
        eventType: "DEADLINE_MISSED",
        courseTitle: a.assignment.course.title,
        data: { deadline: a.dueDate, daysLate },
        link: `/akademi/courses/${a.assignment.courseId}`,
      });
      missedSent++;
    } catch (err) {
      console.error("[cron-deadlines] missed notify:", err);
    }

    await prisma.userCourseAssignment.update({
      where: { id: a.id },
      data: { missedNotifiedAt: now },
    });
  }

  return NextResponse.json({
    approaching: { found: approaching.length, sent: approachingSent },
    missed: { found: missed.length, sent: missedSent },
  });
}
