// Backup Service - Yedekleme İşlemleri
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

// Proje Yapılandırmaları
export const PROJECT_CONFIGS = {
  ILERIHub: {
    path: '/home/rokunet/projects/ilerihub',
    serverIp: '172.16.16.33',
    excludes: ['node_modules', '.next', '.git', '.env', '.env.local'],
    isLocal: true
  },
  Akademi: {
    path: '/var/www/akademi',
    serverIp: '172.16.16.30',
    excludes: ['node_modules', '.git', 'uploads'],
    isLocal: false,
    sshUser: 'rokunet',
    sshPass: '1qaz2wsx'
  },
  Database: {
    path: '',
    serverIp: '172.16.16.33',
    excludes: [],
    isLocal: true
  }
}

export const BACKUP_DIR = '/home/rokunet/backups'

// Yedek dizinini oluştur
export async function ensureBackupDir(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

// Dosya boyutunu al
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  } catch {
    return 0
  }
}

// Boyutu formatla
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Timestamp oluştur
export function generateTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:T]/g, '').substring(0, 14)
}

// Yedek adı oluştur
export function generateBackupName(projectName: string, includeDb: boolean = false): string {
  const timestamp = generateTimestamp()
  const dbSuffix = includeDb ? '_with_db' : ''
  return `${projectName.toLowerCase()}${dbSuffix}_${timestamp}.tar.gz`
}

// ILERIHub Yedeği Al (Lokal)
export async function backupILERIHub(backupName: string): Promise<{ success: boolean; filePath: string; error?: string }> {
  await ensureBackupDir()
  const config = PROJECT_CONFIGS.ILERIHub
  const filePath = path.join(BACKUP_DIR, backupName)

  const excludeArgs = config.excludes.map(e => `--exclude='${e}'`).join(' ')
  const command = `cd ${path.dirname(config.path)} && tar -czvf ${filePath} ${excludeArgs} ${path.basename(config.path)}`

  try {
    await execAsync(command, { maxBuffer: 1024 * 1024 * 100 })
    return { success: true, filePath }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, filePath: '', error: errorMessage }
  }
}

// Akademi Yedeği Al (Uzak Sunucu)
export async function backupAkademi(backupName: string): Promise<{ success: boolean; filePath: string; error?: string }> {
  await ensureBackupDir()
  const config = PROJECT_CONFIGS.Akademi
  const remotePath = `/tmp/${backupName}`
  const localPath = path.join(BACKUP_DIR, backupName)

  const excludeArgs = config.excludes.map(e => `--exclude='${e}'`).join(' ')

  try {
    // Uzak sunucuda yedek oluştur
    const createCmd = `sshpass -p '${config.sshPass}' ssh -o StrictHostKeyChecking=no ${config.sshUser}@${config.serverIp} "cd /var/www && tar -czvf ${remotePath} ${excludeArgs} akademi"`
    await execAsync(createCmd, { maxBuffer: 1024 * 1024 * 100 })

    // Yedeği bu sunucuya kopyala
    const copyCmd = `sshpass -p '${config.sshPass}' scp -o StrictHostKeyChecking=no ${config.sshUser}@${config.serverIp}:${remotePath} ${localPath}`
    await execAsync(copyCmd, { maxBuffer: 1024 * 1024 * 500 })

    // Uzak sunucudaki geçici dosyayı sil
    const cleanCmd = `sshpass -p '${config.sshPass}' ssh -o StrictHostKeyChecking=no ${config.sshUser}@${config.serverIp} "rm -f ${remotePath}"`
    await execAsync(cleanCmd)

    return { success: true, filePath: localPath }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, filePath: '', error: errorMessage }
  }
}

// Veritabanı Yedeği Al
export async function backupDatabase(backupName: string): Promise<{ success: boolean; filePath: string; error?: string }> {
  await ensureBackupDir()
  const filePath = path.join(BACKUP_DIR, backupName)

  // PostgreSQL bağlantı bilgileri (.env'den alınmalı, şimdilik sabit)
  const dbName = 'ilerihub'
  const dbUser = 'rokunet'
  const dbHost = 'localhost'

  const command = `pg_dump -h ${dbHost} -U ${dbUser} -d ${dbName} -F c -f ${filePath.replace('.tar.gz', '.dump')}`

  try {
    await execAsync(command)

    // Dump dosyasını tar.gz yap
    const tarCmd = `cd ${BACKUP_DIR} && tar -czvf ${backupName} ${backupName.replace('.tar.gz', '.dump')} && rm ${backupName.replace('.tar.gz', '.dump')}`
    await execAsync(tarCmd)

    return { success: true, filePath }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, filePath: '', error: errorMessage }
  }
}

