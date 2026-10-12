import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { kisiDurumListesi } from "@/lib/akademi/sinav-kpi";
import { sendPushToUser } from "@/lib/push-notifications";
import { AKTIF_PERSONEL } from "@/lib/user-personnel";

/**
 * Sınava henüz girmemiş kişilere toplu hatırlatma.
 *
 * MAIL GÖNDERİLMEZ (Melih, 12.10.2026: "mail atmayayım ama bildirim
 * gönderebileyim"). Yalnız Hub bildirimi (zil) + telefona push.
 *
 * Alıcı kümesi listeyle aynı kaynaktan gelir: durum = BASLAMADI. İstemciden
 * kullanıcı listesi KABUL EDİLMEZ — elle hazırlanmış bir istek rastgele
 * kişilere bildirim yollayamasın.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  // Hatırlatma bir eylemdir: rapor okuma yetkisi yetmez, akademi yönetimi gerekir.
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const { examId } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      courseId: true,
      course: { select: { title: true } },
      attempts: {
        select: { userId: true, status: true, passed: true, score: true },
      },
    },
  });
  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }
  if (!exam.courseId) {
    return NextResponse.json(
      { error: "Bu sınav bir kursa bağlı değil; atanan kişi listesi yok." },
      { status: 400 }
    );
  }

  const atananlar = (
    await prisma.userCourseAssignment.findMany({
      where: { assignment: { courseId: exam.courseId } },
      select: { userId: true },
    })
  ).map((a) => a.userId);

  const girmeyenIdler = kisiDurumListesi(atananlar, exam.attempts)
    .filter((s) => s.durum === "BASLAMADI")
    .map((s) => s.userId);

  if (girmeyenIdler.length === 0) {
    return NextResponse.json({ gonderilen: 0, mesaj: "Girmeyen kimse yok." });
  }

  // Ayrılan personele hatırlatma gitmesin.
  const alicilar = await prisma.user.findMany({
    where: {
      id: { in: girmeyenIdler },
      isActive: true,
      OR: [{ personnelId: null }, { personnel: { is: AKTIF_PERSONEL } }],
    },
    select: { id: true },
  });
  if (alicilar.length === 0) {
    return NextResponse.json({ gonderilen: 0, mesaj: "Uygun alıcı yok." });
  }

  const baslik = "Sınav hatırlatması";
  const mesaj = `"${exam.title}" sınavını henüz tamamlamadınız. ${
    exam.course?.title ? `${exam.course.title} eğitimi kapsamında. ` : ""
  }Akademi üzerinden girebilirsiniz.`;
  const link = "/akademi";

  // In-app bildirimler tek sorguda.
  await prisma.notification.createMany({
    data: alicilar.map((u) => ({
      userId: u.id,
      title: baslik,
      message: mesaj,
      type: "REMINDER" as const,
      link,
    })),
  });

  // Push — biri patlarsa diğerleri devam etsin, in-app zaten yazıldı.
  let pushGonderilen = 0;
  const BATCH = 5;
  for (let i = 0; i < alicilar.length; i += BATCH) {
    const sonuclar = await Promise.allSettled(
      alicilar.slice(i, i + BATCH).map((u) =>
        sendPushToUser(prisma, u.id, {
          title: baslik,
          body: mesaj,
          url: link,
          tag: `sinav-hatirlatma-${exam.id}`,
        })
      )
    );
    for (const s of sonuclar) {
      if (s.status === "fulfilled" && s.value > 0) pushGonderilen++;
    }
  }

  return NextResponse.json({
    gonderilen: alicilar.length,
    pushGonderilen,
    mesaj: `${alicilar.length} kişiye Hub bildirimi gönderildi${
      pushGonderilen > 0 ? `, ${pushGonderilen} kişiye telefon bildirimi ulaştı` : ""
    }.`,
  });
}
