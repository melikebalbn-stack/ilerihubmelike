/**
 * @deprecated Bu dosyadaki node-cron schedule'ları artık production'da
 * kullanılmıyor. PM2 restart sonrası ölüyordu (kanıtlanmış sorun,
 * 2026-05-02 ile 2026-05-04 arası personel evaluation mailleri
 * gönderilmedi).
 *
 * Yeni mekanizma: sistem cron (/etc/cron.d/ilerihub-cron).
 * Endpoint mantığı (check-evaluations, check-deadlines vb.)
 * değişmedi — sadece tetikleme noktası dışarıya taşındı.
 *
 * Bu dosya silinmedi çünkü:
 * 1. /api/cron/init endpoint'i hâlâ manuel debug için kullanılabilir
 * 2. Mantık geçmişi referans olarak değerli
 *
 * Detay: docs/CRON.md
 */
import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import {
  backupILERIHub,
  backupAkademi,
  backupDatabase,
  generateBackupName,
  getFileSize,
  cleanOldBackups
} from '@/lib/backup-service'
import { syncLDAPUsersToDb } from '@/lib/ldap-sync'

let isSchedulerInitialized = false

/**
 * Initialize all notification schedulers
 * Runs daily at 09:00 AM
 */
export function initializeCalibrationScheduler() {
  if (isSchedulerInitialized) {
    console.log('⏰ Scheduler already initialized')
    return
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Kalibrasyon bildirimleri - Her gün 09:00
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled calibration check...')

    try {
      const response = await fetch(`${baseUrl}/api/calibration/check-notifications`, {
        method: 'POST',
      })

      const data = await response.json()
      console.log('✅ Calibration check completed:', data)
    } catch (error) {
      console.error('❌ Calibration check failed:', error)
    }
  })

  // Görev bildirimleri - Her gün 09:15
  cron.schedule('15 9 * * *', async () => {
    console.log('⏰ Running scheduled task notification check...')

    try {
      const response = await fetch(`${baseUrl}/api/tasks/check-notifications`, {
        method: 'GET',
      })

      const data = await response.json()
      console.log('✅ Task notification check completed:', data)
    } catch (error) {
      console.error('❌ Task notification check failed:', error)
    }
  })

  // Eskalasyon kontrolü - Her gün 09:30
  cron.schedule('30 9 * * *', async () => {
    console.log('⏰ Running scheduled escalation check...')

    try {
      const response = await fetch(`${baseUrl}/api/tasks/check-escalation`, {
        method: 'GET',
      })

      const data = await response.json()
      console.log('✅ Escalation check completed:', data)
    } catch (error) {
      console.error('❌ Escalation check failed:', error)
    }
  })

  // Personel değerlendirme hatırlatması (2 ay / 6 ay) - Her gün 09:45
  cron.schedule('45 9 * * *', async () => {
    console.log('⏰ Running scheduled personnel evaluation check...')

    try {
      const response = await fetch(`${baseUrl}/api/personnel/check-evaluations`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      })

      const data = await response.json()
      console.log('✅ Personnel evaluation check completed:', data)
    } catch (error) {
      console.error('❌ Personnel evaluation check failed:', error)
    }
  })

  // LDAP → DB kullanıcı senkronizasyonu - Her 6 saatte bir (02:00, 08:00, 14:00, 20:00)
  cron.schedule('0 2,8,14,20 * * *', async () => {
    console.log('⏰ Running scheduled LDAP user sync...')

    try {
      const result = await syncLDAPUsersToDb()
      console.log('✅ LDAP sync completed:', {
        created: result.created,
        updated: result.updated,
        deactivated: result.deactivated,
        errors: result.errors,
        duration: `${result.duration}s`,
      })
    } catch (error) {
      console.error('❌ LDAP sync failed:', error)
    }
  })

  // Uygulama başlangıcında ilk LDAP sync'i çalıştır (30 saniye gecikmeyle)
  setTimeout(async () => {
    console.log('⏰ Running initial LDAP user sync...')
    try {
      const result = await syncLDAPUsersToDb()
      console.log('✅ Initial LDAP sync completed:', {
        created: result.created,
        updated: result.updated,
        duration: `${result.duration}s`,
      })
    } catch (error) {
      console.error('❌ Initial LDAP sync failed:', error)
    }
  }, 30000)

  // Akademi: deadline kontrolleri - Her gün 10:00
  cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Running Akademi deadline check...')
    try {
      const response = await fetch(`${baseUrl}/api/akademi/cron/check-deadlines`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      })
      const data = await response.json()
      console.log('✅ Akademi deadline check:', data)
    } catch (error) {
      console.error('❌ Akademi deadline check failed:', error)
    }
  })

  // Akademi: sertifika expiry kontrolleri - Her gün 10:30
  cron.schedule('30 10 * * *', async () => {
    console.log('⏰ Running Akademi certificate check...')
    try {
      const response = await fetch(`${baseUrl}/api/akademi/cron/check-certificates`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      })
      const data = await response.json()
      console.log('✅ Akademi certificate check:', data)
    } catch (error) {
      console.error('❌ Akademi certificate check failed:', error)
    }
  })

  // Yedekleme kontrolü - Her dakika
  cron.schedule('* * * * *', async () => {
    await checkScheduledBackups()
  })

  isSchedulerInitialized = true
  console.log('✅ All notification schedulers initialized:')
  console.log('   - Calibration: 09:00 AM daily')
  console.log('   - Task notifications: 09:15 AM daily')
  console.log('   - Escalation check: 09:30 AM daily')
  console.log('   - Personnel evaluation (2ay/6ay): 09:45 AM daily')
  console.log('   - Akademi deadlines: 10:00 AM daily')
  console.log('   - Akademi certificates: 10:30 AM daily')
  console.log('   - LDAP user sync: every 6 hours (02:00, 08:00, 14:00, 20:00)')
  console.log('   - LDAP initial sync: 30s after startup')
  console.log('   - Backup scheduler: every minute')
}

