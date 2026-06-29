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
  // PR-FAZ2A: allowedDepts verilirse SADECE o bölümler; undefined/boş → tümü (geriye-uyum).
  const deptFilter = allowedDepts && allowedDepts.length > 0 ? new Set(allowedDepts) : null
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
 * PR-FAZ2A: kullanıcının görebileceği bölümler.
 * forms.admin (admin/super-admin dahil) VEYA gorunurBolumler boş → undefined (TÜM bölümler).
 * Aksi halde kullanıcının seçili bölüm listesi.
 */
export async function resolveAllowedDepts(userId: string): Promise<string[] | undefined> {
  const perms = await getUserPermissions(userId)
  if (perms.has('forms.admin')) return undefined // admin/super-admin → tümü
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { gorunurBolumler: true } })
  const list = u?.gorunurBolumler ?? []
  return list.length > 0 ? list : undefined // boş = tümü (geriye-uyum)
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
