import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum } from "@/lib/user-personnel";
import { ifsYuzde } from "@/lib/akademi/ifs-progress";

// IFS RAPOR — SEVİYE 2: bir bölümün kişi × eğitim satırları.
// Her kişi-eğitim çifti AYRI satır; yalnız DEĞERLENDİRME SATIRI OLAN çiftler
// döner (dokunulmamış kişi-kurs çifti listeyi şişirmesin — seviye 1'deki
// `egitimAlanKisi` tanımıyla tutarlı).
//
// Yetki + scope: `ifs-evaluations` GET ile BİREBİR aynı — akademi.report.view,
// akademi.admin => her bölüm, aksi halde yalnız kendi bölümü (başkası 403).
//
// pct: payda TEK KAYNAK'ta — src/lib/akademi/ifs-progress.ts (ifsYuzde).
// Pay bilerek çağırana bırakılmış; BURADAKİ KURAL: FARKLI_DEPARTMAN görevi
// paydadan düştüğü için PAYDAN DA düşer (aynı görev hem "kapsam dışı" hem
// "başarılı" işaretlenebiliyor — prod'da 8 satır; düzeltilmezse oran 100'ü
// aşıyordu, bkz. %107 vakası).
export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;

  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const bolum = req.nextUrl.searchParams.get("bolum")?.trim();
  if (!bolum) {
    return NextResponse.json({ error: "bolum gerekli" }, { status: 400 });
  }

  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  if (!fullScope) {
    const ownBolum = await resolveUserBolum(callerId);
    if (!ownBolum || ownBolum !== bolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
  }

  const users = await prisma.user.findMany({
    where: { personnel: { bolum } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  if (users.length === 0) {
    return NextResponse.json({ bolum, scope: fullScope ? "full" : "own", satirlar: [] });
  }
  const userIds = users.map((u) => u.id);
  const adOf = new Map(users.map((u) => [u.id, u.name ?? u.email ?? u.id]));

  // IFS görevleri (kurs bağıyla birlikte) — kurs başına toplam görev sayısı da buradan.
  const gorevler = await prisma.content.findMany({
    where: { type: "GOREV", isActive: true, course: { isIfs: true } },
    select: { id: true, courseId: true, course: { select: { title: true } } },
  });
  const kursOf = new Map(gorevler.map((g) => [g.id, g.courseId]));
  const kursAdi = new Map(gorevler.map((g) => [g.courseId, g.course.title]));
  const kursGorevSayisi = new Map<string, number>();
  for (const g of gorevler)
    kursGorevSayisi.set(g.courseId, (kursGorevSayisi.get(g.courseId) ?? 0) + 1);

  const rows = gorevler.length
    ? await prisma.ifsTaskEvaluation.findMany({
        where: {
          userId: { in: userIds },
          contentId: { in: gorevler.map((g) => g.id) },
        },
        select: {
          userId: true,
          contentId: true,
          ornekStatus: true,
          kursiyerDurum: true,
        },
      })
    : [];

  interface Sayac {
    basarili: number;
    basarisiz: number;
    egitimIhtiyaci: number;
    farkliDepartman: number;
    // Eğitmen kararı VERİLMİŞ görev (BASARILI + TEKRAR_GEREKLI). 0 ise pct'nin
    // %0 olması başarısızlık değil "henüz değerlendirilmedi" demektir.
    kararVerilmis: number;
    // Hem BASARILI hem FARKLI_DEPARTMAN olan görev — yüzdede paydan düşer.
    basariliVeFarkli: number;
  }
  const sayac = new Map<string, Sayac>(); // key: userId|courseId
  for (const r of rows) {
    const courseId = kursOf.get(r.contentId);
    if (!courseId) continue;
    const k = `${r.userId}|${courseId}`;
    const c =
      sayac.get(k) ??
      {
        basarili: 0,
        basarisiz: 0,
        egitimIhtiyaci: 0,
        farkliDepartman: 0,
        kararVerilmis: 0,
        basariliVeFarkli: 0,
      };
    if (r.ornekStatus === "BASARILI") c.basarili++;
    else if (r.ornekStatus === "TEKRAR_GEREKLI") c.basarisiz++;
    if (r.ornekStatus === "BASARILI" && r.kursiyerDurum === "FARKLI_DEPARTMAN")
      c.basariliVeFarkli++;
    if (r.ornekStatus === "BASARILI" || r.ornekStatus === "TEKRAR_GEREKLI")
      c.kararVerilmis++;
    if (r.kursiyerDurum === "EGITIM_GEREKLI") c.egitimIhtiyaci++;
    else if (r.kursiyerDurum === "FARKLI_DEPARTMAN") c.farkliDepartman++;
    sayac.set(k, c);
  }

  // Ders değerlendirmeleri (eğitmen + key user) — tek sorgu.
  const dersler = await prisma.ifsCourseEvaluation.findMany({
    where: { userId: { in: userIds }, course: { isIfs: true } },
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
  });
  const dersOf = new Map(dersler.map((d) => [`${d.userId}|${d.courseId}`, d]));

  // Değerlendiren + key user adları (kapsam dışı kişiler olabilir → ayrı sorgu).
  const disIds = [
    ...new Set(
      dersler.flatMap((d) =>
        [d.degerlendirenId, d.keyUserId].filter(Boolean) as string[]
      )
    ),
  ];
  const disKisiler = disIds.length
    ? await prisma.user.findMany({
        where: { id: { in: disIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const disAd = new Map(
    disKisiler.map((u) => [u.id, u.name ?? u.email ?? u.id])
  );

  const satirlar = [...sayac.entries()]
    .map(([key, c]) => {
      const [userId, courseId] = key.split("|");
      const toplamGorev = kursGorevSayisi.get(courseId) ?? 0;
      const d = dersOf.get(key);
      return {
        userId,
        ad: adOf.get(userId) ?? userId,
        courseId,
        egitimAdi: kursAdi.get(courseId) ?? courseId,
        toplamGorev,
        basariliGorev: c.basarili,
        basarisizGorev: c.basarisiz,
        degerlendirilmisGorev: c.kararVerilmis,
        pct: ifsYuzde(
          Math.max(c.basarili - c.basariliVeFarkli, 0),
          toplamGorev,
          c.farkliDepartman
        ),
        degerlendirme: {
          seviye: d?.seviye ?? null,
          not: d?.not ?? null,
          girenAd: d?.degerlendirenId
            ? (disAd.get(d.degerlendirenId) ?? null)
            : null,
          girenAt: d?.seviye || d?.not ? (d.updatedAt?.toISOString() ?? null) : null,
        },
        egitimIhtiyaci: c.egitimIhtiyaci,
        keyUser: {
          seviye: d?.keyUserSeviye ?? null,
          not: d?.keyUserNot ?? null,
          girenAd: d?.keyUserId ? (disAd.get(d.keyUserId) ?? null) : null,
          girenAt: d?.keyUserAt?.toISOString() ?? null,
        },
      };
    })
    .sort(
      (a, b) => a.ad.localeCompare(b.ad, "tr") || a.egitimAdi.localeCompare(b.egitimAdi, "tr")
    );

  // keyUserYetkim: çağıran BU bölümün key user'ı mı + yazma izni var mı.
  // Ekran, "Key User Değerlendirmesi" hücresini düzenlenebilir yapıp yapmayacağına
  // buna bakarak karar verir. Karar SUNUCUDA verilir — istemci permissions dizisine
  // bakıp kendi kendine karar vermesin; zorlama zaten ifs-keyuser-degerlendirme
  // ucunda (aynı iki koşul: izin + o bölüme atanmış olma).
  const keyUserYetkim =
    perms.has("akademi.ifs.keyuser") &&
    (await prisma.ifsKeyUser.count({
      where: { bolum, userId: callerId },
    })) > 0;

  return NextResponse.json({
    bolum,
    scope: fullScope ? "full" : "own",
    keyUserYetkim,
    satirlar,
  });
}
