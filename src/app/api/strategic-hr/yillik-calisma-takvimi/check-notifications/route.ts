import { NextRequest, NextResponse } from 'next/server'
import { runYillikTakvimNotifications } from '@/lib/yillik-calisma-takvimi/notifications'

export const dynamic = 'force-dynamic'
async function handle(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requestedLive = request.nextUrl.searchParams.get('dryRun') === 'false'
  const liveEnabled = process.env.NODE_ENV === 'production' && process.env.YILLIK_TAKVIM_NOTIFICATIONS_ENABLED === 'true'
  const dryRun = !requestedLive || !liveEnabled
  const result = await runYillikTakvimNotifications({ dryRun })
  return NextResponse.json({ success: true, liveRequestBlocked: requestedLive && !liveEnabled, ...result })
}
export async function POST(request: NextRequest) { return handle(request) }
