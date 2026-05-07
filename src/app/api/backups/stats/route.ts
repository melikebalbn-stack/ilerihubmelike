// Backups API - İstatistikler
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBackupStats, formatFileSize } from '@/lib/backup-service'
import { requireUser } from '@/lib/auth/require-user'

// Yetki kontrolü
function isAuthorized(userRole: string): boolean {
  const allowedRoles = ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN']
  return allowedRoles.includes(userRole)
}

// GET - Yedekleme İstatistikleri
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-backups: requireUser — admin role check
    const { user, error } = await requireUser()
    if (error) return error

    if (!isAuthorized(user.role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    // Veritabanından istatistikler
    const [
      totalBackups,
      completedBackups,
      failedBackups,
      inProgressBackups,
      activeSchedules,
      recentBackups,
      backupsByProject,
      totalSizeResult
    ] = await Promise.all([
      prisma.backupLog.count(),
      prisma.backupLog.count({ where: { status: 'COMPLETED' } }),
      prisma.backupLog.count({ where: { status: 'FAILED' } }),
      prisma.backupLog.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.backupSchedule.count({ where: { isActive: true } }),
      prisma.backupLog.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          backupName: true,
          projectName: true,
          fileSize: true,
          createdAt: true
        }
      }),
      prisma.backupLog.groupBy({
        by: ['projectName'],
        _count: { id: true },
        where: { status: 'COMPLETED' }
      }),
      prisma.backupLog.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fileSize: true }
      })
    ])

    // Son yedek tarihi
    const lastBackup = await prisma.backupLog.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, projectName: true }
    })

    // Dosya sisteminden istatistikler
    const fileStats = await getBackupStats()

    // Proje bazlı istatistikleri düzenle
    const projectStats = backupsByProject.reduce((acc, item) => {
      acc[item.projectName] = item._count.id
      return acc
    }, {} as Record<string, number>)

    const totalSize = totalSizeResult._sum.fileSize || BigInt(0)

    return NextResponse.json({
      summary: {
        totalBackups,
        completedBackups,
        failedBackups,
        inProgressBackups,
        activeSchedules,
        totalSize: Number(totalSize),
        totalSizeFormatted: formatFileSize(Number(totalSize)),
        lastBackupDate: lastBackup?.completedAt || null,
        lastBackupProject: lastBackup?.projectName || null
      },
      byProject: projectStats,
      recentBackups: recentBackups.map(b => ({
        ...b,
        fileSize: Number(b.fileSize),
        fileSizeFormatted: formatFileSize(Number(b.fileSize))
      })),
      fileSystemStats: {
        ...fileStats,
        totalSizeFormatted: formatFileSize(fileStats.totalSize)
      }
    })
  } catch (error) {
    console.error('İstatistik hatası:', error)
    return NextResponse.json({ error: 'İstatistikler alınamadı' }, { status: 500 })
  }
}
