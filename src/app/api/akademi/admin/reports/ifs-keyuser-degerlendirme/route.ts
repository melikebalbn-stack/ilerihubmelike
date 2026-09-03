import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";

// IFS KEY USER DEĞERLENDİRMESİ — PATCH.
//
// Yetki İKİ KOŞULLU (ikisi de gerekli):
//   1) akademi.ifs.keyuser izni
//   2) çağıran, DEĞERLENDİRİLEN kişinin bölümüne atanmış key user olmalı
//      → başka bölüme yazamaz (403). Bölüm, değerlendirilen kişinin
//        Personnel.bolum değeri; IfsKeyUser.bolum ile birebir karşılaştırılır
//        (serbest metin, DepartmentPackage.bolum deseni).
//
// Yalnız keyUser* alanlarına yazar. Eğitmen tarafındaki seviye / not /
// degerlendirenId alanlarına DOKUNMAZ — iki kanaat bağımsız durur.
const bodySchema = z.object({
  userId: z.string().trim().min(1, "userId gerekli"),
  courseId: z.string().trim().min(1, "courseId gerekli"),
  // null = key user seviyesini temizle
  keyUserSeviye: z
    .enum(["BASARILI", "EGITIM_GEREKLI", "BASARISIZ"])
    .nullable()
    .optional(),
  keyUserNot: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requirePermission(['ifs.keyuser', 'akademi.ifs.keyuser']);
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
  const keyUserSeviye = parsed.data.keyUserSeviye ?? null;
  const keyUserNot = parsed.data.keyUserNot?.trim()
    ? parsed.data.keyUserNot.trim()
    : null;

  // Ders gerçekten IFS kursu mu?
  const course = await prisma.course.findFirst({
    where: { id: courseId, isIfs: true },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });
  }

  // Değerlendirilen kişinin bölümü.
  const hedef = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, personnel: { select: { bolum: true } } },
  });
  if (!hedef) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }
  const hedefBolum = hedef.personnel?.bolum?.trim();
  if (!hedefBolum) {
    // Bölümsüz kişiye key user yazılamaz — kapsam belirlenemiyor (fail-closed).
    return NextResponse.json(
      { error: "Değerlendirilen kişinin bölümü tanımsız." },
      { status: 403 }
    );
  }

  // Çağıran o bölümün key user'ı mı?
  const atama = await prisma.ifsKeyUser.findUnique({
    where: { bolum_userId: { bolum: hedefBolum, userId: actorId } },
    select: { id: true },
  });
  if (!atama) {
    return NextResponse.json(
      { error: "Bu bölümün key user'ı değilsiniz." },
      { status: 403 }
    );
  }

  await prisma.ifsCourseEvaluation.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      keyUserSeviye,
      keyUserNot,
      keyUserId: actorId,
      keyUserAt: new Date(),
    },
    update: {
      keyUserSeviye,
      keyUserNot,
      keyUserId: actorId,
      keyUserAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
