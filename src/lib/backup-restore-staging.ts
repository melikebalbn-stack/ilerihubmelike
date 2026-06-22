import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import { validateBackup } from './backup-validation'

const execAsync = promisify(exec)

const STAGING_BASE = '/tmp/ilerihub-restore-staging'
const TEST_DB_PREFIX = 'ilerihub_restore_test'

export interface StagingArea {
  stagingDir: string
  extractedFileCount: number
  dbDumpPath: string | null
  testDbName: string | null
  testDbTableCount: number | null
  testDbCriticalTables: Record<string, number>
  durationMs: number
}

export interface StagingResult {
  success: boolean
  staging?: StagingArea
  errors: string[]
  warnings: string[]
}

interface DbConn {
  user: string
  host: string
  password: string
}

function parseDbConn(): DbConn {
  const url = process.env.DATABASE_URL ?? ''
  const userMatch = url.match(/:\/\/([^:]+):/)
  const passMatch = url.match(/:\/\/[^:]+:([^@]+)@/)
  const hostMatch = url.match(/@([^:/]+)/)
  return {
    user: userMatch?.[1] ?? 'ilerihub_user',
    host: hostMatch?.[1] ?? 'localhost',
    password: passMatch?.[1] ?? '',
  }
}

/**
 * PR-RESTORE-2: Backup'ı staging dizinine açar + varsa DB dump'ı test
 * DB'sine restore eder. Canlı sisteme dokunmaz (dry-run).
 *
 * Akış:
 *   1. validateBackup() gate (PR-RESTORE-1)
 *   2. /tmp/ilerihub-restore-staging/<backupId>/ dizini hazırla
 *   3. tar -xzf ile extract
 *   4. find *.dump → DB dump dosyasını bul
 *   5. Varsa: ayrı test DB (ilerihub_restore_test_<id>) oluştur + pg_restore
 *   6. Sanity check: tablo sayısı, kritik tablolar
 */
export async function extractToStaging(
  backupPath: string,
  options: { backupId: string }
): Promise<StagingResult> {
  const start = Date.now()
  const result: StagingResult = { success: false, errors: [], warnings: [] }

  // 1. Validation gate
  const validation = await validateBackup(backupPath)
  if (!validation.valid) {
    result.errors.push('Backup doğrulanamadı:', ...validation.errors)
    return result
  }
  result.warnings.push(...validation.warnings)

  // 2. Staging dizini hazırla
  const stagingDir = path.join(STAGING_BASE, options.backupId)
  try {
    await fs.rm(stagingDir, { recursive: true, force: true })
    await fs.mkdir(stagingDir, { recursive: true })
  } catch (err) {
    result.errors.push(`Staging dizini oluşturulamadı: ${(err as Error).message}`)
    return result
  }

  // 3. Extract
  let extractedFileCount = 0
  try {
    const { stdout } = await execAsync(
      `tar -xzf ${JSON.stringify(backupPath)} -C ${JSON.stringify(stagingDir)} && ` +
        `find ${JSON.stringify(stagingDir)} -type f | wc -l`,
      { maxBuffer: 100 * 1024 * 1024 }
    )
    extractedFileCount = parseInt(stdout.trim(), 10) || 0
  } catch (err) {
    result.errors.push(`Extract başarısız: ${(err as Error).message}`)
    await cleanupStaging(stagingDir).catch(() => {})
    return result
  }

  // 4. DB dump bul
  let dbDumpPath: string | null = null
  try {
    const { stdout } = await execAsync(
      `find ${JSON.stringify(stagingDir)} -name "*.dump" -type f`
    )
    const dumps = stdout.trim().split('\n').filter(Boolean)
    if (dumps.length > 0) {
      dbDumpPath = dumps[0]
      if (dumps.length > 1) {
        result.warnings.push(`Birden fazla .dump bulundu, ilki kullanılıyor: ${dbDumpPath}`)
      }
    }
  } catch {
    // sorun değil — sadece dosya backup olabilir
  }

  let testDbName: string | null = null
  let testDbTableCount: number | null = null
  const testDbCriticalTables: Record<string, number> = {}

  // 5. DB restore (varsa)
  if (dbDumpPath) {
    const safeId = options.backupId.replace(/[^a-z0-9]/gi, '_').slice(0, 20)
    testDbName = `${TEST_DB_PREFIX}_${safeId}`

    const db = parseDbConn()
    const psqlBase = `PGPASSWORD=${JSON.stringify(db.password)} psql -w -h ${db.host} -U ${db.user}`

    try {
      // psql -w: prompt yok, fail fast. </dev/null: stdin kapalı (TTY beklemez).
      await execAsync(`${psqlBase} -d postgres -c "DROP DATABASE IF EXISTS ${testDbName};" </dev/null`)
      await execAsync(`${psqlBase} -d postgres -c "CREATE DATABASE ${testDbName};" </dev/null`)

      // pg_restore — owner/acl uygulamayı atla (test DB farklı user'a ait olabilir)
      await execAsync(
        `PGPASSWORD=${JSON.stringify(db.password)} pg_restore -h ${db.host} -U ${db.user} ` +
          `-d ${testDbName} --no-owner --no-acl ${JSON.stringify(dbDumpPath)} </dev/null`,
        { maxBuffer: 100 * 1024 * 1024 }
      )

      // Tablo sayısı
      const { stdout: countOut } = await execAsync(
        `${psqlBase} -d ${testDbName} -tA -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"`
      )
      testDbTableCount = parseInt(countOut.trim(), 10) || 0

      // Kritik tablo sayımı
      const criticalTables = ['User', 'Personnel', 'CalibrationDevice', 'BackupLog', 'permission_audit_log']
      for (const table of criticalTables) {
        try {
          const { stdout: rowOut } = await execAsync(
            `${psqlBase} -d ${testDbName} -tA -c 'SELECT COUNT(*) FROM "${table}";'`
          )
          testDbCriticalTables[table] = parseInt(rowOut.trim(), 10) || 0
        } catch {
          testDbCriticalTables[table] = -1 // tablo yok / hata
        }
      }

      if (testDbTableCount < 50) {
        result.warnings.push(`Test DB tablo sayısı düşük (${testDbTableCount}) — backup eksik olabilir`)
      }
      if (testDbCriticalTables['User'] === undefined || testDbCriticalTables['User'] < 0) {
        result.warnings.push('Kritik tablo "User" bulunamadı veya okunamadı')
      }
    } catch (err) {
      result.errors.push(`DB restore başarısız: ${(err as Error).message}`)
      try {
        await execAsync(`${psqlBase} -d postgres -c "DROP DATABASE IF EXISTS ${testDbName};"`)
      } catch {}
      testDbName = null
    }
  }

  result.success = result.errors.length === 0
  result.staging = {
    stagingDir,
    extractedFileCount,
    dbDumpPath,
    testDbName,
    testDbTableCount,
    testDbCriticalTables,
    durationMs: Date.now() - start,
  }

  return result
}

