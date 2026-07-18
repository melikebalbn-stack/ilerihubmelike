import { NextRequest, NextResponse } from 'next/server'
import { apiBadRequest } from '@/lib/api-response'
import { getMissingDataReport, getDataHygieneWarnings } from '@/lib/overtime-performance'
import { resolvePerfScope, parseIsoDateUTC, validateRange } from '../_shared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/overtime/performans/missing-data?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Üretim yapan bölümlerde (uretimYapar=true) hedef/gerçekleşen eksik satırlar +
 *   üretim-dışı bölüme (Bakımhane) girilmiş anlamsız hedef uyarıları.
 *   Bakımhane (uretimYapar=false) eksik-veri listesinden DIŞLANIR.
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

  const [missing, hijyen] = await Promise.all([
    getMissingDataReport(from, to, allowedDepts),
    getDataHygieneWarnings(from, to, allowedDepts),
  ])
  const eksikler = missing.map((m) => ({ bolum: m.bolum, sayi: m.eksikSayisi, personeller: m.personeller }))
  const body = { eksikler, hijyenUyarilari: hijyen }
  return NextResponse.json(empty ? { ...body, noAccess: true } : body)
}
