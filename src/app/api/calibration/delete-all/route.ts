import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// DELETE - Tüm kalibrasyon kayıtlarını arşivle (SADECE SUPER_ADMIN)
// FIX #20: Hard delete yerine soft delete + audit trail
export async function DELETE() {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SADECE SUPER_ADMIN erişebilir - çok tehlikeli işlem
    const userRole = session.user.role || 'EMPLOYEE'
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok. Sadece SUPER_ADMIN bu işlemi yapabilir.' }, { status: 403 })
    }

    // FIX #20: Önce aktif kayıt sayısını al (audit trail için)
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

    // FIX #20: Hard delete yerine soft delete - isActive: false
    const result = await prisma.calibrationDevice.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    })

    // FIX #20: Audit trail - detaylı log
    logger.warn('CALIBRATION', 'Bulk archive operation performed', {
      action: 'BULK_ARCHIVE',
      performedBy: session.user.email,
      performedByName: session.user.name || 'Unknown',
      userRole,
      archivedCount: result.count,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Tüm kalibrasyon kayıtları arşivlendi',
      archivedCount: result.count
    })
  } catch (error) {
    logger.error('CALIBRATION', 'Bulk archive failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json(
      { error: 'Kayıtlar arşivlenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
