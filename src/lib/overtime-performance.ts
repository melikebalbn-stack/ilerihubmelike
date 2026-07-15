/**
 * Mesai üretim performansı — ortak veri katmanı (PR-B + FAZ 2).
 * Hem /api/overtime/performans sayfası hem günlük/haftalık mail cron'ları bunu kullanır.
 * Yalnız status=APPROVED + hedefAdet/gerceklesenAdet DOLU kayıtlar; workDepartment grupla; % artan sırala.
 *
 * FAZ 2: period-bazlı proration (periodStart/periodEnd), üretim ayracı (DepartmentDefinition.uretimYapar),
 * eksik-veri raporu, veri-hijyeni uyarıları, hurda KPI, aylık aggregate.
 */
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'

export type PerfKisi = { ad: string; sicil: string; hedef: number; gerceklesen: number; yuzde: number; not: string | null }
export type PerfBolum = { ad: string; hedef: number; gerceklesen: number; yuzde: number; kisiler: PerfKisi[] }
export type PerfGenel = { hedef: number; gerceklesen: number; yuzde: number | null }

export type Granularity = 'day' | 'week' | 'month'

/** Günlük görünümde AYRI raporlanan vardiya-hafta kayıtları (proration UYGULANMAZ). */
export type VardiyaHaftaAyri = {
  formSayisi: number
  aciklama: string
  formlar: { formNo: string; periodStart: string; periodEnd: string }[]
}
export type PerfResult = { genel: PerfGenel; bolumler: PerfBolum[]; vardiyaHaftaAyri?: VardiyaHaftaAyri }

const pct = (g: number, h: number): number => (h > 0 ? Math.round((g / h) * 1000) / 10 : 0)
const round1 = (x: number): number => Math.round(x * 10) / 10
const DAY_MS = 86400000
const iso = (d: Date): string => d.toISOString().slice(0, 10)
/** @db.Date değerini UTC gün başına indir → TZ-kaymasız gün aritmetiği. */
const utcDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
/** [a,b] kapsayıcı gün sayısı (ikisi de @db.Date). */
const dayCount = (a: Date, b: Date): number => Math.round((utcDay(b).getTime() - utcDay(a).getTime()) / DAY_MS) + 1
/** [ps,pe] ile [from,to] kesişimindeki gün sayısı (0 = kesişmiyor). */
function overlapDays(ps: Date, pe: Date, from: Date, to: Date): number {
  const s = Math.max(utcDay(ps).getTime(), utcDay(from).getTime())
  const e = Math.min(utcDay(pe).getTime(), utcDay(to).getTime())
  return e >= s ? Math.round((e - s) / DAY_MS) + 1 : 0
}

/** APPROVED + [from,to] ile period ÖRTÜŞEN formlar (backfill'siz kayıt için date fallback). */
async function fetchOverlappingForms(from: Date, to: Date) {
  return prisma.overtimeForm.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { periodStart: { lte: to }, periodEnd: { gte: from } },
        { periodStart: null, date: { gte: from, lte: to } }, // güvenlik: backfill'siz → date
      ],
    },
    include: {
      personnel: { include: { personnel: { select: { adSoyad: true, sicilNo: true } } } },
    },
  })
}

/**
 * Period-bazlı proration ile performans.
 *   factor = (sorgu aralığına düşen gün) / (form toplam gün)   → hedef & gerçekleşen AYNI factor'la bölünür.
 *   Yüzde KORUNUR: kişi yüzdesi ORİJİNAL orandan hesaplanır (factor sadeleşir); bölüm/genel yüzdesi
 *   prorate edilmiş TOPLAMLARDAN → doğru ağırlıklı ortalama.
 *   Tek-gün form (periodStart=periodEnd) → total=1, factor=1 → prorate YOK, tam değer.
 * granularity='day' + vardiyaHaftaMi=true → PRORATE EDİLMEZ, ayrı grupta döner
 *   (haftanın hangi günü kaç adet üretildiği ölçülmedi → toplama karıştırılmaz).
 */
