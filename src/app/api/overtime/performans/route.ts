import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { apiError } from '@/lib/api-response'
import { getDailyPerformance, getLatestApprovedDate, resolveAllowedDepts } from '@/lib/overtime-performance'

export const dynamic = 'force-dynamic'

/**
 * GET /api/overtime/performans — bölüm + kişi bazında mesai üretim performansı.
 * Erişim kapısı: `overtime.report` izni VEYA omurga kapsamı dolu (kendi bölümünün
 * sorumlusu/müdürü). Kapı ve içerik AYNI resolveAllowedDepts'i kullanır → sayfaya
 * giren, gördüğü = kapsamı. Query: ?date=YYYY-MM-DD (yoksa en son APPROVED mesai tarihi).
 * Veri katmanı: src/lib/overtime-performance.ts (sayfa + mail cron ile ORTAK).
 */
export async function GET(request: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error

  // Kapı: overtime.report izni VEYA omurga kapsamı (undefined=tümü / [adlar]=bölümler).
  // Sadece [] (görevsiz + izinsiz) → erişim yok.
  const allowedDepts = await resolveAllowedDepts(user.id)
  const hasReportPerm = session.user.permissions?.includes('overtime.report') ?? false
  const hasScope = allowedDepts === undefined || (Array.isArray(allowedDepts) && allowedDepts.length > 0)
  if (!hasReportPerm && !hasScope) {
    return apiError('Mesai performans raporunu görüntüleme yetkiniz yok', 403)
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  let date: Date | null = null
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = new Date(`${dateParam}T00:00:00.000Z`)
  } else {
    date = await getLatestApprovedDate()
  }

  if (!date) {
    return NextResponse.json({ date: null, genel: { hedef: 0, gerceklesen: 0, yuzde: null }, bolumler: [] })
  }

  // undefined → tümü; [] → yetkili bölüm yok (noAccess, yalnız izinli-ama-kapsamsız kullanıcı);
  // [adlar] → kapsam.
  if (Array.isArray(allowedDepts) && allowedDepts.length === 0) {
    return NextResponse.json({
      date: date.toISOString().slice(0, 10),
      genel: { hedef: 0, gerceklesen: 0, yuzde: null },
      bolumler: [],
      noAccess: true,
    })
  }
  const data = await getDailyPerformance(date, allowedDepts)
  return NextResponse.json(data)
}