/**
 * PR-RESTORE-3: Test DB ile canlı DB schema'sını karşılaştırır.
 * Eksik kritik tablolar varsa restore reddedilmeli (eski backup,
 * RBAC migration öncesi vb.).
 */
export interface SchemaCompatibilityResult {
  compatible: boolean
  liveTableCount: number
  testTableCount: number
  missingInTest: string[] // canlıda var, backup'ta yok (downgrade)
  extraInTest: string[] // backup'ta var, canlıda yok (upgrade — düşük risk)
  criticalMissing: string[] // missingInTest ∩ kritik liste
}

const CRITICAL_TABLES = [
  'User',
  'Personnel',
  'BackupLog',
  'role',
  'permission',
  'role_permission',
  'user_role',
  'permission_audit_log',
  'CalibrationDevice',
  'ldap_group_role_map',
] as const

export async function checkSchemaCompatibility(testDbName: string): Promise<SchemaCompatibilityResult> {
  const db = parseDbConn()
  const liveDbName = process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'ilerihub'
  const psqlBase = `PGPASSWORD=${JSON.stringify(db.password)} psql -w -h ${db.host} -U ${db.user}`

  async function listTables(dbName: string): Promise<string[]> {
    const { stdout } = await execAsync(
      `${psqlBase} -d ${dbName} -tA -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" </dev/null`
    )
    return stdout
      .trim()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const [liveTables, testTables] = await Promise.all([listTables(liveDbName), listTables(testDbName)])
  const liveSet = new Set(liveTables)
  const testSet = new Set(testTables)

  const missingInTest = liveTables.filter((t) => !testSet.has(t))
  const extraInTest = testTables.filter((t) => !liveSet.has(t))
  const criticalMissing = missingInTest.filter((t) => (CRITICAL_TABLES as readonly string[]).includes(t))

  return {
    compatible: criticalMissing.length === 0,
    liveTableCount: liveTables.length,
    testTableCount: testTables.length,
    missingInTest,
    extraInTest,
    criticalMissing,
  }
}

/**
 * Staging dizinini ve test DB'sini temizler.
 * Path/db name guard: sadece bilinen prefix'leri siler (yanlış silme koruması).
 */
export async function cleanupStaging(stagingDir: string, testDbName?: string | null): Promise<void> {
  if (stagingDir && stagingDir.startsWith(STAGING_BASE)) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }

  if (testDbName && testDbName.startsWith(TEST_DB_PREFIX)) {
    const db = parseDbConn()
    await execAsync(
      `PGPASSWORD=${JSON.stringify(db.password)} psql -h ${db.host} -U ${db.user} ` +
        `-d postgres -c "DROP DATABASE IF EXISTS ${testDbName};"`
    ).catch(() => {})
  }
}
