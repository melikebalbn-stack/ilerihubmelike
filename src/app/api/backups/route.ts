// Backups API - Liste ve Oluşturma
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  backupILERIHub,
  backupAkademi,
  backupDatabase,
  generateBackupName,
  getFileSize,
  PROJECT_CONFIGS
} from '@/lib/backup-service'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

// GET - Yedek Listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-backups: requireUser — admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectName = searchParams.get('project')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (projectName) where.projectName = projectName
    if (status) where.status = status

    const backups = await prisma.backupLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    // BigInt'i Number'a çevir (JSON serialize için)
    const serializedBackups = backups.map(backup => ({
      ...backup,
      fileSize: Number(backup.fileSize)
    }))

    return NextResponse.json(serializedBackups)
  } catch (error) {
    console.error('Yedek listesi hatası:', error)
    return NextResponse.json({ error: 'Yedek listesi alınamadı' }, { status: 500 })
  }
}

// POST - Yeni Yedek Oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-backups: requireUser — createdBy yazımı + admin role check
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('admin.backup.manage')) {
      return NextResponse.json({ error: 'Backup yönetimi sadece SUPER_ADMIN yetkisi gerektirir' }, { status: 403 })
    }

    const body = await request.json()
    const { projectName, includeDatabase = false, notes } = body

    if (!projectName || !['ILERIHub', 'Akademi', 'Database', 'All'].includes(projectName)) {
      return NextResponse.json({ error: 'Geçersiz proje adı' }, { status: 400 })
    }

    const backupName = generateBackupName(projectName, includeDatabase)
    const startTime = new Date()

    // Yedekleme kaydı oluştur
    const backupLog = await prisma.backupLog.create({
      data: {
        backupName,
        backupType: 'MANUAL',
        projectName,
        filePath: '',
        fileSize: BigInt(0),
        status: 'IN_PROGRESS',
        includeDatabase,
        excludePatterns: PROJECT_CONFIGS[projectName as keyof typeof PROJECT_CONFIGS]?.excludes?.join(',') || '',
        startedAt: startTime,
        createdBy: user.email,
        createdByName: user.name || user.email,
        serverIp: PROJECT_CONFIGS[projectName as keyof typeof PROJECT_CONFIGS]?.serverIp || '172.16.16.33',
        notes
      }
    })

    // Yedekleme işlemini başlat (arka planda)
    processBackup(backupLog.id, projectName, backupName, includeDatabase)

    // PR-AUDIT-LOG-EXPANSION
    await logAuditEvent({
      action: 'BACKUP_CREATED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: backupLog.id,
      details: {
        actorEmail: user.email,
        backupName,
        projectName,
        includeDatabase,
        backupType: 'MANUAL',
      },
    })

    return NextResponse.json({
      message: 'Yedekleme başlatıldı',
      backupId: backupLog.id,
      backupName
    }, { status: 201 })
  } catch (error) {
    console.error('Yedekleme başlatma hatası:', error)
    return NextResponse.json({ error: 'Yedekleme başlatılamadı' }, { status: 500 })
  }
}

// Arka planda yedekleme işlemi
async function processBackup(backupId: string, projectName: string, backupName: string, includeDatabase: boolean) {
  const startTime = Date.now()
  let result: { success: boolean; filePath: string; error?: string }

  try {
    // Proje yedeği
    switch (projectName) {
      case 'ILERIHub':
        result = await backupILERIHub(backupName)
        break
      case 'Akademi':
        result = await backupAkademi(backupName)
        break
      case 'Database':
        result = await backupDatabase(backupName)
        break
      case 'All':
        // Tüm projeleri yedekle
        const ilerihubResult = await backupILERIHub(generateBackupName('ilerihub'))
        const akademiResult = await backupAkademi(generateBackupName('akademi'))

        if (!ilerihubResult.success || !akademiResult.success) {
          result = {
            success: false,
            filePath: '',
            error: `ILERIHub: ${ilerihubResult.error || 'OK'}, Akademi: ${akademiResult.error || 'OK'}`
          }
        } else {
          result = { success: true, filePath: ilerihubResult.filePath }
        }
        break
      default:
        result = { success: false, filePath: '', error: 'Geçersiz proje' }
    }

    // Veritabanı yedeği (opsiyonel) — başarısızlık parent kaydına yansıtılır
    if (includeDatabase && projectName !== 'Database') {
      const dbBackupName = generateBackupName('database')
      const dbResult = await backupDatabase(dbBackupName)
      if (!dbResult.success) {
        result = {
          success: false,
          filePath: result.filePath,
          error: [result.error, `Database dump failed: ${dbResult.error ?? 'unknown'}`]
            .filter(Boolean).join(' | '),
        }
      }
    }

    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    const fileSize = result.success ? getFileSize(result.filePath) : 0

    // Kaydı güncelle
    await prisma.backupLog.update({
      where: { id: backupId },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        filePath: result.filePath,
        fileSize: BigInt(fileSize),
        completedAt: new Date(),
        duration,
        errorMessage: result.error
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    await prisma.backupLog.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date()
      }
    })
  }
}