async function aggregate(from: Date, to: Date, allowedDepts: string[] | undefined, granularity: Granularity): Promise<PerfResult> {
  const deptFilter = allowedDepts === undefined ? null : new Set(allowedDepts)
  const forms = await fetchOverlappingForms(from, to)

  const byDept = new Map<string, PerfKisi[]>()
  const vardiyaAyri: { formNo: string; periodStart: string; periodEnd: string }[] = []

  for (const f of forms) {
    const ps = f.periodStart ?? f.date
    const pe = f.periodEnd ?? f.date

    // GÜNLÜK görünüm istisnası: vardiya-hafta prorate edilmez → ayrı raporlanır.
    if (granularity === 'day' && f.vardiyaHaftaMi) {
      vardiyaAyri.push({ formNo: f.formNo, periodStart: iso(utcDay(ps)), periodEnd: iso(utcDay(pe)) })
      continue
    }

    const total = dayCount(ps, pe) // vardiya-hafta=5, tek gün=1
    const inRange = overlapDays(ps, pe, from, to)
    if (inRange <= 0) continue
    const factor = inRange / total // tek gün → 1

    for (const op of f.personnel) {
      if (op.hedefAdet == null || op.gerceklesenAdet == null) continue
      const dept = op.workDepartment || '—'
      if (deptFilter && !deptFilter.has(dept)) continue
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept)!.push({
        ad: op.personnel?.adSoyad ?? '—',
        sicil: op.personnel?.sicilNo ?? '—',
        hedef: op.hedefAdet * factor, // prorate (float; yüzdeyi bozmaz)
        gerceklesen: op.gerceklesenAdet * factor,
        yuzde: pct(op.gerceklesenAdet, op.hedefAdet), // ORİJİNAL orandan → factor etkisiz
        not: op.gerceklesenNote ?? null,
      })
    }
  }

  const bolumler: PerfBolum[] = [...byDept.entries()].map(([ad, kisiler]) => {
    const hedefP = kisiler.reduce((s, k) => s + k.hedef, 0) // precise (prorate edilmiş)
    const gercP = kisiler.reduce((s, k) => s + k.gerceklesen, 0)
    return {
      ad,
      hedef: round1(hedefP),
      gerceklesen: round1(gercP),
      yuzde: pct(gercP, hedefP), // precise toplamdan → round drift yok
      kisiler: kisiler
        .map((k) => ({ ...k, hedef: round1(k.hedef), gerceklesen: round1(k.gerceklesen) }))
        .sort((a, b) => a.yuzde - b.yuzde),
    }
  }).sort((a, b) => a.yuzde - b.yuzde)

  // genel: precise toplamdan (bölüm round'larını toplamaktan DEĞİL)
  let hedefP = 0, gercP = 0
  for (const kisiler of byDept.values()) for (const k of kisiler) { hedefP += k.hedef; gercP += k.gerceklesen }

  const res: PerfResult = {
    genel: { hedef: round1(hedefP), gerceklesen: round1(gercP), yuzde: hedefP > 0 ? pct(gercP, hedefP) : null },
    bolumler,
  }
  if (granularity === 'day' && vardiyaAyri.length > 0) {
    res.vardiyaHaftaAyri = {
      formSayisi: vardiyaAyri.length,
      aciklama: `Bu tarihi kapsayan ${vardiyaAyri.length} vardiya-hafta kaydı (her biri 5 geceyi temsil eder, günlük dağılım ölçülmedi — toplama katılmadı).`,
      formlar: vardiyaAyri,
    }
  }
  return res
}

/** Tek güne ait performans. vardiya-hafta kayıtları prorate EDİLMEZ, vardiyaHaftaAyri'de döner. */
export async function getDailyPerformance(date: Date, allowedDepts?: string[]): Promise<PerfResult & { date: string }> {
  const res = await aggregate(date, date, allowedDepts, 'day')
  return { date: iso(date), ...res }
}

