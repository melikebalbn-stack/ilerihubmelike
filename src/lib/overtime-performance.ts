/**
 * Mesai üretim performansı — ortak veri katmanı (PR-B).
 * Hem /api/overtime/performans sayfası hem günlük/haftalık mail cron'ları bunu kullanır.
 * Yalnız status=APPROVED + hedefAdet/gerceklesenAdet DOLU kayıtlar; workDepartment grupla; % artan sırala.
 */
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'

export type PerfKisi = { ad: string; sicil: string; hedef: number; gerceklesen: number; yuzde: number; not: string | null }
export type PerfBolum = { ad: string; hedef: number; gerceklesen: number; yuzde: number; kisiler: PerfKisi[] }
export type PerfGenel = { hedef: number; gerceklesen: number; yuzde: number | null }
export type PerfResult = { genel: PerfGenel; bolumler: PerfBolum[] }

const pct = (g: number, h: number): number => (h > 0 ? Math.round((g / h) * 1000) / 10 : 0)

type FormWhere = { status: 'APPROVED'; date: Date | { gte: Date; lte: Date } }

async function aggregate(where: FormWhere, allowedDepts?: string[]): Promise<PerfResult> {
  // FAZ-B2b: undefined → TÜMÜ (admin/geriye-uyum). [] → HİÇBİRİ (yetkili bölüm yok).
  //          [adlar] → SADECE o bölümler. (undefined ile [] artık FARKLI anlamda.)
  const deptFilter = allowedDepts === undefined ? null : new Set(allowedDepts)
  const forms = await prisma.overtimeForm.findMany({
    where,
    include: {
      personnel: { include: { personnel: { select: { adSoyad: true, sicilNo: true } } } },
    },
  })

  const byDept = new Map<string, PerfKisi[]>()
  for (const f of forms) {
    for (const op of f.personnel) {
      if (op.hedefAdet == null || op.gerceklesenAdet == null) continue
      const dept = op.workDepartment || '—'
      if (deptFilter && !deptFilter.has(dept)) continue // izin verilen bölüm değil → ele
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept)!.push({
        ad: op.personnel?.adSoyad ?? '—',
        sicil: op.personnel?.sicilNo ?? '—',
        hedef: op.hedefAdet,
        gerceklesen: op.gerceklesenAdet,
        yuzde: pct(op.gerceklesenAdet, op.hedefAdet),
        not: op.gerceklesenNote ?? null,
      })
    }
  }

  const bolumler: PerfBolum[] = [...byDept.entries()].map(([ad, kisiler]) => {
    const hedef = kisiler.reduce((s, k) => s + k.hedef, 0)
    const gerceklesen = kisiler.reduce((s, k) => s + k.gerceklesen, 0)
    return { ad, hedef, gerceklesen, yuzde: pct(gerceklesen, hedef), kisiler: kisiler.sort((a, b) => a.yuzde - b.yuzde) }
  }).sort((a, b) => a.yuzde - b.yuzde)

  const hedef = bolumler.reduce((s, b) => s + b.hedef, 0)
  const gerceklesen = bolumler.reduce((s, b) => s + b.gerceklesen, 0)
  return { genel: { hedef, gerceklesen, yuzde: hedef > 0 ? pct(gerceklesen, hedef) : null }, bolumler }
}

/** Tek güne ait performans (mesai günü = date). allowedDepts boş/undefined = tümü. */
export async function getDailyPerformance(date: Date, allowedDepts?: string[]): Promise<PerfResult & { date: string }> {
  const res = await aggregate({ status: 'APPROVED', date }, allowedDepts)
  return { date: date.toISOString().slice(0, 10), ...res }
}

/** Tarih aralığına ait performans (weekStart..weekEnd dahil). allowedDepts boş/undefined = tümü. */
export async function getWeeklyPerformance(
  weekStart: Date,
  weekEnd: Date,
  allowedDepts?: string[],
): Promise<PerfResult & { weekStart: string; weekEnd: string }> {
  const res = await aggregate({ status: 'APPROVED', date: { gte: weekStart, lte: weekEnd } }, allowedDepts)
  return { weekStart: weekStart.toISOString().slice(0, 10), weekEnd: weekEnd.toISOString().slice(0, 10), ...res }
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
