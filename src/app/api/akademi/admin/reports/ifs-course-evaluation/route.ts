import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { logAuditEvent } from "@/lib/audit-log";

// IFS canlı değerlendirme (PR-2): per-ders (userId × courseId) eğitmen seviyesi
// + notu. seviye=BASARILI → ders "tamamlandı" (CourseProgress.completedAt).
// Yetki: OR(akademi.ifs.evaluate, akademi.grade.manual, akademi.admin).
// Yazımdan sonra recomputeCourseProgress → isCompleted güncellenir. UI PR-3'te.
// IFS görev/alan değerlendirmesi yazma yetkisi — TEK ANAHTAR.
//
// Eskiden OR şuydu: akademi.ifs.evaluate + akademi.grade.manual + akademi.admin.
// Üçü de kaldırıldı; kapı artık yalnız ifs.evaluate (IFS Eğitmeni / Super Admin).
//
// ÖLÇÜLDÜ (3 Eyl 2026, prod): bu daraltma ÜÇ kişiyi dışarıda bırakıyor —
// Elif Karadeniz, Elif Yıldırım, Gokce Eksioglu. Üçü de yalnız grade.manual +
// akademi.admin ile geçiyordu, ifs.evaluate taşımıyorlar. BİLEREK dışarıdalar:
// IFS görev değerlendirmesi eğitmenin işi, akademi/İK yöneticiliğinin değil.
// Üçünün bugüne kadar yazdığı IFS değerlendirmesi: 0 / 0 / 0.
// Fiilen değerlendirme yazan üç kişi (Melike Balaban, Nurgul Tastan,
// Melih Dilben) ifs.evaluate taşıyor — kimse kesilmiyor.
//
// Birine yeniden yetki gerekirse doğru yol bu diziyi genişletmek DEĞİL,
// o kişiye "IFS Eğitmeni" rolünü vermektir.
const IFS_EVAL_WRITE = ["ifs.evaluate"];

const bodySchema = z.object({
  userId: z.string().trim().min(1, "userId gerekli"),
  courseId: z.string().trim().min(1, "courseId gerekli"),
  // null = seviye temizle (PENDING'e döner → ders tamamlanmamış sayılır).
  seviye: z.enum(["BASARILI", "EGITIM_GEREKLI", "BASARISIZ"]).nullable().optional(),
  not: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requirePermission(IFS_EVAL_WRITE);
  if (error) return error;
  const actorId = await resolveAkademiUserId(session);
  if (!actorId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz girdi" },
      { status: 400 }
    );
  }
  const { userId, courseId } = parsed.data;
  const seviye = parsed.data.seviye ?? null;
  const not = parsed.data.not?.trim() ? parsed.data.not.trim() : null;

  // Ders gerçekten IFS kursu mu? (per-ders değerlendirme yalnız IFS için.)
  const course = await prisma.course.findFirst({
    where: { id: courseId, isIfs: true },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json(
      { error: "IFS kursu bulunamadı" },
      { status: 404 }
    );
  }

  // Yazma + audit atomik (tx).
  await prisma.$transaction(async (tx) => {
    await tx.ifsCourseEvaluation.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, seviye, not, degerlendirenId: actorId },
      update: { seviye, not, degerlendirenId: actorId },
    });
    await logAuditEvent({
      action: "IFS_COURSE_EVALUATION_UPSERTED",
      actorId,
      targetType: "IFS_COURSE_EVALUATION",
      targetId: courseId,
      details: { userId, courseId, seviye, not },
      tx,
    });
  });

  // Tamamlanma (isCompleted) = seviye BASARILI → CourseProgress yeniden hesapla.
  await recomputeCourseProgress(userId, courseId);

  return NextResponse.json({ success: true });
}
