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
  const thirtyDaysStart = new Date(now);
  thirtyDaysStart.setDate(now.getDate() + 30);
  thirtyDaysStart.setHours(0, 0, 0, 0);
  const thirtyDaysEnd = new Date(thirtyDaysStart);
  thirtyDaysEnd.setHours(23, 59, 59, 999);

  // 1) CERTIFICATE_EXPIRING_SOON — validUntil tam 30 gün sonra
  const expiringSoon = await prisma.akademiCertificate.findMany({
    where: {
      validUntil: { gte: thirtyDaysStart, lte: thirtyDaysEnd },
      expiringSoonNotifiedAt: null,
    },
    include: { course: { select: { id: true, title: true } } },
  });

  let expiringSent = 0;
  for (const c of expiringSoon) {
    try {
      await notifyAkademiEvent({
        userId: c.userId,
        eventType: "CERTIFICATE_EXPIRING_SOON",
        courseTitle: c.course?.title ?? "Sertifika",
        data: {
          certificateNo: c.certificateNo,
          validUntil: c.validUntil,
          daysLeft: 30,
        },
        link: `/akademi/certificates/${c.id}`,
      });
      expiringSent++;
    } catch (err) {
      console.error("[cron-certs] expiring notify:", err);
    }

    await prisma.akademiCertificate.update({
      where: { id: c.id },
      data: { expiringSoonNotifiedAt: now },
    });
  }

  // 2) CERTIFICATE_EXPIRED — validUntil geçmiş
  const expired = await prisma.akademiCertificate.findMany({
    where: {
      validUntil: { lt: now },
      expiredNotifiedAt: null,
    },
    include: { course: { select: { id: true, title: true } } },
  });

  let expiredSent = 0;
  for (const c of expired) {
    try {
      await notifyAkademiEvent({
        userId: c.userId,
        eventType: "CERTIFICATE_EXPIRED",
        courseTitle: c.course?.title ?? "Sertifika",
        data: {
          certificateNo: c.certificateNo,
          expiredAt: c.validUntil,
        },
        link: `/akademi/certificates/${c.id}`,
      });
      expiredSent++;
    } catch (err) {
      console.error("[cron-certs] expired notify:", err);
    }

    await prisma.akademiCertificate.update({
      where: { id: c.id },
      data: { expiredNotifiedAt: now },
    });
  }

  return NextResponse.json({
    expiringSoon: { found: expiringSoon.length, sent: expiringSent },
    expired: { found: expired.length, sent: expiredSent },
  });
}
