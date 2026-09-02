import { prisma } from "@/lib/prisma";
import { ifsYuzde } from "@/lib/akademi/ifs-progress";
import { stripDeptPrefix, stripAreaPrefix } from "@/lib/akademi-ifs";
import type { IfsKapsam } from "@/lib/akademi/ifs-kapsam";
import { kapsamdaMi } from "@/lib/akademi/ifs-kapsam";

// IFS EĞİTİM VERİSİ — TEK KAYNAK.
//
// Üç uç (ifs-egitim-yapisi, ifs-paket-kisiler, ifs-kisi-gorevler) ve export ucu
// AYNI hesabı kullanır. Hesap buraya taşındı; uçlar yalnız guard + parametre
// ayrıştırma + JSON sarmalama yapar. Export ucu ayrı bir toplama yazsaydı iki
// hesap zamanla ayrışırdı — ekranla dosya farklı sayı gösterirdi.
//
// YÜZDE: ifs-progress.ts (ifsYuzde). YENİ FORMÜL YOK.

export type Kapsamlik = "tumu" | "kendi-bolumum";

// ═══════════════════════════════════════════════ 1) DEPARTMAN YAPISI (özet)
export async function ifsEgitimYapisi(kapsam: IfsKapsam) {
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
  // Kapsam DARALTILMIŞ ise (key user) boş kişi kümesi "süzme yok" değil
  // "hiç kimse" demektir → tüm satırlar atlanır, sayımlar 0 kalır.
  // Aksi halde key user, kendi bölümünde kimsesi olmayan paketlerde BAŞKA
  // bölümlerin kayıt/talep sayılarını görüyordu (ölçüldü: Sistem Geliştirme
  // key user'da 24, yöneticide 15 — daraltılmış görünüm geniş olandan fazlaydı).
  // Kapsam "tumu" iken davranış DEĞİŞMEZ: daraltilmis=false → eski akış.
  const daraltilmis = kapsam.bolumler !== null;
  const topla = (hedef: Sayac, gorevIds: string[], kisiler: Set<string>) => {
    if (daraltilmis && kisiler.size === 0) return;
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

  return {
    kapsam: kapsam.yonetici ? "tumu" : "kendi-bolumum",
    ozet: {
      departmanSayisi: departmanlar.length,
      alanSayisi: departmanlar.reduce((t, d) => t + d.alanSayisi, 0),
      gorevSayisi: departmanlar.reduce((t, d) => t + d.gorevSayisi, 0),
    },
    departmanlar,
  };
}

// ═══════════════════════════════════════════════ 2) PAKETTEKİ KİŞİLER
const SEVIYE_AGIRLIK: Record<string, number> = {
  BASARISIZ: 0,
  EGITIM_GEREKLI: 1,
  BASARILI: 2,
};

interface Kanaat {
  seviye: string | null;
  not: string | null;
  girenAd: string | null;
  girenAt: string | null;
}
const BOS_KANAAT: Kanaat = {
  seviye: null,
  not: null,
  girenAd: null,
  girenAt: null,
};

/** En zayıf (en düşük ağırlıklı) dolu kanaat; hiçbiri dolu değilse boş. */
function enZayif(list: Kanaat[]): Kanaat {
  let secilen: Kanaat | null = null;
  for (const k of list) {
    if (!k.seviye) continue;
    if (
      secilen === null ||
      SEVIYE_AGIRLIK[k.seviye] < SEVIYE_AGIRLIK[secilen.seviye as string]
    )
      secilen = k;
  }
  return secilen ?? BOS_KANAAT;
}

/** Paket bulunamazsa null. */
export async function ifsPaketKisileri(
  kapsam: IfsKapsam,
  callerId: string,
  packageId: string
) {
  const paket = await prisma.coursePackage.findFirst({
    where: { id: packageId, isIfs: true },
    select: {
      id: true,
      name: true,
      departmentPackages: { select: { bolum: true } },
      userAssignments: { select: { userId: true } },
      packageCourses: {
        orderBy: { order: "asc" },
        select: {
          course: {
            select: {
              id: true,
              title: true,
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
  if (!paket) return null;

  const paketAd = stripDeptPrefix(paket.name);
  const kurslar = paket.packageCourses.map((pc) => pc.course);
  const gorevIds = kurslar.flatMap((c) => c.contents.map((x) => x.id));
  const kursOf = new Map<string, string>();
  for (const c of kurslar) for (const x of c.contents) kursOf.set(x.id, c.id);

  // ── 1) atanmış kişiler ──
  const bolumler = paket.departmentPackages.map((d) => d.bolum);
  const bolumKisileri = bolumler.length
    ? await prisma.user.findMany({
        where: { isActive: true, personnel: { bolum: { in: bolumler } } },
        select: { id: true },
      })
    : [];
  const atanmis = new Set<string>([
    ...paket.userAssignments.map((a) => a.userId),
    ...bolumKisileri.map((u) => u.id),
  ]);

  // ── 2) değerlendirme satırları (kişi kümesini de genişletir) ──
  const satirlar = gorevIds.length
    ? await prisma.ifsTaskEvaluation.findMany({
        where: { contentId: { in: gorevIds } },
        select: {
          userId: true,
          contentId: true,
          ornekStatus: true,
          kursiyerDurum: true,
        },
      })
    : [];
  const tumKisiler = new Set<string>([
    ...atanmis,
    ...satirlar.map((s) => s.userId),
  ]);
  if (tumKisiler.size === 0) {
    return {
      packageId: paket.id,
      ad: paketAd,
      kursSayisi: kurslar.length,
      gorevSayisi: gorevIds.length,
      kapsam: (kapsam.yonetici ? "tumu" : "kendi-bolumum") as Kapsamlik,
      satirlar: [],
    };
  }

  const kisiler = await prisma.user.findMany({
    where: {
      id: { in: [...tumKisiler] },
      // Kapsam daraltma: key user yalnız kendi bölümlerini görür. Yönetici için
      // bolumler=null → koşul eklenmez, sonuç DEĞİŞMEZ.
      ...(kapsam.bolumler
        ? { personnel: { bolum: { in: kapsam.bolumler } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true } },
    },
    orderBy: { name: "asc" },
  });

  // ── ders değerlendirmeleri (eğitmen + key user) ──
  const dersler = kurslar.length
    ? await prisma.ifsCourseEvaluation.findMany({
        where: {
          userId: { in: [...tumKisiler] },
          courseId: { in: kurslar.map((c) => c.id) },
        },
        select: {
          userId: true,
          courseId: true,
          seviye: true,
          not: true,
          degerlendirenId: true,
          updatedAt: true,
          keyUserSeviye: true,
          keyUserNot: true,
          keyUserId: true,
          keyUserAt: true,
        },
      })
    : [];

  // giren adları — kapsam dışı kişi olabilir, ayrı tek sorgu
  const disIds = [
    ...new Set(
      dersler.flatMap((d) =>
        [d.degerlendirenId, d.keyUserId].filter(Boolean)
      ) as string[]
    ),
  ];
  const disKisiler = disIds.length
    ? await prisma.user.findMany({
        where: { id: { in: disIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const disAd = new Map(disKisiler.map((u) => [u.id, u.name ?? u.email ?? u.id]));
  const dersOf = new Map(dersler.map((d) => [`${d.userId}|${d.courseId}`, d]));

  // ── çağıranın key user olduğu bölümler ──
  const kendiAtamalari = await prisma.ifsKeyUser.findMany({
    where: { userId: callerId },
    select: { bolum: true },
  });
  const keyUserBolumleri = new Set(kendiAtamalari.map((k) => k.bolum));

  // ── görev sayaçları: kişi × kurs ──
  interface Sayac {
    basarili: number;
    basariliVeFarkli: number;
    farkli: number;
    egitimIstenen: number;
  }
  const bos = (): Sayac => ({
    basarili: 0,
    basariliVeFarkli: 0,
    farkli: 0,
    egitimIstenen: 0,
  });
  const sayac = new Map<string, Sayac>(); // userId|courseId
  for (const s of satirlar) {
    const cid = kursOf.get(s.contentId);
    if (!cid) continue;
    const k = `${s.userId}|${cid}`;
    const c = sayac.get(k) ?? bos();
    if (s.ornekStatus === "BASARILI") c.basarili++;
    if (s.kursiyerDurum === "FARKLI_DEPARTMAN") {
      c.farkli++;
      if (s.ornekStatus === "BASARILI") c.basariliVeFarkli++;
    } else if (s.kursiyerDurum === "EGITIM_GEREKLI") c.egitimIstenen++;
    sayac.set(k, c);
  }

  const out = kisiler.map((u) => {
    const bolum = u.personnel?.bolum ?? null;

    const kursSatirlari = kurslar.map((c) => {
      const key = `${u.id}|${c.id}`;
      const s = sayac.get(key) ?? bos();
      const d = dersOf.get(key);
      const toplam = c.contents.length;

      const egitmen: Kanaat = {
        seviye: d?.seviye ?? null,
        not: d?.not ?? null,
        girenAd: d?.degerlendirenId ? (disAd.get(d.degerlendirenId) ?? null) : null,
        girenAt: d?.seviye || d?.not ? (d.updatedAt?.toISOString() ?? null) : null,
      };
      const keyUser: Kanaat = {
        seviye: d?.keyUserSeviye ?? null,
        not: d?.keyUserNot ?? null,
        girenAd: d?.keyUserId ? (disAd.get(d.keyUserId) ?? null) : null,
        girenAt: d?.keyUserAt?.toISOString() ?? null,
      };

      return {
        courseId: c.id,
        egitimAdi: stripAreaPrefix(c.title, paketAd),
        toplamGorev: toplam,
        tamamlananGorev: Math.max(s.basarili - s.basariliVeFarkli, 0),
        ilerlemePct: ifsYuzde(
          Math.max(s.basarili - s.basariliVeFarkli, 0),
          toplam,
          s.farkli
        ),
        egitimIstenenSayisi: s.egitimIstenen,
        egitmen,
        keyUser,
        // Ayrışma KURS bazında ölçülür; satır özetinde "herhangi biri" mantığı
        // kullanılır ki tek alandaki ayrışma gizlenmesin.
        ayrisiyor:
          !!egitmen.seviye && !!keyUser.seviye && egitmen.seviye !== keyUser.seviye,
      };
    });

    const toplamGorev = kursSatirlari.reduce((t, k) => t + k.toplamGorev, 0);
    const tamamlanan = kursSatirlari.reduce((t, k) => t + k.tamamlananGorev, 0);
    const toplamFarkli = kurslar.reduce(
      (t, c) => t + (sayac.get(`${u.id}|${c.id}`)?.farkli ?? 0),
      0
    );

    return {
      userId: u.id,
      ad: u.name ?? u.email ?? u.id,
      bolum,
      atamaVar: atanmis.has(u.id),
      toplamGorev,
      tamamlananGorev: tamamlanan,
      ilerlemePct: ifsYuzde(tamamlanan, toplamGorev, toplamFarkli),
      egitimIstenenSayisi: kursSatirlari.reduce(
        (t, k) => t + k.egitimIstenenSayisi,
        0
      ),
      degerlendirilenKursSayisi: kursSatirlari.filter((k) => k.egitmen.seviye)
        .length,
      kursSayisi: kurslar.length,
      egitmen: enZayif(kursSatirlari.map((k) => k.egitmen)),
      keyUser: enZayif(kursSatirlari.map((k) => k.keyUser)),
      ayrisiyor: kursSatirlari.some((k) => k.ayrisiyor),
      keyUserYetkim: !!bolum && keyUserBolumleri.has(bolum),
      kurslar: kursSatirlari,
    };
  });

  return {
    packageId: paket.id,
    ad: paketAd,
    kursSayisi: kurslar.length,
    gorevSayisi: gorevIds.length,
    kapsam: (kapsam.yonetici ? "tumu" : "kendi-bolumum") as Kapsamlik,
    satirlar: out,
  };
}

// ═══════════════════════════════════════════════ 3) BİR KİŞİNİN GÖREVLERİ
export type KisiGorevSonuc =
  | { hata: "kisi-yok" }
  | { hata: "kapsam-disi" }
  | { hata: "paket-yok" }
  | { hata: null; veri: NonNullable<Awaited<ReturnType<typeof kisiGorevleriHesapla>>> };

export async function ifsKisiGorevleri(
  kapsam: IfsKapsam,
  userId: string,
  packageId: string,
  tumu: boolean
): Promise<KisiGorevSonuc> {
  const kisi = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true } },
    },
  });
  if (!kisi) return { hata: "kisi-yok" };
  // Kapsam kontrolü hedef kişinin bölümü üzerinden — key user başka bölümdeki
  // kişinin görevlerini göremez.
  if (!kapsamdaMi(kapsam, kisi.personnel?.bolum ?? null)) {
    return { hata: "kapsam-disi" };
  }
  const veri = await kisiGorevleriHesapla(kisi, packageId, tumu);
  if (!veri) return { hata: "paket-yok" };
  return { hata: null, veri };
}

async function kisiGorevleriHesapla(
  kisi: {
    id: string;
    name: string | null;
    email: string | null;
    personnel: { bolum: string | null } | null;
  },
  packageId: string,
  tumu: boolean
) {
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
  if (!paket) return null;

  const paketAd = stripDeptPrefix(paket.name);
  const gorevIds = paket.packageCourses.flatMap((pc) =>
    pc.course.contents.map((c) => c.id)
  );

  const satirlar = gorevIds.length
    ? await prisma.ifsTaskEvaluation.findMany({
        where: { userId: kisi.id, contentId: { in: gorevIds } },
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

  return {
    userId: kisi.id,
    ad: kisi.name ?? kisi.email ?? kisi.id,
    bolum: kisi.personnel?.bolum ?? null,
    packageId: paket.id,
    paketAdi: paketAd,
    tumu,
    toplamGorev: gorevler.length,
    gorevler: gorunen,
  };
}
