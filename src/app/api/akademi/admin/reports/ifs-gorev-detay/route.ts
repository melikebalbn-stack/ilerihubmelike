import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { getLinkedBolums, resolveUserBolum } from "@/lib/user-personnel";

// IFS GÖREV BAZLI rapor — READ (read-only).
//
// NEDEN: mevcut uçlar kişi→görev yönünde çalışıyor. `ifs-evaluations` hücreleri
// yalnız TEK kullanıcı için döndürüyor (evaluations = userId verilmezse null),
// bu yüzden "şu görevde kim EGITIM_GEREKLI dedi" sorusu ancak kişi sayısı kadar
// istekle cevaplanabiliyordu. Bu uç aynı veriyi GÖREV ekseninde döndürür.
//
// Yetki + scope: `ifs-evaluations` GET ile BİREBİR aynı — akademi.report.view,
// akademi.admin => her bölüm, aksi halde yalnız kendi bölümü (başkası 403).
// Kullanıcı kaynağı da aynı: Personnel.bolum (atama/değerlendirme şartı YOK),
// böylece "hiç dokunmamış" kişi BEKLIYOR olarak görünür.
const KURSIYER_DURUMLAR = [
  "ORNEK_YAPILDI",
  "FARKLI_DEPARTMAN",
  "EGITIM_GEREKLI",
  "BEKLIYOR",
] as const;
type KursiyerDurum = (typeof KURSIYER_DURUMLAR)[number];

const ORNEK_STATUSLER = ["BASARILI", "TEKRAR_GEREKLI", "PENDING"] as const;
type OrnekStatusValue = (typeof ORNEK_STATUSLER)[number];

const querySchema = z.object({
  courseId: z.string().trim().min(1, "courseId gerekli"),
  bolum: z.string().trim().min(1).optional(),
  contentId: z.string().trim().min(1).optional(),
  durum: z.enum(KURSIYER_DURUMLAR).optional(),
});