/**
 * Check and run scheduled backups
 */
async function checkScheduledBackups() {
  try {
    const now = new Date()

    // Aktif ve çalışma zamanı gelmiş zamanlamaları bul
    const dueSchedules = await prisma.backupSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now
        }
      }
    })

    for (const schedule of dueSchedules) {
      console.log(`📦 Running scheduled backup: ${schedule.name}`)
      await runScheduledBackup(schedule)
    }
  } catch (error) {
    console.error('Scheduled backup check error:', error)
  }
}

/**
 * Run a scheduled backup
 */
async function runScheduledBackup(schedule: {
  id: string
  name: string
  projectName: string
  frequency: string
  time: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  retentionDays: number
  includeDatabase: boolean
}) {
  const startTime = Date.now()
  const backupName = generateBackupName(schedule.projectName, schedule.includeDatabase)

  // Yedekleme kaydı oluştur
  const backupLog = await prisma.backupLog.create({
    data: {
      backupName,
      backupType: 'SCHEDULED',
      projectName: schedule.projectName,
      filePath: '',
      fileSize: BigInt(0),
      status: 'IN_PROGRESS',
      includeDatabase: schedule.includeDatabase,
      startedAt: new Date(),
      createdBy: 'system',
      createdByName: 'Otomatik Zamanlama',
      notes: `Zamanlama: ${schedule.name}`
    }
  })

  try {
    let result: { success: boolean; filePath: string; error?: string }

    // Projeye göre yedekleme
    switch (schedule.projectName) {
      case 'ILERIHub':
        result = await backupILERIHub(backupName)
        break
      case 'Akademi':
        result = await backupAkademi(backupName)
        break
      case 'Database':
        result = await backupDatabase(backupName)
        break
      default:
        result = { success: false, filePath: '', error: 'Geçersiz proje' }
    }

    // Veritabanı yedeği (opsiyonel)
    if (schedule.includeDatabase && schedule.projectName !== 'Database') {
      const dbBackupName = generateBackupName('database')
      await backupDatabase(dbBackupName)
    }

    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)
    const fileSize = result.success ? getFileSize(result.filePath) : 0

    // Yedek kaydını güncelle
    await prisma.backupLog.update({
      where: { id: backupLog.id },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        filePath: result.filePath,
        fileSize: BigInt(fileSize),
        completedAt: new Date(),
        duration,
        errorMessage: result.error
      }
    })

    // Zamanlamayı güncelle - sonraki çalışma zamanını hesapla
    const nextRunAt = calculateNextBackupRunAt(
      schedule.frequency,
      schedule.time,
      schedule.dayOfWeek,
      schedule.dayOfMonth
    )

    await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt
      }
    })

    // Eski yedekleri temizle
    if (schedule.retentionDays > 0) {
      const deletedCount = await cleanOldBackups(schedule.retentionDays)
      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned ${deletedCount} old backups (retention: ${schedule.retentionDays} days)`)
      }
    }

    console.log(`✅ Scheduled backup completed: ${backupName}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'

    await prisma.backupLog.update({
      where: { id: backupLog.id },
      data: {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date()
      }
    })

    console.error(`❌ Scheduled backup failed: ${schedule.name}`, error)
  }
}

/**
 * Calculate next backup run time
 */
function calculateNextBackupRunAt(
  frequency: string,
  time: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const now = new Date()
  const nextRun = new Date()

  nextRun.setHours(hours, minutes, 0, 0)

  switch (frequency) {
    case 'DAILY':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY':
      const targetDay = dayOfWeek || 0
      const currentDay = nextRun.getDay()
      let daysUntilTarget = targetDay - currentDay
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget)
      break

    case 'MONTHLY':
      const targetDate = dayOfMonth || 1
      nextRun.setDate(targetDate)
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      break
  }

  return nextRun
}

/**
 * Run calibration check immediately (for testing)
 */
export async function runCalibrationCheckNow() {
  console.log('🔄 Running immediate calibration check...')

  try {
    const response = await fetch('http://localhost:3000/api/calibration/check-notifications', {
      method: 'POST',
    })

    const data = await response.json()
    console.log('✅ Immediate check completed:', data)
    return data
  } catch (error) {
    console.error('❌ Immediate check failed:', error)
    throw error
  }
}