// Yedekleri Listele
export async function listBackups(): Promise<{ name: string; size: number; created: Date; path: string }[]> {
  await ensureBackupDir()

  try {
    const files = fs.readdirSync(BACKUP_DIR)
    const backups = files
      .filter(f => f.endsWith('.tar.gz'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f)
        const stats = fs.statSync(filePath)
        return {
          name: f,
          size: stats.size,
          created: stats.mtime,
          path: filePath
        }
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime())

    return backups
  } catch {
    return []
  }
}

// Yedeği Sil
export async function deleteBackupFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return { success: true }
    }
    return { success: false, error: 'Dosya bulunamadı' }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

// ILERIHub Geri Yükle
export async function restoreILERIHub(backupPath: string): Promise<{ success: boolean; error?: string }> {
  const config = PROJECT_CONFIGS.ILERIHub

  try {
    // Önce mevcut projeyi yedekle (pre-restore)
    const preRestoreBackup = generateBackupName('ilerihub_prerestore')
    await backupILERIHub(preRestoreBackup)

    // Mevcut projeyi sil (dikkatli!)
    const removeCmd = `rm -rf ${config.path}/*`
    await execAsync(removeCmd)

    // Yedeği çıkart
    const extractCmd = `tar -xzvf ${backupPath} -C ${path.dirname(config.path)}`
    await execAsync(extractCmd, { maxBuffer: 1024 * 1024 * 100 })

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

// Akademi Geri Yükle
export async function restoreAkademi(backupPath: string): Promise<{ success: boolean; error?: string }> {
  const config = PROJECT_CONFIGS.Akademi
  const backupName = path.basename(backupPath)
  const remotePath = `/tmp/${backupName}`

  try {
    // Yedeği uzak sunucuya kopyala
    const copyCmd = `sshpass -p '${config.sshPass}' scp -o StrictHostKeyChecking=no ${backupPath} ${config.sshUser}@${config.serverIp}:${remotePath}`
    await execAsync(copyCmd, { maxBuffer: 1024 * 1024 * 500 })

    // Uzak sunucuda geri yükle
    const restoreCmd = `sshpass -p '${config.sshPass}' ssh -o StrictHostKeyChecking=no ${config.sshUser}@${config.serverIp} "cd /var/www && rm -rf akademi_old && mv akademi akademi_old && tar -xzvf ${remotePath} && rm ${remotePath}"`
    await execAsync(restoreCmd, { maxBuffer: 1024 * 1024 * 100 })

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

// Eski Yedekleri Temizle
export async function cleanOldBackups(retentionDays: number): Promise<number> {
  await ensureBackupDir()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  let deletedCount = 0

  try {
    const files = fs.readdirSync(BACKUP_DIR)

    for (const file of files) {
      if (!file.endsWith('.tar.gz')) continue

      const filePath = path.join(BACKUP_DIR, file)
      const stats = fs.statSync(filePath)

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath)
        deletedCount++
      }
    }
  } catch (error) {
    console.error('Eski yedekleri temizlerken hata:', error)
  }

  return deletedCount
}

// Yedekleme İstatistikleri
export async function getBackupStats(): Promise<{
  totalBackups: number
  totalSize: number
  oldestBackup: Date | null
  newestBackup: Date | null
  byProject: Record<string, number>
}> {
  const backups = await listBackups()

  const stats = {
    totalBackups: backups.length,
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
    newestBackup: backups.length > 0 ? backups[0].created : null,
    byProject: {} as Record<string, number>
  }

  for (const backup of backups) {
    const projectName = backup.name.split('_')[0]
    stats.byProject[projectName] = (stats.byProject[projectName] || 0) + 1
  }

  return stats
}
