import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { ifsYuzde } from "@/lib/akademi/ifs-progress";
import { stripDeptPrefix, stripAreaPrefix } from "@/lib/akademi-ifs";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
  kapsamdaMi,
} from "@/lib/akademi/ifs-kapsam";

// IFS — bir paketteki (departmandaki) KİŞİ listesi (READ).
// Yetki: OR(akademi.kurs.edit, ifs.keyuser) — kapsam kararı TEK KAYNAK'ta:
// src/lib/akademi/ifs-kapsam.ts. Yönetici tüm kişileri görür (davranış
// DEĞİŞMEDİ); key user yalnız kendi atandığı bölümlerdeki kişileri görür.
//
// KİŞİ KAYNAĞI (iki küme birleşiyor):
//   1) atanmışlar: UserPackageAssignment ∪ DepartmentPackage.bolum → Personnel.bolum
//   2) atama kaydı OLMAYAN ama bu paketin görevlerinde değerlendirme satırı OLANLAR
// (2) bilerek var: atama tablosu bugün güvenilir değil — ölçüm: 3 kişi atanmış ama
// hiç dokunmamış, 2 kişi atanmamış ama dokunmuş. Görünmez kalmasınlar; `atamaVar`
// bayrağıyla ayırt ediliyor.
//
// YÜZDE: ifs-progress.ts (ifsYuzde) — yeni formül YOK.
//   payda = toplamGörev − FARKLI_DEPARTMAN, pay = BASARILI − (BASARILI ∧ FARKLI).
//
// DERS DEĞERLENDİRMESİ paket değil KURS bazlı (IfsCourseEvaluation.courseId) ve
// bir pakette 2-3 kurs var. ÖZETLEME KARARI: satırda hem `kurslar[]` kırılımı
// hem de EN DÜŞÜK seviyeli özet dönüyor.
//   Neden en düşük: kişi ancak TÜM alanları tamamsa "hazır" sayılır; en zayıf
//   alan belirleyicidir. "En son girilen" seçilseydi başka alandaki çözülmemiş
//   EGITIM_GEREKLI gizlenirdi — prod'da tam bu durumda 4 kişi var (ör. Emrah
//   Çankaya: Temel Kullanım BAŞARILI, Satınalma Yönetimi EĞİTİM_GEREKLİ).
//   Özetin girenAd/girenAt'ı, özeti üreten kursun kendisinden gelir; gösterilen
//   seviye ile not/atıf aynı kursa ait olsun diye.
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

  const packageId = req.nextUrl.searchParams.get("packageId")?.trim();
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }

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
  if (!paket) {
    return NextResponse.json({ error: "IFS paketi bulunamadı" }, { status: 404 });
  }

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
    return NextResponse.json({
      packageId: paket.id,
      ad: paketAd,
      kursSayisi: kurslar.length,
      gorevSayisi: gorevIds.length,
      kapsam: kapsam.yonetici ? "tumu" : "kendi-bolumum",
      satirlar: [],
    });
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

  return NextResponse.json({
    packageId: paket.id,
    ad: paketAd,
    kursSayisi: kurslar.length,
    gorevSayisi: gorevIds.length,
    kapsam: kapsam.yonetici ? "tumu" : "kendi-bolumum",
    satirlar: out,
  });
}
