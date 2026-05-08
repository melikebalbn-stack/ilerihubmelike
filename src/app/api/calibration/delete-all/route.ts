import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// DELETE - Tüm kalibrasyon kayıtlarını arşivle (SADECE SUPER_ADMIN)
export async function DELETE() {
  try {
    // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
    const { session, user, error } = await requireUser()
    if (error) return error

    const { canEditCalibration } = await import('@/lib/calibration-auth')
    if (!canEditCalibration(user.role, session.user.ou, user.department, session.user.permissions)) {
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

    console.log(`[CALIBRATION] Bulk archive: ${result.count} devices archived by ${user.email}`)

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
