import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { apiError } from '@/lib/api-response'
import { getVeriKalitesiKpi, resolveAllowedDepts, KPI_BASLANGIC } from '@/lib/overtime-performance'

/**
 * GET /api/overtime/performans/kpi?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Mesai veri-kalitesi KPI'ı (aylık trend + bölüm tablosu). Kapı ve kapsam
 * /api/overtime/performans ile BİREBİR: overtime.report izni VEYA resolveAllowedDepts kapsamı;
 * [] (izinsiz + kapsamsız) → 403. Kapsam [adlar] ise yalnız o bölümler.
 * from < KPI_BASLANGIC (Temmuz 2026) verilse de KPI_BASLANGIC'a çekilir (Haziran yapısal).
 */
export async function GET(request: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error

  const allowedDepts = await resolveAllowedDepts(user.id)
  const hasReportPerm = session.user.permissions?.includes('overtime.report') ?? false
  const hasScope = allowedDepts === undefined || (Array.isArray(allowedDepts) && allowedDepts.length > 0)
  if (!hasReportPerm && !hasScope) {
    return apiError('Mesai performans raporunu görüntüleme yetkiniz yok', 403)
  }
  if (Array.isArray(allowedDepts) && allowedDepts.length === 0) {
    return NextResponse.json({ from: null, to: null, haricBolumler: [], aylar: [], bolumler: [], noAccess: true })
  }

  const { searchParams } = new URL(request.url)
  const parse = (v: string | null): Date | null => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : null)
  const to = parse(searchParams.get('to')) ?? new Date()
  let from = parse(searchParams.get('from')) ?? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1))
  if (from < KPI_BASLANGIC) from = KPI_BASLANGIC
  if (from > to) return apiError('from, to tarihinden büyük olamaz', 400)

  const data = await getVeriKalitesiKpi(from, to, allowedDepts)
  return NextResponse.json(data)
}
