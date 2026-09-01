import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { ifsYuzde } from "@/lib/akademi/ifs-progress";
import { stripDeptPrefix, stripAreaPrefix } from "@/lib/akademi-ifs";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
} from "@/lib/akademi/ifs-kapsam";

// IFS EĞİTİM YAPISI — /ifs/egitimler ekranının tek veri kaynağı (READ).
//
// NEDEN YENİ UÇ: mevcutların hiçbiri bunu vermiyor —
//   · ifs-departman-ozet  → BÖLÜM bazlı (Personnel.bolum), bu ekran PAKET bazlı
//   · ifs/departments     → yalnız alan sayısı, yalnız aktif paketler, ilerleme yok
//   · ifs/areas           → tek paket, atama/değerlendirme sayıları yok
//
// Yetki: OR(akademi.kurs.edit, ifs.keyuser) — kapsam TEK KAYNAK'ta
// (ifs-kapsam.ts). Key user için sayımlar KENDİ BÖLÜMLERİNDEKİ kişilerle
// sınırlanır; yönetici için davranış DEĞİŞMEZ.
//
// YÜZDE: hesap TEK KAYNAK'ta — ifs-progress.ts (ifsYuzde). Yeni formül YOK.
//   payda = toplam − FARKLI_DEPARTMAN, pay = BASARILI − (BASARILI ∧ FARKLI).
//   Toplam = görev sayısı × atanmış kişi (olası görev-kişi çifti).
// Ekranın üç durumu ayırabilmesi için `degerlendirilmisSatir` ve `kayitSayisi`
// da dönüyor: 0 kayıt → "—", kayıt var ama karar yok → "Değerlendirilmedi".
export async function GET() {
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

  const paketler = await prisma.coursePackage.findMany({
    where: { isIfs: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      departmentPackages: { select: { bolum: true } },
      userAssignments: { select: { userId: true } },
      packageCourses: {
        orderBy: { order: "asc" },
        select: {
          course: {
            select: {
              id: true,
              title: true,
              isActive: true,
              contents: {
                where: { type: "GOREV", isActive: true },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  // Bölüm bazlı atamalar → kişi kümesi. Tek sorgu (bütün bölümler birden).
  const tumBolumler = [
    ...new Set(paketler.flatMap((p) => p.departmentPackages.map((d) => d.bolum))),
  ];
  const bolumKullanicilari = tumBolumler.length
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          personnel: {
            bolum: {
              in: kapsam.bolumler
                ? tumBolumler.filter((b) => kapsam.bolumler!.includes(b))
                : tumBolumler,
            },
          },
        },
        select: { id: true, personnel: { select: { bolum: true } } },
      })
    : [];
  const bolumeGoreKisiler = new Map<string, string[]>();
  for (const u of bolumKullanicilari) {
    const b = u.personnel?.bolum;
    if (!b) continue;
    const arr = bolumeGoreKisiler.get(b) ?? [];
    arr.push(u.id);
    bolumeGoreKisiler.set(b, arr);
  }

  // Tüm IFS görevlerinin değerlendirme satırları — tek sorgu, JS'te gruplanır.
  const tumGorevIds = paketler.flatMap((p) =>
    p.packageCourses.flatMap((pc) => pc.course.contents.map((c) => c.id))
  );
  const degerlendirmeler = tumGorevIds.length
    ? await prisma.ifsTaskEvaluation.findMany({
        where: { contentId: { in: tumGorevIds } },
        select: {
          contentId: true,
          userId: true,
          ornekStatus: true,
          kursiyerDurum: true,
        },
      })
    : [];
  const gorevBazli = new Map<string, typeof degerlendirmeler>();
  for (const e of degerlendirmeler) {
    const arr = gorevBazli.get(e.contentId) ?? [];
    arr.push(e);
    gorevBazli.set(e.contentId, arr);
  }

  interface Sayac {
    basarili: number;
    basariliVeFarkli: number;
    farkli: number;
    egitimTalebi: number;
    kararVerilmis: number;
    kayit: number;
  }
  const bosSayac = (): Sayac => ({
    basarili: 0,
    basariliVeFarkli: 0,
    farkli: 0,
    egitimTalebi: 0,
    kararVerilmis: 0,
    kayit: 0,
  });
  const topla = (hedef: Sayac, gorevIds: string[], kisiler: Set<string>) => {
    for (const gid of gorevIds) {
      for (const e of gorevBazli.get(gid) ?? []) {
        // Atanmamış kişinin işareti sayıma girmez — payda atanmış kişi
        // üzerinden kurulduğu için aksi halde oran şişer.
        if (kisiler.size > 0 && !kisiler.has(e.userId)) continue;
        hedef.kayit++;
        if (e.ornekStatus === "BASARILI") hedef.basarili++;
        if (e.ornekStatus === "BASARILI" || e.ornekStatus === "TEKRAR_GEREKLI")
          hedef.kararVerilmis++;
        if (e.kursiyerDurum === "FARKLI_DEPARTMAN") {
          hedef.farkli++;
          if (e.ornekStatus === "BASARILI") hedef.basariliVeFarkli++;
        } else if (e.kursiyerDurum === "EGITIM_GEREKLI") hedef.egitimTalebi++;
      }
    }
  };

  // Key user'da doğrudan atanmış (UserPackageAssignment) kişileri de bölüme göre
  // süzmek gerekiyor — onlar bolumeGoreKisiler haritasından gelmiyor.
  const kapsamdakiKisiler: Set<string> | null = kapsam.bolumler
    ? new Set(
        (
          await prisma.user.findMany({
            where: { personnel: { bolum: { in: kapsam.bolumler } } },
            select: { id: true },
          })
        ).map((u) => u.id)
      )
    : null;

  const departmanlar = paketler.map((p) => {
    const ad = stripDeptPrefix(p.name);

    // Key user kapsamı: doğrudan atanmış kişiler de bölüm süzgecinden geçer.
    // (kapsamdakiKisiler yalnız key user'da doludur; yönetici için null.)
    const kisiler = new Set<string>(
      p.userAssignments
        .map((a) => a.userId)
        .filter((uid) => kapsamdakiKisiler === null || kapsamdakiKisiler.has(uid))
    );
    for (const dp of p.departmentPackages)
      for (const uid of bolumeGoreKisiler.get(dp.bolum) ?? []) kisiler.add(uid);

    const alanlar = p.packageCourses.map((pc) => {
      const gorevIds = pc.course.contents.map((c) => c.id);
      const s = bosSayac();
      topla(s, gorevIds, kisiler);
      return {
        courseId: pc.course.id,
        ad: stripAreaPrefix(pc.course.title, ad),
        gorevSayisi: gorevIds.length,
        ilerlemePct: ifsYuzde(
          Math.max(s.basarili - s.basariliVeFarkli, 0),
          gorevIds.length * kisiler.size,
          s.farkli
        ),
        degerlendirilmisSatir: s.kararVerilmis,
        kayitSayisi: s.kayit,
        pasif: !pc.course.isActive,
      };
    });

    const tumGorevler = p.packageCourses.flatMap((pc) =>
      pc.course.contents.map((c) => c.id)
    );
    const toplam = bosSayac();
    topla(toplam, tumGorevler, kisiler);

    return {
      packageId: p.id,
      ad,
      alanSayisi: p.packageCourses.length,
      gorevSayisi: tumGorevler.length,
      atanmisKisi: kisiler.size,
      ilerlemePct: ifsYuzde(
        Math.max(toplam.basarili - toplam.basariliVeFarkli, 0),
        tumGorevler.length * kisiler.size,
        toplam.farkli
      ),
      egitimTalebi: toplam.egitimTalebi,
      degerlendirilmisSatir: toplam.kararVerilmis,
      kayitSayisi: toplam.kayit,
      pasif: !p.isActive,
      alanlar,
    };
  });

  return NextResponse.json({
    kapsam: kapsam.yonetici ? "tumu" : "kendi-bolumum",
    ozet: {
      departmanSayisi: departmanlar.length,
      alanSayisi: departmanlar.reduce((t, d) => t + d.alanSayisi, 0),
      gorevSayisi: departmanlar.reduce((t, d) => t + d.gorevSayisi, 0),
    },
    departmanlar,
  });
}
