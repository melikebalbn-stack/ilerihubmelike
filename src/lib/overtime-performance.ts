/**
 * Mesai üretim performansı — ortak veri katmanı (PR-B).
 * Hem /api/overtime/performans sayfası hem günlük/haftalık mail cron'ları bunu kullanır.
 * Yalnız status=APPROVED + hedefAdet/gerceklesenAdet DOLU kayıtlar; workDepartment grupla; % artan sırala.
 */
import { prisma } from '@/lib/prisma'

export type PerfKisi = { ad: string; sicil: string; hedef: number; gerceklesen: number; yuzde: number; not: string | null }
export type PerfBolum = { ad: string; hedef: number; gerceklesen: number; yuzde: number; kisiler: PerfKisi[] }
export type PerfGenel = { hedef: number; gerceklesen: number; yuzde: number | null }
export type PerfResult = { genel: PerfGenel; bolumler: PerfBolum[] }

const pct = (g: number, h: number): number => (h > 0 ? Math.round((g / h) * 1000) / 10 : 0)

type FormWhere = { status: 'APPROVED'; date: Date | { gte: Date; lte: Date } }

async function aggregate(where: FormWhere): Promise<PerfResult> {
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

/** Tek güne ait performans (mesai günü = date). */
export async function getDailyPerformance(date: Date): Promise<PerfResult & { date: string }> {
  const res = await aggregate({ status: 'APPROVED', date })
  return { date: date.toISOString().slice(0, 10), ...res }
}

/** Tarih aralığına ait performans (weekStart..weekEnd dahil). */
export async function getWeeklyPerformance(
  weekStart: Date,
  weekEnd: Date,
): Promise<PerfResult & { weekStart: string; weekEnd: string }> {
  const res = await aggregate({ status: 'APPROVED', date: { gte: weekStart, lte: weekEnd } })
  return { weekStart: weekStart.toISOString().slice(0, 10), weekEnd: weekEnd.toISOString().slice(0, 10), ...res }
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
