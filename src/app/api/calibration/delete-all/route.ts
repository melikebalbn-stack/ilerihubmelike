import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE - Tüm kalibrasyon kayıtlarını arşivle (SADECE SUPER_ADMIN)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { canEditCalibration } = await import('@/lib/calibration-auth')
    if (!canEditCalibration(session.user.role, session.user.ou, session.user.department)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const activeCount = await prisma.calibrationDevice.count({
      where: { isActive: true }
    })

    if (activeCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'Arşivlenecek kayıt bulunamadı',
        archivedCount: 0
      })
    }

    const result = await prisma.calibrationDevice.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })

    console.log(`[CALIBRATION] Bulk archive: ${result.count} devices archived by ${session.user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Tüm kalibrasyon kayıtları arşivlendi',
      archivedCount: result.count
    })
  } catch (error) {
    console.error('[CALIBRATION] Bulk archive failed:', error)
    return NextResponse.json(
      { error: 'Kayıtlar arşivlenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
