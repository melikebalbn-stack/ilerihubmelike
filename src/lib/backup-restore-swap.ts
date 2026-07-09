import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// PR-RESTORE-PARAM: restore hedefi artık prod'a ÇİVİLİ değil — çalışan ortamdan
// türetilir. Beklenen kök altında olmalı (path traversal / yanlış env koruması).
const ALLOWED_ROOT = '/home/rokunet/projects'
const PRE_RESTORE_BASE = '/home/rokunet/pre-restore-backups'

/**
 * Restore hedef dizinini güvenli biçimde türet:
 *   1) ENV ILERIHUB_RESTORE_TARGET (açık override) — varsa
 *   2) yoksa process.cwd() (çalışan slotun kendi dizini)
 * GÜVENLİK: sonuç /home/rokunet/projects/<slot> altında olmalı; değilse REDDET.
 * Böylece staging'den çalıştırınca staging'i, blue'dan çalıştırınca blue'yu
 * hedefler; asla başka bir yol (ör. /, /etc) restore edilemez.
 */
export function resolveRestoreTarget(): string {
  const raw = process.env.ILERIHUB_RESTORE_TARGET?.trim() || process.cwd()
  const target = path.resolve(raw)
  const rel = path.relative(ALLOWED_ROOT, target)
  const underRoot =
    target !== ALLOWED_ROOT && rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  // Ayrıca kök'ün doğrudan bir alt dizini olmalı (nested değil): tek segment.
  const singleSegment = underRoot && !rel.includes(path.sep)
  if (!singleSegment) {
    throw new Error(
      `Restore hedef dizini güvenlik kontrolünden geçemedi: "${target}" — ` +
        `beklenen ${ALLOWED_ROOT}/<slot> (tek segment) olmalı`
    )
  }
  return target
}

/** Tatbikat/log kanıtı için hedef dizin + hedef DB host/adı. */
export function describeRestoreTarget(): {
  targetDir: string
  dbHost: string
  dbName: string
} {
  const db = parseDbConn()
  const url = process.env.DATABASE_URL ?? ''
  const dbName = url.match(/@[^/]+\/([^?]+)/)?.[1] ?? 'bilinmiyor'
  let targetDir: string
  try {
    targetDir = resolveRestoreTarget()
  } catch (err) {
    targetDir = `GEÇERSİZ (${(err as Error).message})`
  }
  return { targetDir, dbHost: db.host, dbName }
}

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

  // Hedef dizini türet — güvenlik kontrolünden geçemezse restore REDDET.
  let ILERIHUB_LIVE: string
  try {
    ILERIHUB_LIVE = resolveRestoreTarget()
  } catch (err) {
    return { success: false, preRestoreDir, errors: [(err as Error).message] }
  }

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

    // 4. PRESERVE'leri pre-restore'dan live'a KOPYALA (mv DEĞİL).
    // RESTORE-PARAM-2 (rollback veri kaybı fix'i): orijinaller pre-restore'da
    // KALIR → pre-restore her an EKSİKSİZ geri dönüş noktası; rollback'in özel
    // PRESERVE mantığına gerek kalmaz, yıkıcı rollback riski ortadan kalkar.
    // Disk maliyeti (node_modules kopyası) kabul — güvenlik > disk.
    for (const item of PRESERVE) {
      const src = path.join(preRestoreDir, item)
      const dest = path.join(ILERIHUB_LIVE, item)
      try {
        await fs.access(src)
        // Live tarafında varsa önce kaldır (rsync'ten gelen versiyonu)
        await execAsync(`rm -rf ${JSON.stringify(dest)}`).catch(() => {})
        // cp -a: attribute + symlink korunur; kaynak pre-restore'da DURUR.
        await execAsync(`cp -a ${JSON.stringify(src)} ${JSON.stringify(dest)}`, {
          maxBuffer: 100 * 1024 * 1024,
        })
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
  // Swap ile AYNI hedefi türet (aynı env/cwd) — tutarlı geri yükleme.
  const ILERIHUB_LIVE = resolveRestoreTarget()

  // RESTORE-PARAM-2: live'ı SİLMEDEN ÖNCE pre-restore'un EKSİKSİZ olduğunu
  // doğrula (dir + kritik snapshot kanıtı package.json). Eksikse rollback YAPMA
  // — eldeki live'ı KORU. "Yarım rollback > yıkıcı rollback": asla veri kaybı.
  try {
    await fs.access(preRestoreDir)
    await fs.access(path.join(preRestoreDir, 'package.json'))
  } catch {
    throw new Error(
      `Rollback İPTAL: pre-restore snapshot eksik/bulunamadı (${preRestoreDir}) — ` +
        `live korunuyor (yıkıcı rollback engellendi)`
    )
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