/** Tarih aralığına (weekStart..weekEnd dahil) performans. Vardiya-hafta tam örtüşürse tam sayılır. */
export async function getWeeklyPerformance(
  weekStart: Date,
  weekEnd: Date,
  allowedDepts?: string[],
): Promise<PerfResult & { weekStart: string; weekEnd: string }> {
  const res = await aggregate(weekStart, weekEnd, allowedDepts, 'week')
  return { weekStart: iso(weekStart), weekEnd: iso(weekEnd), ...res }
}

/**
 * Aylık performans. Ay aralığı [ayın 1'i, ayın son günü] (UTC). Ay sınırını aşan vardiya-hafta
 * proration ile doğru bölünür (bu fazın asıl kazancı). month: 1-12.
 */
export async function getMonthlyPerformance(
  year: number,
  month: number,
  allowedDepts?: string[],
): Promise<PerfResult & { year: number; month: number; from: string; to: string }> {
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 0)) // sonraki ayın 0. günü = bu ayın son günü
  const res = await aggregate(from, to, allowedDepts, 'month')
  return { year, month, from: iso(from), to: iso(to), ...res }
}

// ───────────────────────── FAZ 2: üretim ayracı + eksik veri + hijyen + hurda ─────────────────────────

/** uretimYapar=false bölüm adları — eksik-veri raporundan DIŞLANANLAR (ör. Bakımhane). */
async function getNonUretimBolumler(): Promise<Set<string>> {
  const depts = await prisma.departmentDefinition.findMany({
    where: { uretimYapar: false },
    select: { name: true },
  })
  return new Set(depts.map((d) => d.name))
}

export type EksikTip = 'hedef' | 'gerceklesen' | 'ikisi'
export type MissingKisi = { ad: string; sicil: string; formNo: string; eksik: EksikTip }
export type MissingBolum = { bolum: string; eksikSayisi: number; personeller: MissingKisi[] }

/**
 * Üretim yapan bölümlerde (uretimYapar!=false) APPROVED satırlardan hedefAdet VEYA gerceklesenAdet
 * eksik olanlar. uretimYapar=false bölümler (Bakımhane) DIŞLANIR. Period örtüşmesi + allowedDepts.
 */
export async function getMissingDataReport(from: Date, to: Date, allowedDepts?: string[]): Promise<MissingBolum[]> {
  const nonUretim = await getNonUretimBolumler()
  const deptFilter = allowedDepts === undefined ? null : new Set(allowedDepts)
  const forms = await prisma.overtimeForm.findMany({
    where: { status: 'APPROVED', OR: [{ periodStart: { lte: to }, periodEnd: { gte: from } }, { periodStart: null, date: { gte: from, lte: to } }] },
    select: {
      formNo: true,
      personnel: { select: { hedefAdet: true, gerceklesenAdet: true, workDepartment: true, personnel: { select: { adSoyad: true, sicilNo: true } } } },
    },
  })
  const byDept = new Map<string, MissingKisi[]>()
  for (const f of forms) {
    for (const op of f.personnel) {
      const dept = op.workDepartment || '—'
      if (nonUretim.has(dept)) continue // üretim-dışı bölüm → DIŞLA (doğal boş)
      if (deptFilter && !deptFilter.has(dept)) continue
      const hedefBos = op.hedefAdet == null
      const gercBos = op.gerceklesenAdet == null
      if (!hedefBos && !gercBos) continue // tam → eksik değil
      const eksik: EksikTip = hedefBos && gercBos ? 'ikisi' : hedefBos ? 'hedef' : 'gerceklesen'
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept)!.push({ ad: op.personnel?.adSoyad ?? '—', sicil: op.personnel?.sicilNo ?? '—', formNo: f.formNo, eksik })
    }
  }
  return [...byDept.entries()]
    .map(([bolum, personeller]) => ({ bolum, eksikSayisi: personeller.length, personeller }))
    .sort((a, b) => b.eksikSayisi - a.eksikSayisi)
}

export type HygieneWarning = { bolum: string; ad: string; sicil: string; formNo: string; hedefAdet: number }

