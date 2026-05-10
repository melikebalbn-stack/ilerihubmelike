import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

const ILERIHUB_LIVE = '/home/rokunet/projects/ilerihub'
const PRE_RESTORE_BASE = '/home/rokunet/pre-restore-backups'

// Live'da kalması gereken dosyalar (staging tarball'ında olabilir veya
// olmayabilir; mevcut hali korumak için pre-restore'dan geri taşınır).
const PRESERVE = ['.env', '.env.local', 'node_modules', '.next', 'logs']

interface DbConn {
  user: string
  host: string
  password: string
}

function parseDbConn(): DbConn {
  const url = process.env.DATABASE_URL ?? ''
  return {
    user: url.match(/:\/\/([^:]+):/)?.[1] ?? 'ilerihub_user',
    host: url.match(/@([^:/]+)/)?.[1] ?? 'localhost',
    password: url.match(/:\/\/[^:]+:([^@]+)@/)?.[1] ?? '',
  }
}

export interface SwapResult {
  success: boolean
  preRestoreDir: string
  errors: string[]
}

/**
 * PR-RESTORE-3: Canlı dosya sistemini staging ile değiştirir.
 *
 * Akış:
 *  1. Pre-restore: live → /home/rokunet/pre-restore-backups/<id>/  (mv, atomic)
 *  2. Live boş dizin oluştur
 *  3. rsync ile staging içeriğini live'a kopyala
 *  4. PRESERVE listesindeki dosyaları pre-restore'dan live'a geri taşı
 *
 * Hata olursa rollback otomatik (pre-restore'dan geri).
 *
 * NOT: PM2 process mevcut cwd file descriptor'ı tutuyor; mv inode'u
 * değiştirmediği için pm2 restart sonrasına kadar process eski cwd'de
 * çalışmaya devam eder. Endpoint akışı: swap → pm2 restart → health check.
 */
export async function swapFilesAtomic(
  stagingDir: string,
  options: { backupId: string }
): Promise<SwapResult> {
  const safeId = options.backupId.replace(/[^a-z0-9_-]/gi, '_')
  const preRestoreDir = path.join(PRE_RESTORE_BASE, safeId)

  await fs.mkdir(PRE_RESTORE_BASE, { recursive: true })

  try {
    // 1. Mevcut live'ı pre-restore'a taşı (atomic mv)
    await execAsync(`mv ${JSON.stringify(ILERIHUB_LIVE)} ${JSON.stringify(preRestoreDir)}`)
    await fs.mkdir(ILERIHUB_LIVE, { recursive: true })

    // 2. Staging içeriği — tar yapısı: <stagingDir>/ilerihub/* veya <stagingDir>/*
    const stagingContent = await fs.readdir(stagingDir)
    const sourceRoot =
      stagingContent.length === 1 && stagingContent[0] === 'ilerihub'
        ? path.join(stagingDir, 'ilerihub')
        : stagingDir

    // 3. rsync (trailing slash önemli — içerik kopyalansın, dizin değil)
    await execAsync(
      `rsync -a ${JSON.stringify(sourceRoot + '/')} ${JSON.stringify(ILERIHUB_LIVE + '/')}`,
      { maxBuffer: 100 * 1024 * 1024 }
    )

    // 4. PRESERVE'lerini pre-restore'dan live'a geri taşı
    for (const item of PRESERVE) {
      const src = path.join(preRestoreDir, item)
      const dest = path.join(ILERIHUB_LIVE, item)
      try {
        await fs.access(src)
        // Live tarafında varsa önce kaldır (rsync'ten gelen versiyonu)
        await execAsync(`rm -rf ${JSON.stringify(dest)}`).catch(() => {})
        await execAsync(`mv ${JSON.stringify(src)} ${JSON.stringify(dest)}`)
      } catch {
        // PRESERVE itemı pre-restore'da yoksa sorun değil (ilk kurulum vb.)
      }
    }

    return { success: true, preRestoreDir, errors: [] }
  } catch (err) {
    // Rollback dene
    await rollbackFiles(preRestoreDir).catch(() => {})
    return {
      success: false,
      preRestoreDir,
      errors: [`Atomic swap başarısız: ${(err as Error).message}`],
    }
  }
}

