import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeCalibrationScheduler } from '@/lib/cron'

/**
 * GET /api/cron/init
 * Initialize the cron scheduler
 * Tüm authenticated kullanıcılar tarafından tetiklenebilir (sadece scheduler başlatır, hassas işlem değil)
 * Scheduler zaten çalışıyorsa tekrar başlatılmaz (isSchedulerInitialized guard)
 */
export async function GET() {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    initializeCalibrationScheduler()

    return NextResponse.json({
      success: true,
      message: 'Cron scheduler initialized successfully',
    })
  } catch (error) {
    console.error('Error initializing cron scheduler:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize cron scheduler',
      },
      { status: 500 }
    )
  }
}