const bosDagilim = (): Record<KursiyerDurum, number> => ({
  ORNEK_YAPILDI: 0,
  FARKLI_DEPARTMAN: 0,
  EGITIM_GEREKLI: 0,
  BEKLIYOR: 0,
});
const bosStatus = (): Record<OrnekStatusValue, number> => ({
  BASARILI: 0,
  TEKRAR_GEREKLI: 0,
  PENDING: 0,
});

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("ifs.rapor.view");
  if (error) return error;

  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  // courseId eksikse Zod'un tip mesajı ("expected string, received undefined")
  // kullanıcıya İngilizce sızıyor; ifs-evaluations gibi önce elle kontrol et.
  if (!req.nextUrl.searchParams.get("courseId")?.trim()) {
    return NextResponse.json({ error: "courseId gerekli" }, { status: 400 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const { courseId, bolum, contentId, durum } = parsed.data;

  // Scope — ifs-evaluations ile aynı kural.
  const perms = await getUserPermissions(callerId);
  // KAPSAM KARARI — burada OR BİLEREK duruyor (guard'larda tek anahtara indirildi).
  // Fark: guard kapıyı kapatır, 403 verir, hemen fark edilir. Kapsam kararı ise
  // sessizce AZ VERİ gösterir — yönetici kendini kendi bölümüne daraltılmış bulur
  // ve bunu kimse hata olarak bildirmez. Eski anahtarı burada bırakmak kimseyi
  // içeri ALMAZ (guard zaten ifs.* istiyor); yalnız geçiş döneminde yanlış
  // daraltmayı önler.
  const fullScope = perms.has("ifs.admin") || perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);
  if (!fullScope) {
    if (!ownBolum || (bolum && ownBolum !== bolum)) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
  }

  // Kapsam bölümleri: bolum verilmişse o; verilmemişse admin=tümü, aksi=kendi bölümü.
  const bolums = bolum
    ? [bolum]
    : fullScope
      ? await getLinkedBolums()
      : ownBolum
        ? [ownBolum]
        : [];

  const course = await prisma.course.findFirst({
    where: { id: courseId, isIfs: true },
    select: { id: true, title: true },
  });
  if (!course) {
    return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });
  }

  const tasks = await prisma.content.findMany({
    where: {
      courseId,
      type: "GOREV",
      isActive: true,
      ...(contentId ? { id: contentId } : {}),
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      ifsMeta: { select: { modul: true, altModul: true, ifsEkran: true } },
    },
  });

  // Kullanıcı kaynağı: Personnel.bolum (getUsersByBolum ile aynı filtre, çok
  // bölüm için tek sorgu). Atama/değerlendirme şartı YOK.
  const users = bolums.length
    ? await prisma.user.findMany({
        where: { personnel: { bolum: { in: bolums } } },
        select: {
          id: true,
          name: true,
          email: true,
          personnel: { select: { bolum: true } },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const userIds = users.map((u) => u.id);
  const taskIds = tasks.map((t) => t.id);

  // N+1 YOK: tüm hücreler tek sorguda.
  const evalRows =
    userIds.length && taskIds.length
      ? await prisma.ifsTaskEvaluation.findMany({
          where: { userId: { in: userIds }, contentId: { in: taskIds } },
          select: {
            contentId: true,
            userId: true,
            ornekYapildi: true,
            ornekAciklama: true,
            ornekStatus: true,
            kursiyerDurum: true,
            degerlendirildiAt: true,
            degerlendirenId: true,
          },
        })
      : [];

  // Değerlendiren adları — ayrı tek sorgu (değerlendiren kullanıcı kapsam
  // dışında olabilir, users[] üzerinden çözülemez).
  const degerlendirenIds = [
    ...new Set(evalRows.map((e) => e.degerlendirenId).filter(Boolean)),
  ] as string[];
  const degerlendirenler = degerlendirenIds.length
    ? await prisma.user.findMany({
        where: { id: { in: degerlendirenIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const degerlendirenAdi = new Map(
    degerlendirenler.map((d) => [d.id, d.name ?? d.email ?? d.id])
  );

  const hucre = new Map<string, (typeof evalRows)[number]>();
  for (const e of evalRows) hucre.set(`${e.contentId}|${e.userId}`, e);

  const tasksOut = tasks.map((t) => {
    const dagilim = bosDagilim();
    const ornekStatusDagilim = bosStatus();

    const kisiler = users.map((u) => {
      const e = hucre.get(`${t.id}|${u.id}`);
      const kursiyerDurum = (e?.kursiyerDurum ?? "BEKLIYOR") as KursiyerDurum;
      const ornekStatus = (e?.ornekStatus ?? "PENDING") as OrnekStatusValue;
      return {
        userId: u.id,
        ad: u.name ?? u.email ?? u.id,
        bolum: u.personnel?.bolum ?? null,
        kursiyerDurum,
        ornekYapildi: e?.ornekYapildi ?? false,
        ornekStatus,
        ornekAciklama: e?.ornekAciklama ?? null,
        degerlendirildiAt: e?.degerlendirildiAt?.toISOString() ?? null,
        degerlendirenAd: e?.degerlendirenId
          ? (degerlendirenAdi.get(e.degerlendirenId) ?? null)
          : null,
      };
    });

    // Dağılımlar HER ZAMAN tüm kişiler üzerinden — `durum` filtresi yalnız
    // kisiler[]'i kırpar, sayımı bozmaz (yüzde/oran kayması olmasın).
    for (const k of kisiler) {
      dagilim[k.kursiyerDurum]++;
      ornekStatusDagilim[k.ornekStatus]++;
    }

    return {
      contentId: t.id,
      konu: t.title,
      modul: t.ifsMeta?.modul ?? null,
      altModul: t.ifsMeta?.altModul ?? null,
      ifsEkran: t.ifsMeta?.ifsEkran ?? null,
      order: t.order,
      toplamKisi: kisiler.length,
      dagilim,
      ornekStatusDagilim,
      kisiler: durum ? kisiler.filter((k) => k.kursiyerDurum === durum) : kisiler,
    };
  });

  return NextResponse.json({
    courseId: course.id,
    courseTitle: course.title,
    scope: fullScope ? "full" : "own",
    bolums,
    durum: durum ?? null,
    tasks: tasksOut,
  });
}
