import { prisma } from "@/lib/prisma";

// IFS değerlendirme AGGREGATE hesabı — ortak katman.
// METRİK (route ve export ile AYNI): görev tamamlanma = ifsTaskEvaluation.ornek
// Status==="BASARILI" (eğitmen onayı) / toplam aktif GOREV; ders tamamlanma =
// ifsCourseEvaluation.seviye==="BASARILI". Matris self-mark'ı (completionPct)
// KULLANILMAZ. Kullanıcı→bölüm = Personnel.bolum (User.personnelId) konvansiyonu.
// N+1 YOK: kurs başına tek user + tek ifsTaskEvaluation + tek ifsCourseEvaluation
// sorgusu; gruplama JS'te.

export type OrnekStatus = "PENDING" | "BASARILI" | "TEKRAR_GEREKLI";
export type Seviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

export interface IfsSeviyeDist {
  BASARILI: number;
  EGITIM_GEREKLI: number;
  BASARISIZ: number;
  DEGERLENDIRILMEDI: number;
}
export interface IfsStatusDist {
  BASARILI: number;
  TEKRAR_GEREKLI: number;
  PENDING: number;
}

export const emptyStatus = (): IfsStatusDist => ({
  BASARILI: 0,
  TEKRAR_GEREKLI: 0,
  PENDING: 0,
});
export const emptySeviye = (): IfsSeviyeDist => ({
  BASARILI: 0,
  EGITIM_GEREKLI: 0,
  BASARISIZ: 0,
  DEGERLENDIRILMEDI: 0,
});

export interface IfsBolumRow {
  bolum: string;
  userCount: number;
  seviyeDist: IfsSeviyeDist;
  ornekStatusDist: IfsStatusDist;
  avgPct: number;
}
export interface IfsKisiRow {
  bolum: string;
  userId: string;
  ad: string;
  basariliGorev: number;
  gorevCount: number;
  pct: number;
  seviye: Seviye | null;
  not: string | null;
}
export interface IfsTotals {
  userCount: number;
  seviyeDist: IfsSeviyeDist;
  ornekStatusDist: IfsStatusDist;
  avgPct: number;
}

export interface IfsAggregateResult {
  courseId: string;
  courseTitle: string;
  gorevCount: number;
  /** Bölüm bazında satırlar (includeEmpty=false ise boş bölümler gizli). */
  bolumRows: IfsBolumRow[];
  /** Kapsamdaki TÜM kullanıcılar (bölüm fark etmez, boşlar dahil). */
  kisiRows: IfsKisiRow[];
  /** bolumRows üzerinden roll-up (empty gizliyse gizlenenler hariç). */
  totals: IfsTotals;
}

export interface ComputeIfsAggregateArgs {
  courseId: string;
  /** Kapsam bölümleri — çağıran taraf yetki/scope'a göre çözer. */
  bolums: string[];
  /** "all": değerlendirmesi olmayan bölümleri de bolumRows/totals'a kat. */
  includeEmpty?: boolean;
}

/**
 * Tek fonksiyon: mode:"bolum" (bolumRows+totals) ve mode:"kisi" (kisiRows)
 * çıktılarının İKİSİNİ birden üretir; çağıran istediğini seçer.
 * Kurs bulunamazsa veya isIfs değilse `null` döner (route 404 verir).
 */
