import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeCalibrationScheduler } from '@/lib/cron'

/**
 * GET /api/cron/init
 * Initialize the cron scheduler (SADECE ADMIN)
 * This should be called once when the app starts
 */
export async function GET() {
  try {
    // Kimlik doğrulama kontrolü - sistem yönetimi işlemi
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece ADMIN veya SUPER_ADMIN erişebilir
    const userRole = session.user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
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