/**
 * Veri hijyeni: uretimYapar=false bölümlere girilmiş (anlamsız) hedefAdet uyarıları.
 * Faz 1 sonrası yalnız Bakımhane false → pratikte Bakımhane'ye girilmiş hedefleri yakalar.
 */
export async function getDataHygieneWarnings(from: Date, to: Date, allowedDepts?: string[]): Promise<HygieneWarning[]> {
  const nonUretim = await getNonUretimBolumler()
  if (nonUretim.size === 0) return []
  const deptFilter = allowedDepts === undefined ? null : new Set(allowedDepts)
  const forms = await prisma.overtimeForm.findMany({
    where: { status: 'APPROVED', OR: [{ periodStart: { lte: to }, periodEnd: { gte: from } }, { periodStart: null, date: { gte: from, lte: to } }] },
    select: { formNo: true, personnel: { select: { hedefAdet: true, workDepartment: true, personnel: { select: { adSoyad: true, sicilNo: true } } } } },
  })
  const out: HygieneWarning[] = []
  for (const f of forms) {
    for (const op of f.personnel) {
      const dept = op.workDepartment || '—'
      if (!nonUretim.has(dept)) continue // yalnız üretim-DIŞI bölüm
      if (op.hedefAdet == null) continue // hedef girilmemiş → sorun yok
      if (deptFilter && !deptFilter.has(dept)) continue
      out.push({ bolum: dept, ad: op.personnel?.adSoyad ?? '—', sicil: op.personnel?.sicilNo ?? '—', formNo: f.formNo, hedefAdet: op.hedefAdet })
    }
  }
  return out
}

export type ScrapBolum = { bolum: string; hurda: number; gerceklesen: number; oran: number | null }
export type ScrapResult = { toplamHurda: number; toplamGerceklesen: number; oran: number | null; bolumler: ScrapBolum[] }

/**
 * Hurda KPI: OvertimePersonnelUretim.hurdaAdet toplamı (period örtüşmeli, prorate).
 * Oran = hurda/gerçekleşen — gerçekleşen 0 ise null (BÖLME HATASI YOK). Veri AZ → boş dönebilir (normal).
 */
export async function getScrapMetrics(from: Date, to: Date, allowedDepts?: string[]): Promise<ScrapResult> {
  const deptFilter = allowedDepts === undefined ? null : new Set(allowedDepts)
  const forms = await prisma.overtimeForm.findMany({
    where: { status: 'APPROVED', OR: [{ periodStart: { lte: to }, periodEnd: { gte: from } }, { periodStart: null, date: { gte: from, lte: to } }] },
    select: {
      date: true, periodStart: true, periodEnd: true,
      personnel: { select: { workDepartment: true, uretimSatirlari: { select: { hurdaAdet: true, gerceklesenAdet: true } } } },
    },
  })
  const byDept = new Map<string, { hurda: number; gerceklesen: number }>()
  for (const f of forms) {
    const ps = f.periodStart ?? f.date
    const pe = f.periodEnd ?? f.date
    const total = dayCount(ps, pe)
    const inRange = overlapDays(ps, pe, from, to)
    if (inRange <= 0) continue
    const factor = inRange / total
    for (const op of f.personnel) {
      const dept = op.workDepartment || '—'
      if (deptFilter && !deptFilter.has(dept)) continue
      let acc = byDept.get(dept)
      if (!acc) { acc = { hurda: 0, gerceklesen: 0 }; byDept.set(dept, acc) }
      for (const u of op.uretimSatirlari) {
        if (u.hurdaAdet != null) acc.hurda += u.hurdaAdet * factor
        if (u.gerceklesenAdet != null) acc.gerceklesen += u.gerceklesenAdet * factor
      }
    }
  }
  const bolumler: ScrapBolum[] = [...byDept.entries()]
    .map(([bolum, v]) => ({
      bolum,
      hurda: round1(v.hurda),
      gerceklesen: round1(v.gerceklesen),
      oran: v.gerceklesen > 0 ? Math.round((v.hurda / v.gerceklesen) * 1000) / 10 : null,
    }))
    .filter((b) => b.hurda > 0 || b.gerceklesen > 0)
    .sort((a, b) => b.hurda - a.hurda)
  let tH = 0, tG = 0
  for (const v of byDept.values()) { tH += v.hurda; tG += v.gerceklesen }
  return { toplamHurda: round1(tH), toplamGerceklesen: round1(tG), oran: tG > 0 ? Math.round((tH / tG) * 1000) / 10 : null, bolumler }
}

