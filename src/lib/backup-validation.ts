import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs, createReadStream } from 'fs'
import { createHash } from 'crypto'
import * as os from 'os'
import * as path from 'path'

const execAsync = promisify(exec)

// PR-3b: DB dump TOC beklentileri. pg_restore -l entry sayısı bozuk/kesik
// dump'ta çok düşer; sağlam prod dump'ı ~1900+ entry taşır. 1000 hard floor
// (corrupt yakalar), 1700 altı ise UYARI (beklenenden küçük).
const MIN_TOC_ENTRIES = 1000
const EXPECTED_TOC_ENTRIES = 1700
// Sağlam bir dump'ta bulunması beklenen kritik tablolar (substring eşleşme;
// "Calibration" → CalibrationDevice'ı da yakalar).
const CRITICAL_TABLES = ['User', 'Personnel', 'BackupLog', 'CostAnalysis', 'Calibration'] as const
// Bunlardan biri eksikse dump geçersiz sayılır (çekirdek).
const CORE_TABLES = ['User', 'Personnel'] as const

export interface BackupCheck {
  name: string
  ok: boolean
  detail?: string
}

export interface BackupValidationResult {
  valid: boolean
  filePath: string
  sizeBytes: number
  sha256?: string
  fileCount: number
  hasDbDump: boolean
  hasProjectFiles: boolean
  // PR-3b: yapılandırılmış kontrol listesi (UI + ISO A.8.13 kanıtı için).
  checks: BackupCheck[]
  // DB dump TOC bilgisi (hasDbDump ise doldurulur).
  tocEntries?: number
  errors: string[]
  warnings: string[]
}

/**
 * Backup tarball'ı doğrular — restore öncesi güvenlik gate'i.
 * Hiçbir restore aksiyonu yapmaz, sadece okur ve raporlar. Geçemeyen backup
 * restore'a İLERLEYEMEZ (valid=false).
 *
 * Kontroller:
 *   1. Dosya erişimi + boyut sanity
 *   2. Gzip integrity (gzip -t)
 *   3. Tar listesi (tar -tzf) ve içerik var mı
 *   4. Backup tipi semantik tutarlılığı (DB dump beklenir mi, vb.)
 *   5. DB dump TOC (pg_restore -l): entry sayısı + kritik tablolar
 *   6. SHA-256 hash (BackupLog.checksum karşılaştırması için)
 */
export async function validateBackup(filePath: string): Promise<BackupValidationResult> {
  const result: BackupValidationResult = {
    valid: false,
    filePath,
    sizeBytes: 0,
    fileCount: 0,
    hasDbDump: false,
    hasProjectFiles: false,
    checks: [],
    errors: [],
    warnings: [],
  }
  const addCheck = (name: string, ok: boolean, detail?: string) => {
    result.checks.push({ name, ok, detail })
  }

  // 1. Dosya erişilebilir mi
  try {
    const stat = await fs.stat(filePath)
    result.sizeBytes = stat.size

    if (stat.size === 0) {
      result.errors.push('Dosya boş')
      addCheck('dosya-boyut', false, 'boş')
      return result
    }
    if (stat.size < 1024) {
      result.errors.push(`Dosya çok küçük (${stat.size} byte) — bozuk olabilir`)
      addCheck('dosya-boyut', false, `${stat.size} byte`)
      return result
    }
    if (stat.size < 1_000_000) {
      result.warnings.push(`Dosya küçük (${(stat.size / 1024).toFixed(1)} KB) — gerçek backup mı?`)
    }
    addCheck('dosya-boyut', true, `${(stat.size / 1024 / 1024).toFixed(1)} MB`)
  } catch (err) {
    result.errors.push(`Dosyaya erişilemiyor: ${(err as Error).message}`)
    addCheck('dosya-erisim', false, (err as Error).message)
    return result
  }

  // 2. Gzip integrity
  try {
    await execAsync(`gzip -t ${JSON.stringify(filePath)}`)
    addCheck('gzip-integrity', true)
  } catch (err) {
    result.errors.push(`Gzip integrity check başarısız (corrupt arşiv): ${(err as Error).message}`)
    addCheck('gzip-integrity', false, (err as Error).message)
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
      addCheck('tar-icerik', false, 'boş')
      return result
    }
    addCheck('tar-icerik', true, `${result.fileCount} entry`)
  } catch (err) {
    result.errors.push(`Tar listesi alınamadı: ${(err as Error).message}`)
    addCheck('tar-icerik', false, (err as Error).message)
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
      addCheck('proje-dosyalari', false)
    } else {
      addCheck('proje-dosyalari', true)
    }
  }

  if (fileName.includes('with_db') || fileName.startsWith('all_')) {
    if (!result.hasDbDump) {
      result.errors.push('with_db backup ama database dump bulunamadı')
      addCheck('db-dump-varlik', false)
    } else {
      addCheck('db-dump-varlik', true)
    }
  }

  if (fileName.startsWith('database_')) {
    if (!result.hasDbDump) {
      result.errors.push('Database backup ama dump dosyası bulunamadı')
      addCheck('db-dump-varlik', false)
    } else {
      addCheck('db-dump-varlik', true)
    }
  }

  // 5. DB dump TOC kontrolü (pg_restore -l) — yalnız dump içeren backup'larda.
  // Dump'ı geçici dizine çıkar, pg_restore -l ile entry + kritik tablo doğrula.
  if (result.hasDbDump) {
    await validateDumpToc(filePath, fileList, result, addCheck)
  }

  // 6. SHA-256 (BackupLog.checksum karşılaştırması için)
  try {
    const hash = await new Promise<string>((resolve, reject) => {
      const sha = createHash('sha256')
      const stream = createReadStream(filePath)
      stream.on('error', reject)
      stream.on('data', (chunk) => sha.update(chunk))
      stream.on('end', () => resolve(sha.digest('hex')))
    })
    result.sha256 = hash
    addCheck('sha256', true, hash.slice(0, 12) + '…')
  } catch (err) {
    result.warnings.push(`SHA-256 hesaplanamadı: ${(err as Error).message}`)
    addCheck('sha256', false, (err as Error).message)
  }

  // 7. Final karar
  result.valid = result.errors.length === 0
  return result
}

