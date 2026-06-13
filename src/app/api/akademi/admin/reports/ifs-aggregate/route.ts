import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum, getLinkedBolums } from "@/lib/user-personnel";

// IFS değerlendirme grafik raporu — AGGREGATE.
// METRİK: görev tamamlanma = ifsTaskEvaluation.ornekStatus===BASARILI (eğitmen
// onayı), ders tamamlanma = ifsCourseEvaluation.seviye===BASARILI. Matris
// completionPct'i (ContentProgress self-mark) KULLANILMAZ.
// N+1 YOK: tek user sorgusu + tek ifsTaskEvaluation + tek ifsCourseEvaluation;
// gruplama JS'te.
const querySchema = z.object({
  courseId: z.string().trim().min(1),
  bolum: z.string().trim().optional(),
  all: z.coerce.boolean().optional(), // boş bölümleri de göster
});

type OrnekStatus = "PENDING" | "BASARILI" | "TEKRAR_GEREKLI";
type Seviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

const emptyStatus = () => ({ BASARILI: 0, TEKRAR_GEREKLI: 0, PENDING: 0 });
const emptySeviye = () => ({
  BASARILI: 0,
  EGITIM_GEREKLI: 0,
  BASARISIZ: 0,
  DEGERLENDIRILMEDI: 0,
});

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

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const { courseId, bolum, all } = parsed.data;

  // Kurs (IFS) + aktif GOREV içerikleri
  const course = await prisma.course.findFirst({
    where: { id: courseId, isIfs: true },
    select: {
      id: true,
      title: true,
      contents: {
        where: { isActive: true, type: "GOREV" },
        select: { id: true },
      },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });
  }
  const gorevIds = course.contents.map((c) => c.id);
  const gorevCount = gorevIds.length;

  // Scope: müdür yalnız kendi bölümünü görebilir.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);

  // ── KİŞİ BAZINDA (bolum seçili) ──
  if (bolum) {
    if (!fullScope && ownBolum !== bolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
    const users = await prisma.user.findMany({
      where: { personnel: { bolum } },
      select: { id: true, name: true, email: true },
    });
    const uids = users.map((u) => u.id);

    const [taskRows, courseRows] = await Promise.all([
      gorevIds.length && uids.length
        ? prisma.ifsTaskEvaluation.findMany({
            where: {
              contentId: { in: gorevIds },
              userId: { in: uids },
              ornekStatus: "BASARILI",
            },
            select: { userId: true },
          })
        : [],
      uids.length
        ? prisma.ifsCourseEvaluation.findMany({
            where: { courseId, userId: { in: uids } },
            select: { userId: true, seviye: true, not: true },
          })
        : [],
    ]);

    const basariliByUser = new Map<string, number>();
    for (const r of taskRows)
      basariliByUser.set(r.userId, (basariliByUser.get(r.userId) ?? 0) + 1);
    const ceByUser = new Map(courseRows.map((r) => [r.userId, r]));

    const usersOut = users
      .map((u) => {
        const b = basariliByUser.get(u.id) ?? 0;
        const ce = ceByUser.get(u.id);
        return {
          userId: u.id,
          ad: u.name ?? u.email ?? u.id,
          basariliGorev: b,
          gorevCount,
          pct: gorevCount > 0 ? Math.round((b / gorevCount) * 100) : 0,
          seviye: (ce?.seviye ?? null) as Seviye | null,
          not: ce?.not ?? null,
        };
      })
      .sort((a, b) => b.pct - a.pct || a.ad.localeCompare(b.ad, "tr"));

    return NextResponse.json({
      mode: "kisi",
      bolum,
      courseTitle: course.title,
      gorevCount,
      users: usersOut,
    });
  }

  // ── BÖLÜM BAZINDA (bolum yok) ──
  const bolums = fullScope
    ? await getLinkedBolums()
    : ownBolum
      ? [ownBolum]
      : [];

  const allUsers = bolums.length
    ? await prisma.user.findMany({
        where: { personnel: { bolum: { in: bolums } } },
        select: { id: true, personnel: { select: { bolum: true } } },
      })
    : [];

  const userBolum = new Map<string, string>();
  const bolumUsers = new Map<string, string[]>();
  for (const u of allUsers) {
    const b = u.personnel?.bolum;
    if (!b) continue;
    userBolum.set(u.id, b);
    const arr = bolumUsers.get(b) ?? [];
    arr.push(u.id);
    bolumUsers.set(b, arr);
  }
  const uids = allUsers.map((u) => u.id);

  const [taskRows, courseRows] = await Promise.all([
    gorevIds.length && uids.length
      ? prisma.ifsTaskEvaluation.findMany({
          where: { contentId: { in: gorevIds }, userId: { in: uids } },
          select: { userId: true, ornekStatus: true },
        })
      : [],
    uids.length
      ? prisma.ifsCourseEvaluation.findMany({
          where: { courseId, userId: { in: uids } },
          select: { userId: true, seviye: true },
        })
      : [],
  ]);

  const basariliByUser = new Map<string, number>();
  const statusByBolum = new Map<string, ReturnType<typeof emptyStatus>>();
  for (const r of taskRows) {
    if (r.ornekStatus === "BASARILI")
      basariliByUser.set(r.userId, (basariliByUser.get(r.userId) ?? 0) + 1);
    const b = userBolum.get(r.userId);
    if (!b) continue;
    const d = statusByBolum.get(b) ?? emptyStatus();
    d[r.ornekStatus as OrnekStatus]++;
    statusByBolum.set(b, d);
  }
  const seviyeByUser = new Map<string, Seviye | null>();
  for (const r of courseRows)
    seviyeByUser.set(r.userId, (r.seviye ?? null) as Seviye | null);

  const totalStatus = emptyStatus();
  const totalSeviye = emptySeviye();
  let totalPctSum = 0;
  let totalUserCount = 0;
  const bolumsOut: Array<{
    bolum: string;
    userCount: number;
    seviyeDist: ReturnType<typeof emptySeviye>;
    ornekStatusDist: ReturnType<typeof emptyStatus>;
    avgPct: number;
  }> = [];

  for (const b of bolums) {
    const list = bolumUsers.get(b) ?? [];
    const userCount = list.length;
    const seviyeDist = emptySeviye();
    let pctSum = 0;
    for (const uid of list) {
      const basarili = basariliByUser.get(uid) ?? 0;
      pctSum += gorevCount > 0 ? (basarili / gorevCount) * 100 : 0;
      const sev = seviyeByUser.get(uid);
      if (sev === "BASARILI" || sev === "EGITIM_GEREKLI" || sev === "BASARISIZ")
        seviyeDist[sev]++;
      else seviyeDist.DEGERLENDIRILMEDI++;
    }
    const ornekStatusDist = statusByBolum.get(b) ?? emptyStatus();
    const evaluated =
      seviyeDist.BASARILI + seviyeDist.EGITIM_GEREKLI + seviyeDist.BASARISIZ;
    const statusTotal =
      ornekStatusDist.BASARILI +
      ornekStatusDist.TEKRAR_GEREKLI +
      ornekStatusDist.PENDING;
    if (evaluated === 0 && statusTotal === 0 && !all) continue; // boş bölüm gizle

    const avgPct = userCount > 0 ? Math.round(pctSum / userCount) : 0;
    bolumsOut.push({ bolum: b, userCount, seviyeDist, ornekStatusDist, avgPct });

    totalUserCount += userCount;
    totalPctSum += pctSum;
    (Object.keys(totalStatus) as OrnekStatus[]).forEach(
      (k) => (totalStatus[k] += ornekStatusDist[k])
    );
    (Object.keys(totalSeviye) as Array<keyof typeof totalSeviye>).forEach(
      (k) => (totalSeviye[k] += seviyeDist[k])
    );
  }

  bolumsOut.sort((a, b) => a.bolum.localeCompare(b.bolum, "tr"));

  return NextResponse.json({
    mode: "bolum",
    courseTitle: course.title,
    gorevCount,
    bolums: bolumsOut,
    totals: {
      userCount: totalUserCount,
      seviyeDist: totalSeviye,
      ornekStatusDist: totalStatus,
      avgPct: totalUserCount > 0 ? Math.round(totalPctSum / totalUserCount) : 0,
    },
  });
}