export async function computeIfsAggregate(
  args: ComputeIfsAggregateArgs
): Promise<IfsAggregateResult | null> {
  const { courseId, bolums, includeEmpty = false } = args;

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
  if (!course) return null;
  const gorevIds = course.contents.map((c) => c.id);
  const gorevCount = gorevIds.length;

  // "Bölümü Belirsiz" kapsamda mı? Öyleyse: personnel-bağsız (personnelId null) VEYA
  // personnel.bolum null/boş olan, AMA bu IFS kursuna ATANMIŞ kullanıcıları da kat.
  // Normal bölüm seçiminde davranış DEĞİŞMEZ (yalnız o bölümün personel-bağlı kullanıcıları).
  const includeBelirsiz = bolums.includes(BOLUM_BELIRSIZ);
  const realBolums = bolums.filter((b) => b !== BOLUM_BELIRSIZ);

  const allUsers = bolums.length
    ? await prisma.user.findMany({
        where: {
          OR: [
            ...(realBolums.length ? [{ personnel: { bolum: { in: realBolums } } }] : []),
            ...(includeBelirsiz
              ? [
                  {
                    AND: [
                      {
                        // Personnel.bolum non-null String → "bölümsüz" = personnelId null
                        // VEYA bolum boş string. (null temsil edilemez.)
                        OR: [{ personnelId: null }, { personnel: { bolum: "" } }],
                      },
                      // Yalnız bu IFS kursuna atanmış bağsız kullanıcılar (materialize edilmiş).
                      { courseAssignments: { some: { assignment: { courseId } } } },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          personnel: { select: { bolum: true } },
        },
      })
    : [];

  const userBolum = new Map<string, string>();
  const bolumUsers = new Map<string, string[]>();
  for (const u of allUsers) {
    const raw = u.personnel?.bolum;
    // Normal: raw bolum (untrimmed → bolums ile birebir eşleşir, davranış değişmez).
    // Bağsız/boş + belirsiz kapsam → BOLUM_BELIRSIZ; kapsam yoksa eski gibi ATLA.
    const b = raw && raw.trim() !== "" ? raw : includeBelirsiz ? BOLUM_BELIRSIZ : undefined;
    if (!b) continue;
    userBolum.set(u.id, b);
    const arr = bolumUsers.get(b) ?? [];
    arr.push(u.id);
    bolumUsers.set(b, arr);
  }
  const uids = [...userBolum.keys()];

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
          select: { userId: true, seviye: true, not: true },
        })
      : [],
  ]);

  const basariliByUser = new Map<string, number>();
  const statusByBolum = new Map<string, IfsStatusDist>();
  for (const r of taskRows) {
    if (r.ornekStatus === "BASARILI")
      basariliByUser.set(r.userId, (basariliByUser.get(r.userId) ?? 0) + 1);
    const b = userBolum.get(r.userId);
    if (!b) continue;
    const d = statusByBolum.get(b) ?? emptyStatus();
    d[r.ornekStatus as OrnekStatus]++;
    statusByBolum.set(b, d);
  }
  const ceByUser = new Map(courseRows.map((r) => [r.userId, r]));
  const seviyeByUser = new Map<string, Seviye | null>();
  for (const r of courseRows)
    seviyeByUser.set(r.userId, (r.seviye ?? null) as Seviye | null);

  // ── kisiRows: kapsamdaki tüm kullanıcılar (boşlar dahil), pct↓ ad(tr) ──
  const kisiRows: IfsKisiRow[] = allUsers
    .filter((u) => userBolum.has(u.id))
    .map((u) => {
      const b = userBolum.get(u.id) as string;
      const bas = basariliByUser.get(u.id) ?? 0;
      const ce = ceByUser.get(u.id);
      return {
        bolum: b,
        userId: u.id,
        ad: u.name ?? u.email ?? u.id,
        basariliGorev: bas,
        gorevCount,
        pct: gorevCount > 0 ? Math.round((bas / gorevCount) * 100) : 0,
        seviye: (ce?.seviye ?? null) as Seviye | null,
        not: ce?.not ?? null,
      };
    })
    .sort((a, b) => b.pct - a.pct || a.ad.localeCompare(b.ad, "tr"));

  // ── bolumRows + totals (empty gizleme includeEmpty ile) ──
  const totalStatus = emptyStatus();
  const totalSeviye = emptySeviye();
  let totalPctSum = 0;
  let totalUserCount = 0;
  const bolumRows: IfsBolumRow[] = [];

  for (const b of bolums) {
    const list = bolumUsers.get(b) ?? [];
    const userCount = list.length;
    const seviyeDist = emptySeviye();
    let pctSum = 0;
    for (const uid of list) {
      const bas = basariliByUser.get(uid) ?? 0;
      pctSum += gorevCount > 0 ? (bas / gorevCount) * 100 : 0;
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
    if (evaluated === 0 && statusTotal === 0 && !includeEmpty) continue; // boş bölüm gizle

    const avgPct = userCount > 0 ? Math.round(pctSum / userCount) : 0;
    bolumRows.push({ bolum: b, userCount, seviyeDist, ornekStatusDist, avgPct });

    totalUserCount += userCount;
    totalPctSum += pctSum;
    (Object.keys(totalStatus) as OrnekStatus[]).forEach(
      (k) => (totalStatus[k] += ornekStatusDist[k])
    );
    (Object.keys(totalSeviye) as Array<keyof IfsSeviyeDist>).forEach(
      (k) => (totalSeviye[k] += seviyeDist[k])
    );
  }

  bolumRows.sort((a, b) => a.bolum.localeCompare(b.bolum, "tr"));

  return {
    courseId: course.id,
    courseTitle: course.title,
    gorevCount,
    bolumRows,
    kisiRows,
    totals: {
      userCount: totalUserCount,
      seviyeDist: totalSeviye,
      ornekStatusDist: totalStatus,
      avgPct: totalUserCount > 0 ? Math.round(totalPctSum / totalUserCount) : 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAKET DÜZEYİ RAPOR (export) — paketteki her isIfs kurs için computeIfsAggregate
// çağrılıp birleştirilir. Bir paket birden çok kurs içerdiğinden ders-seviyesi
// (seviye/not) kurs bazında anlamlıdır: kişi detayı (userId × kurs) satırlıdır.
// ─────────────────────────────────────────────────────────────────────────────

export interface IfsRaporBolumSummary {
  bolum: string;
  userCount: number;
  totalGorev: number; // paket toplam GOREV (Σ kurs gorevCount)
  basariliGorev: number; // Σ kullanıcı×kurs BASARILI görev
  avgPct: number; // kullanıcı bazında (paketBasarili/paketToplamGorev) ortalaması
  seviyeDist: IfsSeviyeDist; // Σ kurs (kullanıcı-kurs çiftleri)
  pending: number; // Σ kurs ornekStatusDist.PENDING
}
export interface IfsRaporKisiRow {
  bolum: string;
  ad: string;
  kurs: string;
  gorevCount: number;
  basariliGorev: number;
  pct: number;
  seviye: Seviye | null;
  not: string | null;
}
export interface IfsRaporData {
  packageName: string;
  courseTitles: string[];
  totalGorev: number;
  bolumSummary: IfsRaporBolumSummary[];
  kisiDetay: IfsRaporKisiRow[];
  totals: {
    userCount: number;
    basariliGorev: number;
    totalGorev: number;
    avgPct: number;
    seviyeDist: IfsSeviyeDist;
    pending: number;
  };
}

export interface BuildIfsRaporArgs {
  packageId: string;
  bolums: string[]; // kapsam (çağıran scope'a göre çözer)
  includeEmpty?: boolean; // "all": aktivitesi olmayan bölümleri de göster
}

/**
 * Paket + kapsam bölümleri için birleşik yönetim raporu verisi üretir.
 * Paket bulunamazsa `null`. isIfs kursu olmayan paket → boş raporlar.
 */
export async function buildIfsRaporData(
  args: BuildIfsRaporArgs
): Promise<IfsRaporData | null> {
  const { packageId, bolums, includeEmpty = false } = args;

  const pkg = await prisma.coursePackage.findFirst({
    where: { id: packageId },
    select: {
      id: true,
      name: true,
      packageCourses: {
        where: { course: { isIfs: true } },
        orderBy: { order: "asc" },
        select: { course: { select: { id: true, isIfs: true } } },
      },
    },
  });
  if (!pkg) return null;

  const courseIds = pkg.packageCourses
    .map((pc) => pc.course)
    .filter((c) => c.isIfs)
    .map((c) => c.id);

  // Her kurs için AYNI kapsamla aggregate (boşlar dahil ki tüm bölümler görünsün;
  // empty gizleme birleştirme sonrası paket düzeyinde uygulanır).
  const aggs: IfsAggregateResult[] = [];
  for (const courseId of courseIds) {
    const agg = await computeIfsAggregate({
      courseId,
      bolums,
      includeEmpty: true,
    });
    if (agg) aggs.push(agg);
  }

  const totalGorev = aggs.reduce((s, a) => s + a.gorevCount, 0);
  const courseTitles = aggs.map((a) => a.courseTitle);

  // Kişi detayı: (kullanıcı × kurs) satırlı — seviye/not kurs bazında doğru.
  const kisiDetay: IfsRaporKisiRow[] = [];
  // Kullanıcı bazında paket toplamı (avgPct için).
  const userAgg = new Map<
    string,
    { bolum: string; ad: string; basarili: number }
  >();
  for (const a of aggs) {
    for (const k of a.kisiRows) {
      kisiDetay.push({
        bolum: k.bolum,
        ad: k.ad,
        kurs: a.courseTitle,
        gorevCount: k.gorevCount,
        basariliGorev: k.basariliGorev,
        pct: k.pct,
        seviye: k.seviye,
        not: k.not,
      });
      const cur = userAgg.get(k.userId) ?? {
        bolum: k.bolum,
        ad: k.ad,
        basarili: 0,
      };
      cur.basarili += k.basariliGorev;
      userAgg.set(k.userId, cur);
    }
  }

  // Bölüm özeti: kurs bolumRows'ları toplanır.
  const summaryMap = new Map<
    string,
    {
      userCount: number;
      seviyeDist: IfsSeviyeDist;
      pending: number;
      hasActivity: boolean;
    }
  >();
  for (const a of aggs) {
    for (const br of a.bolumRows) {
      const cur = summaryMap.get(br.bolum) ?? {
        userCount: br.userCount, // bölüm üyeliği kurstan bağımsız → sabit
        seviyeDist: emptySeviye(),
        pending: 0,
        hasActivity: false,
      };
      cur.userCount = br.userCount;
      (Object.keys(cur.seviyeDist) as Array<keyof IfsSeviyeDist>).forEach(
        (kk) => (cur.seviyeDist[kk] += br.seviyeDist[kk])
      );
      cur.pending += br.ornekStatusDist.PENDING;
      const evaluated =
        br.seviyeDist.BASARILI +
        br.seviyeDist.EGITIM_GEREKLI +
        br.seviyeDist.BASARISIZ;
      const statusTotal =
        br.ornekStatusDist.BASARILI +
        br.ornekStatusDist.TEKRAR_GEREKLI +
        br.ornekStatusDist.PENDING;
      if (evaluated > 0 || statusTotal > 0) cur.hasActivity = true;
      summaryMap.set(br.bolum, cur);
    }
  }

  // Kişi paket-toplamları → bölüm basariliGorev + avgPct
  const bolumPctSum = new Map<string, number>();
  const bolumBasarili = new Map<string, number>();
  for (const u of userAgg.values()) {
    const userPct = totalGorev > 0 ? (u.basarili / totalGorev) * 100 : 0;
    bolumPctSum.set(u.bolum, (bolumPctSum.get(u.bolum) ?? 0) + userPct);
    bolumBasarili.set(
      u.bolum,
      (bolumBasarili.get(u.bolum) ?? 0) + u.basarili
    );
  }

  const bolumSummary: IfsRaporBolumSummary[] = [];
  const totalSeviye = emptySeviye();
  let totUserCount = 0;
  let totBasarili = 0;
  let totPending = 0;
  let totPctSum = 0;
  for (const [bolum, s] of summaryMap) {
    if (!s.hasActivity && !includeEmpty) continue;
    const basariliGorev = bolumBasarili.get(bolum) ?? 0;
    const avgPct =
      s.userCount > 0
        ? Math.round((bolumPctSum.get(bolum) ?? 0) / s.userCount)
        : 0;
    bolumSummary.push({
      bolum,
      userCount: s.userCount,
      totalGorev,
      basariliGorev,
      avgPct,
      seviyeDist: s.seviyeDist,
      pending: s.pending,
    });
    totUserCount += s.userCount;
    totBasarili += basariliGorev;
    totPending += s.pending;
    totPctSum += bolumPctSum.get(bolum) ?? 0;
    (Object.keys(totalSeviye) as Array<keyof IfsSeviyeDist>).forEach(
      (kk) => (totalSeviye[kk] += s.seviyeDist[kk])
    );
  }
  bolumSummary.sort((a, b) => a.bolum.localeCompare(b.bolum, "tr"));

  // Kişi detayını sadece özet'te görünen (aktif) bölümlerle sınırla.
  const shownBolums = new Set(bolumSummary.map((b) => b.bolum));
  const kisiDetayFiltered = kisiDetay
    .filter((r) => shownBolums.has(r.bolum))
    .sort(
      (a, b) =>
        a.bolum.localeCompare(b.bolum, "tr") ||
        a.ad.localeCompare(b.ad, "tr") ||
        a.kurs.localeCompare(b.kurs, "tr")
    );

  return {
    packageName: pkg.name,
    courseTitles,
    totalGorev,
    bolumSummary,
    kisiDetay: kisiDetayFiltered,
    totals: {
      userCount: totUserCount,
      basariliGorev: totBasarili,
      totalGorev,
      avgPct: totUserCount > 0 ? Math.round(totPctSum / totUserCount) : 0,
      seviyeDist: totalSeviye,
      pending: totPending,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-IFS-RAPOR-2b: BÖLÜM-ÖNCELİKLİ rapor — bir bölümün kullanıcılarının ATANDIĞI
// TÜM isIfs kurslar üzerinden birleşik durum + son tarih. Görev metriği yine
// ornekStatus==='BASARILI' / aktif GOREV. Kişi×kurs satırlı.
// "Bölümü Belirsiz" = personnelId bağı olmayan IFS-atamalı kullanıcılar
// (sessiz düşme YASAK — bu grup ayrı bir "bölüm" olarak raporlanır).
// ─────────────────────────────────────────────────────────────────────────────

export const BOLUM_BELIRSIZ = "Bölümü Belirsiz";

/**
 * Bölümsüz/bağsız (personnelId null VEYA personnel.bolum null/boş) + IFS-atamalı
 * EN AZ BİR kullanıcı var mı? Meta (dropdown) yalnız varsa "Bölümü Belirsiz" gösterir
 * (boş grup gösterme). Yalnız admin scope'ta çağrılır.
 */
export async function hasBelirsizIfsUsers(): Promise<boolean> {
  const row = await prisma.userCourseAssignment.findFirst({
    where: {
      assignment: { course: { isIfs: true } },
      user: { OR: [{ personnelId: null }, { personnel: { bolum: "" } }] },
    },
    select: { id: true },
  });
  return row != null;
}

export type IfsDurum = "YOLUNDA" | "GECIKTI" | "TARIHSIZ";

export interface IfsBolumKursRow {
  courseId: string;
  kursAd: string;
  gorevCount: number;
  basarili: number;
  pct: number;
  dueDate: string | null; // ISO
  durum: IfsDurum;
  // Ders değerlendirmesi (eğitmen nitel kararı) — ifs_course_evaluations.seviye.
  // null = henüz değerlendirilmemiş. (Yorum/not KAPSAM DIŞI — İK: tek satır.)
  seviye: Seviye | null;
}
export interface IfsBolumKisi {
  userId: string;
  adSoyad: string;
  kurslar: IfsBolumKursRow[];
}
export interface IfsBolumReport {
  bolum: string;
  summary: {
    kisiSayisi: number;
    toplamGorev: number;
    basariliGorev: number;
    ortalamaPct: number;
    gecikenKisi: number;
  };
  kisiler: IfsBolumKisi[];
}

function durumOf(dueDate: Date | null, pct: number, now: Date): IfsDurum {
  if (dueDate == null) return "TARIHSIZ";
  if (dueDate < now && pct < 100) return "GECIKTI";
  return "YOLUNDA";
}

/**
 * Bir bölümün (veya "Bölümü Belirsiz" grubunun) IFS eğitim durumu.
 * now: gecikme eşiği (route new Date() geçer). Kurs bulunmasa boş rapor döner.
 */
export async function computeIfsBolumReport(args: {
  bolum: string;
  now: Date;
}): Promise<IfsBolumReport> {
  const { bolum, now } = args;
  const belirsiz = bolum === BOLUM_BELIRSIZ;

  // Kapsamdaki kullanıcıların IFS kurs atamaları (tek sorgu, kurs+dueDate dahil).
  const rows = await prisma.userCourseAssignment.findMany({
    where: {
      assignment: { course: { isIfs: true } },
      // Belirsiz: personnelId null VEYA personnel.bolum null/boş (personnelId dolu ama
      // bölümü olmayan kullanıcı da dahil). Normal bölüm: aynen o bölümün bağlı kullanıcıları.
      user: belirsiz
        ? { OR: [{ personnelId: null }, { personnel: { bolum: "" } }] }
        : { personnel: { bolum } },
    },
    select: {
      userId: true,
      dueDate: true,
      user: { select: { name: true, email: true } },
      assignment: {
        select: { courseId: true, course: { select: { title: true } } },
      },
    },
  });

  // (userId, courseId) benzersizle — bir kurs için birden çok atama satırı olabilir;
  // dueDate en erken (tighten anlamı) alınır.
  type Acc = {
    userId: string;
    adSoyad: string;
    courseId: string;
    kursAd: string;
    dueDate: Date | null;
  };
  const key = (u: string, c: string) => `${u}::${c}`;
  const ucMap = new Map<string, Acc>();
  const userName = new Map<string, string>();
  for (const r of rows) {
    const ad = r.user.name ?? r.user.email ?? r.userId;
    userName.set(r.userId, ad);
    const k = key(r.userId, r.assignment.courseId);
    const cur = ucMap.get(k);
    const due = r.dueDate ?? null;
    if (!cur) {
      ucMap.set(k, {
        userId: r.userId,
        adSoyad: ad,
        courseId: r.assignment.courseId,
        kursAd: r.assignment.course.title,
        dueDate: due,
      });
    } else if (due != null && (cur.dueDate == null || due < cur.dueDate)) {
      cur.dueDate = due; // en erken tarih kazanır
    }
  }

  const accs = [...ucMap.values()];
  const courseIds = [...new Set(accs.map((a) => a.courseId))];
  const userIds = [...new Set(accs.map((a) => a.userId))];

  // Kurs başına aktif GOREV içerikleri + BASARILI görev değerlendirmeleri +
  // ders seviye değerlendirmeleri (computeIfsAggregate ile AYNI desen).
  const [contents, evals, courseEvals] = await Promise.all([
    courseIds.length
      ? prisma.content.findMany({
          where: { courseId: { in: courseIds }, isActive: true, type: "GOREV" },
          select: { id: true, courseId: true },
        })
      : [],
    courseIds.length && userIds.length
      ? prisma.ifsTaskEvaluation.findMany({
          where: {
            userId: { in: userIds },
            ornekStatus: "BASARILI",
            content: { courseId: { in: courseIds } },
          },
          select: { userId: true, content: { select: { courseId: true } } },
        })
      : [],
    courseIds.length && userIds.length
      ? prisma.ifsCourseEvaluation.findMany({
          where: { courseId: { in: courseIds }, userId: { in: userIds } },
          select: { userId: true, courseId: true, seviye: true },
        })
      : [],
  ]);

  const gorevByCourse = new Map<string, number>();
  for (const c of contents)
    gorevByCourse.set(c.courseId, (gorevByCourse.get(c.courseId) ?? 0) + 1);
  const basariliByUC = new Map<string, number>();
  for (const e of evals) {
    const k = key(e.userId, e.content.courseId);
    basariliByUC.set(k, (basariliByUC.get(k) ?? 0) + 1);
  }
  // Ders seviye değerlendirmesi (user×course) — null = değerlendirilmemiş.
  const seviyeByUC = new Map<string, Seviye | null>();
  for (const e of courseEvals) {
    seviyeByUC.set(key(e.userId, e.courseId), (e.seviye ?? null) as Seviye | null);
  }

  // Kişi×kurs satırları
  const kisiMap = new Map<string, IfsBolumKisi>();
  let toplamGorev = 0;
  let basariliGorev = 0;
  const gecikenUsers = new Set<string>();
  for (const a of accs) {
    const gorevCount = gorevByCourse.get(a.courseId) ?? 0;
    const basarili = basariliByUC.get(key(a.userId, a.courseId)) ?? 0;
    const pct = gorevCount > 0 ? Math.round((basarili / gorevCount) * 100) : 0;
    const durum = durumOf(a.dueDate, pct, now);
    toplamGorev += gorevCount;
    basariliGorev += basarili;
    if (durum === "GECIKTI") gecikenUsers.add(a.userId);

    let kisi = kisiMap.get(a.userId);
    if (!kisi) {
      kisi = { userId: a.userId, adSoyad: a.adSoyad, kurslar: [] };
      kisiMap.set(a.userId, kisi);
    }
    kisi.kurslar.push({
      courseId: a.courseId,
      kursAd: a.kursAd,
      gorevCount,
      basarili,
      pct,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      durum,
      seviye: seviyeByUC.get(key(a.userId, a.courseId)) ?? null,
    });
  }

  const kisiler = [...kisiMap.values()]
    .map((k) => ({
      ...k,
      kurslar: k.kurslar.sort((a, b) => a.kursAd.localeCompare(b.kursAd, "tr")),
    }))
    // Geciken kişiler üstte (yönetim önceliği), sonra ad(tr).
    .sort((a, b) => {
      const ga = gecikenUsers.has(a.userId) ? 0 : 1;
      const gb = gecikenUsers.has(b.userId) ? 0 : 1;
      return ga - gb || a.adSoyad.localeCompare(b.adSoyad, "tr");
    });

  return {
    bolum,
    summary: {
      kisiSayisi: kisiMap.size,
      toplamGorev,
      basariliGorev,
      ortalamaPct:
        toplamGorev > 0 ? Math.round((basariliGorev / toplamGorev) * 100) : 0,
      gecikenKisi: gecikenUsers.size,
    },
    kisiler,
  };
}
