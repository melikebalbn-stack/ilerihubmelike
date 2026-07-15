import { NextRequest, NextResponse } from 'next/server'
import { apiBadRequest } from '@/lib/api-response'
import { getMonthlyPerformance } from '@/lib/overtime-performance'
import { resolvePerfScope } from '../_shared'

export const dynamic = 'force-dynamic'

/**
 * GET /api/overtime/performans/monthly?year=YYYY[&month=MM]
 *   month VAR → o ayın bölüm/kişi performansı (proration ile ay-sınırı doğru bölünür).
 *   month YOK → yılın 12 aylık trend'i (her ay için genel özet).
 * Yetki/kapsam: ana /performans route'u ile aynı (resolvePerfScope).
 */
export async function GET(request: NextRequest) {
  const scope = await resolvePerfScope()
  if (scope.error) return scope.error
  const { allowedDepts, empty } = scope

  const sp = new URL(request.url).searchParams
  const yearStr = sp.get('year')
  const monthStr = sp.get('month')

  const year = Number(yearStr)
  if (!yearStr || !Number.isInteger(year) || year < 2020 || year > 2100) {
    return apiBadRequest('year 2020-2100 arası bir tam sayı olmalı')
  }

  // month VAR → tek ay
  if (monthStr != null && monthStr !== '') {
    const month = Number(monthStr)
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return apiBadRequest('month 1-12 arası bir tam sayı olmalı')
    }
    const data = await getMonthlyPerformance(year, month, allowedDepts)
    return NextResponse.json(empty ? { ...data, noAccess: true } : data)
  }

  // month YOK → 12 aylık trend (her ay genel özet)
  const aylar: { month: number; from: string; to: string; genel: unknown }[] = []
  for (let m = 1; m <= 12; m++) {
    const r = await getMonthlyPerformance(year, m, allowedDepts)
    aylar.push({ month: m, from: r.from, to: r.to, genel: r.genel })
  }
  return NextResponse.json(empty ? { year, aylar, noAccess: true } : { year, aylar })
}