/**
 * Verilen bölüm id'lerinin KENDİSİ + tüm alt (children) bölümlerinin name listesi.
 * parent/children @relation("DeptTree"). 26 satır → hepsini bir kez çek, bellekte BFS.
 * Döngü guard: visited (B1'de parentId!==id engellendi ama yine de koru).
 */
async function getDeptSubtreeNames(seedIds: string[]): Promise<string[]> {
  if (seedIds.length === 0) return []
  const all = await prisma.departmentDefinition.findMany({ select: { id: true, name: true, parentId: true } })
  const byId = new Map(all.map((d) => [d.id, d]))
  const childrenByParent = new Map<string, string[]>()
  for (const d of all) {
    if (d.parentId) {
      if (!childrenByParent.has(d.parentId)) childrenByParent.set(d.parentId, [])
      childrenByParent.get(d.parentId)!.push(d.id)
    }
  }
  const visited = new Set<string>()
  const names = new Set<string>()
  const stack = [...seedIds]
  while (stack.length) {
    const id = stack.pop()!
    if (visited.has(id)) continue // döngü guard
    visited.add(id)
    const node = byId.get(id)
    if (node) names.add(node.name)
    for (const childId of childrenByParent.get(id) ?? []) stack.push(childId)
  }
  return [...names]
}

/**
 * FAZ-B2b: kullanıcının görebileceği mesai-rapor bölümleri.
 *   a) forms.admin (admin/super-admin) → undefined (TÜM bölümler) — DEĞİŞMEZ
 *   b) gorunurBolumler dolu           → o liste (manuel override korunur)
 *   c) boş → OMURGADAN TÜRET: kişinin görevli (müdür/müd.yrd./sorumlu1-3) olduğu
 *            bölümler + ALT AĞAÇLARI (müdür → kendi + tüm alt shop-floor).
 *   d) personele bağlı değil / omurgada görevi yok → [] (HİÇBİRİ — "tümü" DEĞİL)
 * Dönüş: undefined = tümü, [] = hiçbiri, [adlar] = sadece o bölümler.
 */
export async function resolveAllowedDepts(userId: string): Promise<string[] | undefined> {
  const perms = await getUserPermissions(userId)
  if (perms.has('forms.admin')) return undefined // (a) admin → tümü
  if (perms.has('overtime.report.all')) return undefined // (a2) yönetim raporu → tümü (kapsam sınırsız)

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { gorunurBolumler: true, personnelId: true },
  })
  const manual = u?.gorunurBolumler ?? []
  if (manual.length > 0) return manual // (b) manuel override

  // (c) omurgadan türet
  const personnelId = u?.personnelId
  if (!personnelId) return [] // (d) personele bağlı değil → hiçbiri

  const gorevli = await prisma.departmentDefinition.findMany({
    where: {
      OR: [
        { mudurId: personnelId },
        { mudurYardimcisiId: personnelId },
        { sorumlu1Id: personnelId },
        { sorumlu2Id: personnelId },
        { sorumlu3Id: personnelId },
        { sorumlu4Id: personnelId },
      ],
    },
    select: { id: true },
  })
  if (gorevli.length === 0) return [] // (d) omurgada görev yok → hiçbiri

  return getDeptSubtreeNames(gorevli.map((d) => d.id)) // kendi + alt ağaç
}

/** En son APPROVED mesai tarihi (sayfa "tarih verilmedi" durumunda kullanır). */
export async function getLatestApprovedDate(): Promise<Date | null> {
  const latest = await prisma.overtimeForm.findFirst({
    where: { status: 'APPROVED' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  return latest?.date ?? null
}
