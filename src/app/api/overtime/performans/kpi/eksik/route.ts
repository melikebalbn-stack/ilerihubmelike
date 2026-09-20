import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { apiError } from '@/lib/api-response'
import { getVeriKalitesiEksikSatirlar, resolveAllowedDepts, KPI_BASLANGIC } from '@/lib/overtime-performance'

/**
 * GET /api/overtime/performans/kpi/eksik?bolum=<ad>&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Bölüm detayı: gerçekleşen adedi girilmemiş üretim satırları (form no, tarih, personel,
 * parça kodu, hedef). Kapı ve kapsam /api/overtime/performans/kpi ile BİREBİR
 * (overtime.report VEYA resolveAllowedDepts); kapsam dışı bölüm → 403, üretim dışı → boş.
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

  const { searchParams } = new URL(request.url)
  const bolum = (searchParams.get('bolum') ?? '').trim()
  if (!bolum) return apiError('bolum zorunlu', 400)
  // Kapsam: [adlar] ise yalnız o bölümler; [] → hiçbiri; undefined → tümü.
  if (Array.isArray(allowedDepts) && !allowedDepts.includes(bolum)) {
    return apiError('Bu bölümün detayını görüntüleme yetkiniz yok', 403)
  }

  const parse = (v: string | null): Date | null => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : null)
  const to = parse(searchParams.get('to')) ?? new Date()
  let from = parse(searchParams.get('from')) ?? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1))
  if (from < KPI_BASLANGIC) from = KPI_BASLANGIC
  if (from > to) return apiError('from, to tarihinden büyük olamaz', 400)

  const satirlar = await getVeriKalitesiEksikSatirlar(from, to, bolum, allowedDepts)
  return NextResponse.json({ bolum, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), satirlar })
}
