import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  akademiTypeSchema,
  viaCourseWhere,
  viaOptionalCourseWhere,
} from "@/lib/akademi/admin-type-filter";

type ActivityEvent = {
  type: "exam_attempt" | "certificate" | "course_complete";
  timestamp: Date;
  userName: string;
  title: string;
  detail: string;
};

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  const parsedType = akademiTypeSchema.safeParse(
    req.nextUrl.searchParams.get("type") ?? undefined
  );
  if (!parsedType.success) {
    return NextResponse.json({ error: "Geçersiz type" }, { status: 400 });
  }
  const type = parsedType.data;
  const examW = viaOptionalCourseWhere(type); // Exam.course opsiyonel
  const certW = viaOptionalCourseWhere(type); // AkademiCertificate.course opsiyonel
  const progressW = viaCourseWhere(type); // CourseProgress.course zorunlu

  const [recentAttempts, recentCerts, recentCompletions] = await Promise.all([
    prisma.userExamAttempt.findMany({
      where: { exam: examW, status: { in: ["COMPLETED", "PENDING_REVIEW"] } },
      take: 10,
      orderBy: { completedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        exam: { select: { title: true } },
      },
    }),
    prisma.akademiCertificate.findMany({
      where: certW,
      take: 10,
      orderBy: { issuedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    }),
    prisma.courseProgress.findMany({
      where: { ...progressW, completedAt: { not: null } },
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
