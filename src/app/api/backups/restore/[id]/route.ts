// Backups API - Geri Yükleme
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { restoreILERIHub, restoreAkademi, generateBackupName, backupILERIHub, backupAkademi } from '@/lib/backup-service'
import * as fs from 'fs'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

// POST - Yedeği Geri Yükle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Kill switch — çalışmadan önce, auth'tan önce
  if (process.env.ENABLE_BACKUP_RESTORE !== 'true') {
    const { id: blockedId } = await params
    console.warn(
      `[backup-restore] Blocked by kill switch. ` +
      `backupId=${blockedId}, ip=${request.headers.get('x-forwarded-for') ?? 'n/a'}`
    )
    return NextResponse.json(
      {
        error: 'Restore is disabled',
        message:
          'Backup restore is currently disabled by operations policy. ' +
          'Contact system administrator.',
      },
      { status: 503 }
    )
  }

  try {
    // PR-Y2.5-backups: requireUser — restore audit log için user.email/name gerek + admin role
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Restore işlemi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { confirmRestore } = body

    if (!confirmRestore) {
      return NextResponse.json({
        error: 'Geri yükleme onayı gerekiyor',
        message: 'Bu işlem mevcut verilerin üzerine yazacaktır. Devam etmek için confirmRestore: true gönderin.'
      }, { status: 400 })
    }

    const backup = await prisma.backupLog.findUnique({
      where: { id }
    })

    if (!backup) {
      return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
    }

    if (backup.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Sadece tamamlanmış yedekler geri yüklenebilir' }, { status: 400 })
    }

    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      return NextResponse.json({ error: 'Yedek dosyası bulunamadı' }, { status: 404 })
    }

    // Pre-restore yedek oluştur
    const preRestoreBackupName = generateBackupName(`${backup.projectName.toLowerCase()}_prerestore`)
    let preRestoreResult

    if (backup.projectName === 'ILERIHub') {
      preRestoreResult = await backupILERIHub(preRestoreBackupName)
    } else if (backup.projectName === 'Akademi') {
      preRestoreResult = await backupAkademi(preRestoreBackupName)
    }

    if (preRestoreResult && !preRestoreResult.success) {
      return NextResponse.json({
        error: 'Pre-restore yedek oluşturulamadı',
        details: preRestoreResult.error
      }, { status: 500 })
    }

    // Pre-restore yedeği kaydet
    if (preRestoreResult?.success) {
      await prisma.backupLog.create({
        data: {
          backupName: preRestoreBackupName,
          backupType: 'PRE_RESTORE',
          projectName: backup.projectName,
          filePath: preRestoreResult.filePath,
          fileSize: BigInt(fs.statSync(preRestoreResult.filePath).size),
          status: 'COMPLETED',
          createdBy: user.email,
          createdByName: user.name || user.email,
          completedAt: new Date(),
          notes: `Geri yükleme öncesi otomatik yedek - Kaynak: ${backup.backupName}`
        }
      })
    }

    // Geri yükleme işlemi
    let restoreResult

    switch (backup.projectName) {
      case 'ILERIHub':
        restoreResult = await restoreILERIHub(backup.filePath)
        break
      case 'Akademi':
        restoreResult = await restoreAkademi(backup.filePath)
        break
      case 'Database':
        return NextResponse.json({
          error: 'Veritabanı geri yükleme henüz desteklenmiyor',
          message: 'Manuel olarak pg_restore kullanın'
        }, { status: 501 })
      default:
        return NextResponse.json({ error: 'Geçersiz proje tipi' }, { status: 400 })
    }

    if (!restoreResult.success) {
      return NextResponse.json({
        error: 'Geri yükleme başarısız',
        details: restoreResult.error,
        preRestoreBackup: preRestoreBackupName
      }, { status: 500 })
    }

    // PR-AUDIT-LOG-EXPANSION: kritik operasyon — restore audit
    await logAuditEvent({
      action: 'BACKUP_RESTORED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: backup.id,
      details: {
        actorEmail: user.email,
        backupName: backup.backupName,
        projectName: backup.projectName,
        backupCreatedAt: backup.createdAt.toISOString(),
        preRestoreBackup: preRestoreBackupName,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${backup.projectName} başarıyla geri yüklendi`,
      restoredFrom: backup.backupName,
      preRestoreBackup: preRestoreBackupName
    })
  } catch (error) {
    console.error('Geri yükleme hatası:', error)
    return NextResponse.json({ error: 'Geri yükleme başarısız' }, { status: 500 })
  }
}
