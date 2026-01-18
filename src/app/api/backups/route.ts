// Backups API - Liste ve Oluşturma
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  backupILERIHub,
  backupAkademi,
  backupDatabase,
  generateBackupName,
  getFileSize,
  PROJECT_CONFIGS
} from '@/lib/backup-service'

// Yetki kontrolü
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// GET - Yedek Listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    if (!isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
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
        createdBy: session.user.email,
        createdByName: session.user.name || session.user.email,
        serverIp: PROJECT_CONFIGS[projectName as keyof typeof PROJECT_CONFIGS]?.serverIp || '172.16.16.33',
        notes
      }
    })

    // Yedekleme işlemini başlat (arka planda)
    processBackup(backupLog.id, projectName, backupName, includeDatabase)

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

    // Veritabanı yedeği (opsiyonel)
    if (includeDatabase && projectName !== 'Database') {
      const dbBackupName = generateBackupName('database')
      await backupDatabase(dbBackupName)
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
