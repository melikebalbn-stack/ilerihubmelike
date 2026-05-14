import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { runPerformanceReviewReminders } from '@/lib/performance-review-notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/strategic-hr/performance/check-reminders
 *
 * Performans değerlendirme bildirim cron'u. Günde 1 kez çalışır.
 *
 * 4 event taranır:
 *   - CYCLE_LAUNCH (status IN_PROGRESS, henüz launch log'u yok)
 *   - DEADLINE_7   (cycle.yearEndReviewEnd = today + 7)
 *   - DEADLINE_0   (cycle.yearEndReviewEnd = today)
 *   - OVERDUE      (cycle.yearEndReviewEnd = today - 1)
 *
 * Auth:
 *   - Sistem cron: x-cron-secret header CRON_SECRET ile eşleşirse session zorunlu değil
 *   - Manuel test: SUPER_ADMIN/ADMIN role
 */
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET
  if (isCron) return null

  const { user, error } = await requireUser()
  if (error) return error
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Bu endpoint sadece cron job veya admin tarafından çağrılabilir' },
      { status: 403 },
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  const authError = await checkAuth(request)
  if (authError) return authError

  try {
    const result = await runPerformanceReviewReminders()
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    console.error('[performance-review-reminders] cron failed:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    )
  }
}

export const GET = POST
