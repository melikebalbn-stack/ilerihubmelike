// Backups API - Detay, Güncelleme, Silme
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteBackupFile } from '@/lib/backup-service'

// Yetki kontrolü
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// GET - Yedek Detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    const backup = await prisma.backupLog.findUnique({
      where: { id }
    })

    if (!backup) {
      return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(backup)
  } catch (error) {
    console.error('Yedek detay hatası:', error)
    return NextResponse.json({ error: 'Yedek detayı alınamadı' }, { status: 500 })
  }
}

// PUT - Yedek Güncelle (notlar vb.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { notes } = body

    const backup = await prisma.backupLog.update({
      where: { id },
      data: { notes }
    })

    return NextResponse.json(backup)
  } catch (error) {
    console.error('Yedek güncelleme hatası:', error)
    return NextResponse.json({ error: 'Yedek güncellenemedi' }, { status: 500 })
  }
}

// DELETE - Yedek Sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    const backup = await prisma.backupLog.findUnique({
      where: { id }
    })

    if (!backup) {
      return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
    }

    // Dosyayı sil
    if (backup.filePath) {
      await deleteBackupFile(backup.filePath)
    }

    // Veritabanı kaydını sil
    await prisma.backupLog.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Yedek silindi' })
  } catch (error) {
    console.error('Yedek silme hatası:', error)
    return NextResponse.json({ error: 'Yedek silinemedi' }, { status: 500 })
  }
}
