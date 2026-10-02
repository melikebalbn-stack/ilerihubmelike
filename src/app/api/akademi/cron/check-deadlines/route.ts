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

  // GECİKME EŞİĞİ (Melih kararı 02.10.2026): "son tarih geçti" bildirimi son
  // tarihin üstünden TAM BİR GÜN geçmeden çıkmaz. Eskiden dueDate < now yeterliydi
  // ve son tarih günü saat 00:00'da dolduğu için aynı gün içinde bildirim gidiyordu.
  const gecikmeEsigi = new Date(now);
  gecikmeEsigi.setDate(now.getDate() - 1);

  // "7 gün kaldı" HATIRLATMASI KALDIRILDI (Melih kararı 02.10.2026).
  // Gerekçe: tek bir eğitim ataması onlarca kişiye aynı anda düştüğü için
  // hatırlatma günü gelen kutuları kilitliyordu ve kimse okumuyordu. Artık
  // yalnız GECİKME bildiriliyor — bir şey yapılmadığında haber veriliyor,
  // yapılması gerekenler önceden sayılmıyor.
  // DEADLINE_APPROACHING olay tipi ve şablonu DURUYOR: sertifika yaklaşma
  // bildirimi (check-certificates) aynı altyapıyı kullanıyor.

  // GECİKME — son tarihin üstünden bir gün geçmiş, bildirim gitmemiş, tamamlanmamış
  const missed = await prisma.userCourseAssignment.findMany({
    where: {
      dueDate: { lt: gecikmeEsigi },
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
    // `approaching` alanı 02.10.2026'da düştü — hatırlatma akışı kaldırıldı.
    missed: { found: missed.length, sent: missedSent },
  });
}
