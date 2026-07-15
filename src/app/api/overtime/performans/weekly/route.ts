import { NextRequest, NextResponse } from 'next/server'
import { apiBadRequest } from '@/lib/api-response'
import { getWeeklyPerformance, getLatestApprovedDate } from '@/lib/overtime-performance'
import { resolvePerfScope, parseIsoDateUTC, validateRange } from '../_shared'

export const dynamic = 'force-dynamic'

const DAY = 86400000
/** Verilen tarihin ISO haftası Pazartesi'si (UTC). */
function isoMonday(d: Date): Date {
  const dow = d.getUTCDay() // 0=Paz..6=Cmt
  const back = (dow + 6) % 7 // Pzt→0, Paz→6
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
}

/**
 * GET /api/overtime/performans/weekly[?from=YYYY-MM-DD&to=YYYY-MM-DD]
 *   from&to VAR → aralığı kapsayan her ISO hafta için bir nokta (haftalık trend).
 *   YOK → son 8 hafta (en son APPROVED tarihin haftasından geriye).
 * Vardiya-hafta tam örtüşürse tam sayılır (getWeeklyPerformance, factor=1).
 */
export async function GET(request: NextRequest) {
  const scope = await resolvePerfScope()
  if (scope.error) return scope.error
  const { allowedDepts, empty } = scope

  const sp = new URL(request.url).searchParams
  const fromStr = sp.get('from')
  const toStr = sp.get('to')

  let firstMonday: Date
  let lastMonday: Date
  if (fromStr || toStr) {
    const from = parseIsoDateUTC(fromStr)
    const to = parseIsoDateUTC(toStr)
    if (!from || !to) return apiBadRequest('from ve to geçerli YYYY-MM-DD olmalı')
    const rangeErr = validateRange(from, to)
    if (rangeErr) return apiBadRequest(rangeErr)
    firstMonday = isoMonday(from)
    lastMonday = isoMonday(to)
  } else {
    const anchor = (await getLatestApprovedDate()) ?? new Date()
    lastMonday = isoMonday(anchor)
    firstMonday = new Date(lastMonday.getTime() - 7 * 7 * DAY) // 8 hafta (7 geri + bu)
  }

  // Her hafta için genel (trend) + bolumler (seçili haftanın bullet/accordion detayı) +
  // vardiyaHaftaAyri. Tek geniş çağrı hem trend hem seçili-hafta detayını besler.
  const haftalar: {
    weekStart: string; weekEnd: string
    genel: unknown; bolumler: unknown; vardiyaHaftaAyri: unknown
  }[] = []
  for (let ms = firstMonday.getTime(); ms <= lastMonday.getTime(); ms += 7 * DAY) {
    const weekStart = new Date(ms)
    const weekEnd = new Date(ms + 6 * DAY)
    const r = await getWeeklyPerformance(weekStart, weekEnd, allowedDepts)
    haftalar.push({ weekStart: r.weekStart, weekEnd: r.weekEnd, genel: r.genel, bolumler: r.bolumler, vardiyaHaftaAyri: r.vardiyaHaftaAyri })
  }
  return NextResponse.json(empty ? { haftalar, noAccess: true } : { haftalar })
}
