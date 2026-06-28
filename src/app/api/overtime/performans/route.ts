import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getDailyPerformance, getLatestApprovedDate } from '@/lib/overtime-performance'

export const dynamic = 'force-dynamic'

/**
 * GET /api/overtime/performans — bölüm + kişi bazında mesai üretim performansı.
 * Yetki: overtime.report. Query: ?date=YYYY-MM-DD (yoksa en son APPROVED mesai tarihi).
 * Veri katmanı: src/lib/overtime-performance.ts (sayfa + mail cron ile ORTAK).
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('overtime.report')
  if (error) return error

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

  const data = await getDailyPerformance(date)
  return NextResponse.json(data)
}
