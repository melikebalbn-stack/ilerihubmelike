import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs, createReadStream } from 'fs'
import { createHash } from 'crypto'

const execAsync = promisify(exec)

export interface BackupValidationResult {
  valid: boolean
  filePath: string
  sizeBytes: number
  sha256?: string
  fileCount: number
  hasDbDump: boolean
  hasProjectFiles: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Backup tarball'ı doğrular — restore öncesi güvenlik gate'i.
 * Hiçbir restore aksiyonu yapmaz, sadece okur ve raporlar.
 *
 * Kontroller:
 *   1. Dosya erişimi + boyut sanity
 *   2. Gzip integrity (gzip -t)
 *   3. Tar listesi (tar -tzf) ve içerik var mı
 *   4. Backup tipi semantik tutarlılığı (DB dump beklenir mi, vb.)
 *   5. SHA-256 hash (gelecekteki BackupLog.checksum karşılaştırması için)
 */
export async function validateBackup(filePath: string): Promise<BackupValidationResult> {
  const result: BackupValidationResult = {
    valid: false,
    filePath,
    sizeBytes: 0,
    fileCount: 0,
    hasDbDump: false,
    hasProjectFiles: false,
    errors: [],
    warnings: [],
  }

  // 1. Dosya erişilebilir mi
  try {
    const stat = await fs.stat(filePath)
    result.sizeBytes = stat.size

    if (stat.size === 0) {
      result.errors.push('Dosya boş')
      return result
    }
    if (stat.size < 1024) {
      result.errors.push(`Dosya çok küçük (${stat.size} byte) — bozuk olabilir`)
      return result
    }
    if (stat.size < 1_000_000) {
      result.warnings.push(`Dosya küçük (${(stat.size / 1024).toFixed(1)} KB) — gerçek backup mı?`)
    }
  } catch (err) {
    result.errors.push(`Dosyaya erişilemiyor: ${(err as Error).message}`)
    return result
  }

  // 2. Gzip integrity
  try {
    await execAsync(`gzip -t ${JSON.stringify(filePath)}`)
  } catch (err) {
    result.errors.push(`Gzip integrity check başarısız (corrupt arşiv): ${(err as Error).message}`)
    return result
  }

  // 3. Tar listesi (TOC)
  let fileList: string[] = []
  try {
    const { stdout } = await execAsync(`tar -tzf ${JSON.stringify(filePath)}`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer (büyük tarball için)
    })
    fileList = stdout.split('\n').filter(Boolean)
    result.fileCount = fileList.length

    if (result.fileCount === 0) {
      result.errors.push('Tarball içinde dosya yok')
      return result
    }
  } catch (err) {
    result.errors.push(`Tar listesi alınamadı: ${(err as Error).message}`)
    return result
  }

  // 4. İçerik kontrolü — DB dump var mı, proje dosyaları var mı
  result.hasDbDump = fileList.some((f) => /database_.*\.dump$/.test(f) || f.endsWith('.dump'))
  result.hasProjectFiles = fileList.some(
    (f) => f.endsWith('package.json') || f.includes('src/') || f.includes('prisma/')
  )

  // Backup tipi mantık kontrolü (filename pattern'ına göre beklenti)
  const fileName = filePath.split('/').pop() || ''

  if (fileName.startsWith('ilerihub_') && !fileName.includes('with_db')) {
    if (!result.hasProjectFiles) {
      result.errors.push("Proje backup'ı ama proje dosyaları (package.json, src/) bulunamadı")
    }
  }

  if (fileName.includes('with_db') || fileName.startsWith('all_')) {
    if (!result.hasDbDump) {
      result.errors.push('with_db backup ama database dump bulunamadı')
    }
  }

  if (fileName.startsWith('database_')) {
    if (!result.hasDbDump) {
      result.errors.push('Database backup ama dump dosyası bulunamadı')
    }
  }

  // 5. SHA-256 (BackupLog.checksum gelecekteki karşılaştırma için)
  try {
    const hash = await new Promise<string>((resolve, reject) => {
      const sha = createHash('sha256')
      const stream = createReadStream(filePath)
      stream.on('error', reject)
      stream.on('data', (chunk) => sha.update(chunk))
      stream.on('end', () => resolve(sha.digest('hex')))
    })
    result.sha256 = hash
  } catch (err) {
    result.warnings.push(`SHA-256 hesaplanamadı: ${(err as Error).message}`)
  }

  // 6. Final karar
  result.valid = result.errors.length === 0
  return result
}

/**
 * BackupLog tablosundaki kayda göre tarball doğrula.
 * (PR-RESTORE-3'te endpoint'te çağrılacak.)
 */
export async function validateBackupById(backupLog: {
  fileName: string
  filePath?: string | null
}): Promise<BackupValidationResult> {
  const filePath = backupLog.filePath || `/home/rokunet/backups/${backupLog.fileName}`
  return validateBackup(filePath)
}