/**
 * Rollback: pre-restore'dan canlıya geri yükler.
 * Sadece bilinen prefix altındaki path'leri kabul eder (yanlış silme guard).
 */
export async function rollbackFiles(preRestoreDir: string): Promise<void> {
  if (!preRestoreDir.startsWith(PRE_RESTORE_BASE)) return
  try {
    await fs.access(preRestoreDir)
  } catch {
    return // pre-restore yok, rollback imkansız
  }
  await execAsync(`rm -rf ${JSON.stringify(ILERIHUB_LIVE)}`)
  await execAsync(`mv ${JSON.stringify(preRestoreDir)} ${JSON.stringify(ILERIHUB_LIVE)}`)
}

export interface DbSwapResult {
  success: boolean
  oldDbName: string
  errors: string[]
}

/**
 * Test DB'sini canlı DB ile değiştirir (PostgreSQL ALTER DATABASE RENAME).
 *
 * Akış:
 *  1. pg_terminate_backend ile aktif bağlantıları kapat (RENAME blocks otherwise)
 *  2. live → live_pre_restore_<ts> RENAME
 *  3. test → live RENAME
 *  4. Step 3 fail → step 2 geri al (live'ı geri getir)
 */
export async function swapDbAtomic(testDbName: string, liveDbName: string): Promise<DbSwapResult> {
  const ts = Date.now()
  const oldDbName = `${liveDbName}_pre_restore_${ts}`
  const db = parseDbConn()
  const psqlBase = `PGPASSWORD=${JSON.stringify(db.password)} psql -w -h ${db.host} -U ${db.user} -d postgres`

  try {
    // 1. Aktif bağlantıları kapat (RENAME serbest DB ister)
    await execAsync(
      `${psqlBase} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${liveDbName}','${testDbName}') AND pid <> pg_backend_pid();" </dev/null`
    )

    // 2. live → old (eski live'ı sakla, rollback için)
    await execAsync(`${psqlBase} -c "ALTER DATABASE ${liveDbName} RENAME TO ${oldDbName};" </dev/null`)

    // 3. test → live
    try {
      await execAsync(`${psqlBase} -c "ALTER DATABASE ${testDbName} RENAME TO ${liveDbName};" </dev/null`)
    } catch (err) {
      // Felaket: live silindi ama test rename olmadı → live'ı geri al
      await execAsync(
        `${psqlBase} -c "ALTER DATABASE ${oldDbName} RENAME TO ${liveDbName};" </dev/null`
      ).catch(() => {})
      throw err
    }

    return { success: true, oldDbName, errors: [] }
  } catch (err) {
    return {
      success: false,
      oldDbName,
      errors: [`DB swap başarısız: ${(err as Error).message}`],
    }
  }
}

/**
 * DB rollback: yeni live'ı sil, eskiyi geri getir.
 */
export async function rollbackDb(oldDbName: string, liveDbName: string): Promise<void> {
  const db = parseDbConn()
  const psqlBase = `PGPASSWORD=${JSON.stringify(db.password)} psql -w -h ${db.host} -U ${db.user} -d postgres`

  // Mevcut "live" muhtemelen başarısız restore — sil, eskiyi geri getir
  await execAsync(
    `${psqlBase} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${liveDbName}','${oldDbName}') AND pid <> pg_backend_pid();" </dev/null`
  ).catch(() => {})
  await execAsync(`${psqlBase} -c "DROP DATABASE IF EXISTS ${liveDbName};" </dev/null`).catch(() => {})
  await execAsync(`${psqlBase} -c "ALTER DATABASE ${oldDbName} RENAME TO ${liveDbName};" </dev/null`)
}
