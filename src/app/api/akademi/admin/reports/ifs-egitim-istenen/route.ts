import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { canIfsRaporView } from "@/lib/ifs/rapor-erisim";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum } from "@/lib/user-personnel";

// IFS — bir kişinin bir kurstaki EĞİTİM İSTENEN görevleri (READ).
// "Eğitim İstenen Görev" sütunundaki sayının arkasındaki liste.
//
// Yetki + scope: `ifs-departman-kisiler` ile BİREBİR aynı — akademi.report.view,
// akademi.admin => her bölüm, aksi halde yalnız kendi bölümü (başkası 403).
// Kapsam, DEĞERLENDİRİLEN kişinin bölümü üzerinden belirlenir.
export async function GET(req: NextRequest) {
  const { session, userId: oturumUserId, error } = await requireSession();
  if (error) return error;
  if (!(await canIfsRaporView(oturumUserId))) {
    return NextResponse.json({ error: "IFS rapor görüntüleme yetkiniz yok" }, { status: 403 });
  }

  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const courseId = req.nextUrl.searchParams.get("courseId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
  }
  if (!courseId) {
    return NextResponse.json({ error: "courseId gerekli" }, { status: 400 });
  }

  const hedef = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true } },
    },
  });
  if (!hedef) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  const perms = await getUserPermissions(callerId);
  // KAPSAM KARARI — burada OR BİLEREK duruyor (guard'larda tek anahtara indirildi).
  // Fark: guard kapıyı kapatır, 403 verir, hemen fark edilir. Kapsam kararı ise
  // sessizce AZ VERİ gösterir — yönetici kendini kendi bölümüne daraltılmış bulur
  // ve bunu kimse hata olarak bildirmez. Eski anahtarı burada bırakmak kimseyi
  // içeri ALMAZ (guard zaten ifs.* istiyor); yalnız geçiş döneminde yanlış
  // daraltmayı önler.
  const fullScope = perms.has("ifs.admin") || perms.has("akademi.admin");
  if (!fullScope) {
    const ownBolum = await resolveUserBolum(callerId);
    const hedefBolum = hedef.personnel?.bolum ?? null;
    if (!ownBolum || !hedefBolum || ownBolum !== hedefBolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, isIfs: true },
    select: { id: true, title: true },
  });
  if (!course) {
    return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });
  }

  const satirlar = await prisma.ifsTaskEvaluation.findMany({
    where: {
      userId,
      kursiyerDurum: "EGITIM_GEREKLI",
      content: { courseId, type: "GOREV", isActive: true },
    },
    select: {
      ornekAciklama: true,
      degerlendirildiAt: true,
      content: {
        select: {
          id: true,
          title: true,
          order: true,
          ifsMeta: { select: { modul: true, altModul: true, ifsEkran: true } },
        },
      },
    },
    orderBy: { content: { order: "asc" } },
  });

  return NextResponse.json({
    userId,
    ad: hedef.name ?? hedef.email ?? userId,
    bolum: hedef.personnel?.bolum ?? null,
    courseId: course.id,
    egitimAdi: course.title,
    scope: fullScope ? "full" : "own",
    gorevler: satirlar.map((s) => ({
      contentId: s.content.id,
      konu: s.content.title,
      order: s.content.order,
      modul: s.content.ifsMeta?.modul ?? null,
      altModul: s.content.ifsMeta?.altModul ?? null,
      ifsEkran: s.content.ifsMeta?.ifsEkran ?? null,
      ornekAciklama: s.ornekAciklama,
      degerlendirildiAt: s.degerlendirildiAt?.toISOString() ?? null,
    })),
  });
}
