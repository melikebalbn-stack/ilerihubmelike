import { NextRequest, NextResponse } from 'next/server'
import { apiBadRequest } from '@/lib/api-response'
import { getScrapMetrics } from '@/lib/overtime-performance'
import { resolvePerfScope, parseIsoDateUTC, validateRange } from '../_shared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/overtime/performans/scrap?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Hurda KPI: toplam + bölüm kırılımı + oran (gerçekleşen 0 → null, bölme hatası yok).
 *   Veri AZ olabilir → boş dönebilir (hata değil).
 */
export async function GET(request: NextRequest) {
  const scope = await resolvePerfScope()
  if (scope.error) return scope.error
  const { allowedDepts, empty } = scope

  const sp = new URL(request.url).searchParams
  const from = parseIsoDateUTC(sp.get('from'))
  const to = parseIsoDateUTC(sp.get('to'))
  if (!from || !to) return apiBadRequest('from ve to geçerli YYYY-MM-DD olmalı')
  const rangeErr = validateRange(from, to)
  if (rangeErr) return apiBadRequest(rangeErr)

  const data = await getScrapMetrics(from, to, allowedDepts)
  return NextResponse.json(empty ? { ...data, noAccess: true } : data)
}
