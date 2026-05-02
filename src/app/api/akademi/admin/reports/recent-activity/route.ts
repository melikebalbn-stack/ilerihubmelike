import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";

type ActivityEvent = {
  type: "exam_attempt" | "certificate" | "course_complete";
  timestamp: Date;
  userName: string;
  title: string;
  detail: string;
};

export async function GET(_req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const [recentAttempts, recentCerts, recentCompletions] = await Promise.all([
    prisma.userExamAttempt.findMany({
      where: { status: { in: ["COMPLETED", "PENDING_REVIEW"] } },
      take: 10,
      orderBy: { completedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        exam: { select: { title: true } },
      },
    }),
    prisma.akademiCertificate.findMany({
      take: 10,
      orderBy: { issuedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    }),
    prisma.courseProgress.findMany({
      where: { completedAt: { not: null } },
      take: 10,
      orderBy: { completedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const a of recentAttempts) {
    if (!a.completedAt) continue;
    events.push({
      type: "exam_attempt",
      timestamp: a.completedAt,
      userName: a.user.name ?? a.user.email ?? "—",
      title: a.exam.title,
      detail:
        a.status === "COMPLETED"
          ? a.passed
            ? `geçti (%${a.score ?? 0})`
            : `kaldı (%${a.score ?? 0})`
          : "değerlendirme bekleniyor",
    });
  }
  for (const c of recentCerts) {
    events.push({
      type: "certificate",
      timestamp: c.issuedAt,
      userName: c.user.name ?? c.user.email ?? "—",
      title: c.course?.title ?? "Kurs",
      detail: `sertifika: ${c.certificateNo}`,
    });
  }
  for (const p of recentCompletions) {
    if (!p.completedAt) continue;
    events.push({
      type: "course_complete",
      timestamp: p.completedAt,
      userName: p.user.name ?? p.user.email ?? "—",
      title: p.course.title,
      detail: "kurs tamamlandı",
    });
  }

  events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return NextResponse.json({ events: events.slice(0, 20) });
}
