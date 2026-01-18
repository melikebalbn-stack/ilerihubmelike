// Backups API - Geri Yükleme
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { restoreILERIHub, restoreAkademi, generateBackupName, backupILERIHub, backupAkademi } from '@/lib/backup-service'
import * as fs from 'fs'

// Yetki kontrolü - Sadece ADMIN ve SUPER_ADMIN restore yapabilir
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// POST - Yedeği Geri Yükle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Geri yükleme için ADMIN yetkisi gerekiyor' }, { status: 403 })
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
          createdBy: session.user.email,
          createdByName: session.user.name || session.user.email,
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