/**
 * PR-3b: DB dump'ının pg_restore -l TOC'unu doğrular. Dump'ı geçici bir dizine
 * çıkarır (canlıya dokunmaz, DB'ye bağlanmaz — yalnız TOC listeler), entry
 * sayısı + kritik tabloları kontrol eder, sonra temizler.
 */
async function validateDumpToc(
  filePath: string,
  fileList: string[],
  result: BackupValidationResult,
  addCheck: (name: string, ok: boolean, detail?: string) => void
): Promise<void> {
  const dumpEntry = fileList.find((f) => /\.dump$/.test(f))
  if (!dumpEntry) {
    result.errors.push('DB dump tarball içinde bulunamadı (TOC kontrolü yapılamadı)')
    addCheck('dump-toc', false, 'dump yok')
    return
  }

  let tmpDir: string | null = null
  try {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ilerihub-toc-'))
    // Yalnız dump dosyasını çıkar (tüm tarball'ı değil).
    await execAsync(
      `tar -xzf ${JSON.stringify(filePath)} -C ${JSON.stringify(tmpDir)} ${JSON.stringify(dumpEntry)}`,
      { maxBuffer: 50 * 1024 * 1024 }
    )
    const dumpPath = path.join(tmpDir, dumpEntry)

    // pg_restore -l: TOC listeler, DB'ye BAĞLANMAZ (salt-okuma).
    const { stdout } = await execAsync(`pg_restore -l ${JSON.stringify(dumpPath)}`, {
      maxBuffer: 50 * 1024 * 1024,
    })
    const toc = stdout
    const entries = toc.split('\n').filter((l) => l && !l.startsWith(';')).length
    result.tocEntries = entries

    // Entry sayısı
    if (entries < MIN_TOC_ENTRIES) {
      result.errors.push(
        `DB dump TOC çok az entry içeriyor (${entries} < ${MIN_TOC_ENTRIES}) — kesik/bozuk dump`
      )
      addCheck('dump-toc-entry', false, `${entries} entry`)
    } else {
      addCheck('dump-toc-entry', true, `${entries} entry`)
      if (entries < EXPECTED_TOC_ENTRIES) {
        result.warnings.push(
          `DB dump TOC beklenenden küçük (${entries} < ${EXPECTED_TOC_ENTRIES}) — eski/kısmi backup olabilir`
        )
      }
    }

    // Kritik tablolar (substring: "public <Tablo>")
    const missing: string[] = []
    for (const t of CRITICAL_TABLES) {
      const present = toc.includes(`public ${t}`)
      addCheck(`tablo:${t}`, present)
      if (!present) missing.push(t)
    }
    if (missing.length > 0) {
      const coreMissing = missing.filter((m) => (CORE_TABLES as readonly string[]).includes(m))
      if (coreMissing.length > 0) {
        result.errors.push(`Kritik çekirdek tablo(lar) dump'ta yok: ${coreMissing.join(', ')}`)
      } else {
        result.warnings.push(`Bazı kritik tablolar dump'ta bulunamadı: ${missing.join(', ')}`)
      }
    }
  } catch (err) {
    result.errors.push(`DB dump TOC kontrolü başarısız: ${(err as Error).message}`)
    addCheck('dump-toc', false, (err as Error).message)
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }
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
