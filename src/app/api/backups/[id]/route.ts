// Backups API - Detay, Güncelleme, Silme
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteBackupFile } from '@/lib/backup-service'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

// GET - Yedek Detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-backups: requireUser — admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
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
    // PR-Y2.5-backups: requireUser — admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
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
    // PR-Y2.5-backups: requireUser — admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
    }

    const { id } = await params

    const backup = await prisma.backupLog.findUnique({
      where: { id }
    })

    if (!backup) {
      return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
    }

    // PR-AUDIT-LOG-EXPANSION: PermissionAuditLog'a yapısal kayıt
    // (eski console.log "PR-BACKUPLOG-AUDIT-MIGRATION backlog" notu artık DB'de)
    await logAuditEvent({
      action: 'BACKUP_DELETED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: backup.id,
      details: {
        actorEmail: user.email,
        backupName: backup.backupName,
        filePath: backup.filePath,
        fileSize: backup.fileSize.toString(),
        backupType: backup.backupType,
        originalCreatedBy: backup.createdBy,
        originalCreatedAt: backup.createdAt.toISOString(),
      },
    })

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
