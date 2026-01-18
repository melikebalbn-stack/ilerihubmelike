import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE - Tüm kalibrasyon kayıtlarını sil (SADECE SUPER_ADMIN)
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

    // Tüm kalibrasyon cihazlarını sil
    const result = await prisma.calibrationDevice.deleteMany({})

    // Log işlemi
    console.log(`[DELETE-ALL] ${session.user.email} tarafından ${result.count} kalibrasyon kaydı silindi`)

    return NextResponse.json({
      success: true,
      message: 'Tüm kalibrasyon kayıtları silindi',
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Tüm kayıtlar silinirken hata:', error)
    return NextResponse.json(
      { error: 'Kayıtlar silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
