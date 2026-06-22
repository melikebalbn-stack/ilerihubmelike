import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeCalibrationScheduler } from '@/lib/cron'

/**
 * Manuel cron başlatma endpoint'i.
 *
 * @deprecated Production'da artık in-process cron kullanılmıyor.
 * Tüm scheduled task'lar sistem cron üzerinden tetikleniyor:
 *   /etc/cron.d/ilerihub-cron
 *
 * Bu endpoint sadece manuel debug/test için korundu.
 * Production'da çağırma — sistem cron ile duplicate çalışma yapar.
 *
 * Detay için: docs/CRON.md
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
