import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
  kapsamdaMi,
} from "@/lib/akademi/ifs-kapsam";
import { stripDeptPrefix, stripAreaPrefix } from "@/lib/akademi-ifs";

// IFS — bir kişinin bir PAKETTEKİ görev dökümü (READ).
// Yetki: OR(akademi.kurs.edit, ifs.keyuser) — kapsam TEK KAYNAK'ta
// (ifs-kapsam.ts). Key user, kapsamı dışındaki bir kişiyi sorgularsa 403;
// yönetici için davranış DEĞİŞMEZ.
//
// Sıralama: EGITIM_GEREKLI olanlar ÖNE gelir (ekranın asıl sorusu "nerede
// takıldı"), sonra kurs sırası, sonra görev sırası.
// ?tumu=1 verilmezse yalnız DEĞERLENDİRME SATIRI OLAN görevler döner; verilirse
// paketteki bütün görevler döner (dokunulmamışlar BEKLIYOR/PENDING varsayılanıyla).
export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission(IFS_EGITIM_OKUMA);
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }
  const kapsam = await ifsEgitimKapsami(callerId);
  if (!kapsam.yetkili) {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const packageId = req.nextUrl.searchParams.get("packageId")?.trim();
  const tumu = req.nextUrl.searchParams.get("tumu") === "1";
  if (!userId) {
    return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
  }
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }

  const kisi = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true } },
    },
  });
  if (!kisi) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }
  // Kapsam kontrolü hedef kişinin bölümü üzerinden — key user başka bölümdeki
  // kişinin görevlerini göremez.
  if (!kapsamdaMi(kapsam, kisi.personnel?.bolum ?? null)) {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
  }

  const paket = await prisma.coursePackage.findFirst({
    where: { id: packageId, isIfs: true },
    select: {
      id: true,
      name: true,
      packageCourses: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          course: {
            select: {
              id: true,
              title: true,
              contents: {
                where: { type: "GOREV", isActive: true },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  ifsMeta: {
                    select: { modul: true, altModul: true, ifsEkran: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!paket) {
    return NextResponse.json({ error: "IFS paketi bulunamadı" }, { status: 404 });
  }

  const paketAd = stripDeptPrefix(paket.name);
  const gorevIds = paket.packageCourses.flatMap((pc) =>
    pc.course.contents.map((c) => c.id)
  );

  const satirlar = gorevIds.length
    ? await prisma.ifsTaskEvaluation.findMany({
        where: { userId, contentId: { in: gorevIds } },
        select: {
          contentId: true,
          kursiyerDurum: true,
          ornekStatus: true,
          ornekAciklama: true,
          degerlendirildiAt: true,
          degerlendirenId: true,
        },
      })
    : [];
  const kayitOf = new Map(satirlar.map((s) => [s.contentId, s]));

  const degIds = [
    ...new Set(satirlar.map((s) => s.degerlendirenId).filter(Boolean)),
  ] as string[];
  const degKisiler = degIds.length
    ? await prisma.user.findMany({
        where: { id: { in: degIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const degAd = new Map(degKisiler.map((u) => [u.id, u.name ?? u.email ?? u.id]));

  const gorevler = paket.packageCourses.flatMap((pc) =>
    pc.course.contents.map((c) => {
      const k = kayitOf.get(c.id);
      return {
        contentId: c.id,
        courseId: pc.course.id,
        egitimAdi: stripAreaPrefix(pc.course.title, paketAd),
        kursSirasi: pc.order,
        gorevSirasi: c.order,
        konu: c.title,
        modul: c.ifsMeta?.modul ?? null,
        altModul: c.ifsMeta?.altModul ?? null,
        ifsEkran: c.ifsMeta?.ifsEkran ?? null,
        kayitVar: !!k,
        kursiyerDurum: k?.kursiyerDurum ?? "BEKLIYOR",
        ornekStatus: k?.ornekStatus ?? "PENDING",
        ornekAciklama: k?.ornekAciklama ?? null,
        degerlendirildiAt: k?.degerlendirildiAt?.toISOString() ?? null,
        degerlendirenAd: k?.degerlendirenId
          ? (degAd.get(k.degerlendirenId) ?? null)
          : null,
      };
    })
  );

  const gorunen = tumu ? gorevler : gorevler.filter((g) => g.kayitVar);
  // EGITIM_GEREKLI önce; sonra kurs sırası, sonra görev sırası.
  gorunen.sort(
    (a, b) =>
      Number(b.kursiyerDurum === "EGITIM_GEREKLI") -
        Number(a.kursiyerDurum === "EGITIM_GEREKLI") ||
      a.kursSirasi - b.kursSirasi ||
      a.gorevSirasi - b.gorevSirasi
  );

  return NextResponse.json({
    userId: kisi.id,
    ad: kisi.name ?? kisi.email ?? kisi.id,
    bolum: kisi.personnel?.bolum ?? null,
    packageId: paket.id,
    paketAdi: paketAd,
    tumu,
    toplamGorev: gorevler.length,
    gorevler: gorunen,
  });
}
