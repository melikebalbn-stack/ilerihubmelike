import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { KursiyerGorevDurum, IfsCourseSeviye } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const girdi = z.object({
  userId: z.string().min(1),
  courseId: z.string().min(1),
  tarih: z.coerce.date(),
  not: z.string().trim().max(2000).optional().nullable(),
});

/**
 * POST /api/akademi/admin/reports/ifs-egitim-verildi — "Eğitim Verildi" aksiyonu.
 * Guard: oturum + (ifs.evaluate VEYA ifs.admin).
 * Tek transaction:
 *   1) IfsEgitimKaydi insert (egitmen = çağıran User)
 *   2) o user×course'un GOREV içeriklerinde kursiyerDurum=EGITIM_GEREKLI olanları
 *      temizle → BEKLIYOR + egitimVerildi=true
 *   3) ifs_course_evaluations.seviye = YENIDEN_DEGERLENDIRILECEK (upsert)
 */
export async function POST(request: NextRequest) {
  const { session, userId: egitmenId, error } = await requireSession();
  if (error) return error;

  const perms = await getUserPermissions(egitmenId);
  if (!perms.has("ifs.evaluate") && !perms.has("ifs.admin")) {
    return NextResponse.json({ error: "Eğitim kaydı girme yetkiniz yok" }, { status: 403 });
  }

  const parsed = girdi.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, courseId, tarih, not } = parsed.data;

  // Referans teyidi (FK patlamadan önce anlamlı hata).
  const [hedef, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.course.findFirst({ where: { id: courseId, isIfs: true }, select: { id: true } }),
  ]);
  if (!hedef) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  if (!course) return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });

  // Bu kursun GOREV içerik id'leri (updateMany relation filtresi desteklemez).
  const icerikler = await prisma.content.findMany({
    where: { courseId, type: "GOREV", isActive: true },
    select: { id: true },
  });
  const icerikIdler = icerikler.map((c) => c.id);

  const sonuc = await prisma.$transaction(async (tx) => {
    const kayit = await tx.ifsEgitimKaydi.create({
      data: { userId, courseId, egitmenId, tarih, not: not ?? null },
      select: { id: true, tarih: true },
    });

    let temizlenen = 0;
    if (icerikIdler.length > 0) {
      const r = await tx.ifsTaskEvaluation.updateMany({
        where: { userId, contentId: { in: icerikIdler }, kursiyerDurum: KursiyerGorevDurum.EGITIM_GEREKLI },
        data: { kursiyerDurum: KursiyerGorevDurum.BEKLIYOR, egitimVerildi: true },
      });
      temizlenen = r.count;
    }

    await tx.ifsCourseEvaluation.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { seviye: IfsCourseSeviye.YENIDEN_DEGERLENDIRILECEK },
      create: { userId, courseId, seviye: IfsCourseSeviye.YENIDEN_DEGERLENDIRILECEK },
    });

    return { kayitId: kayit.id, temizlenenIsaret: temizlenen };
  });

  return NextResponse.json({ ok: true, ...sonuc });
}
