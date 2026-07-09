import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import { resolveRestoreTarget } from './backup-restore-swap'

const execAsync = promisify(exec)

// RESTORE-ORCHESTRATOR: pm2 delete+start için ecosystem yolu (env override'lı).
const ECOSYSTEM_PATH =
  process.env.ILERIHUB_ECOSYSTEM?.trim() || '/home/rokunet/projects/ecosystem.config.js'

/**
 * PR-RESTORE-3 / RESTORE-PARAM-2: PM2 + health check helper'ları.
 * PM2 process adı ve portu artık prod'a ÇİVİLİ DEĞİL — çalışan ortamdan türetilir.
 */

export interface Pm2Target {
  name: string
  port: number
}

/**
 * RESTORE-PARAM-2: Restore hedefi PM2 process'ini güvenli sırayla türet:
 *   1) ENV ILERIHUB_PM2_NAME (açık override) → o addaki process
 *   2) yoksa `pm2 jlist`'te cwd'si resolveRestoreTarget() ile AYNI olan process
 * TEK eşleşme ŞART — 0 veya 2+ eşleşmede TAHMİN ETME, restore REDDET.
 * Port da aynı process'in env'inden alınır (health check doğru portu pollesin).
 */
export async function resolveRestorePm2(): Promise<Pm2Target> {
  const target = resolveRestoreTarget() // güvenli hedef dizin (geçersizse throw)
  const { stdout } = await execAsync('pm2 jlist', {
    timeout: 10_000,
    maxBuffer: 20 * 1024 * 1024,
  })
  let list: Array<{
    name?: string
    pm2_env?: { pm_cwd?: string; PORT?: string | number; env?: { PORT?: string | number } }
  }>
  try {
    list = JSON.parse(stdout)
  } catch {
    throw new Error('PM2 jlist parse edilemedi — restore REDDEDİLDİ')
  }

  const override = process.env.ILERIHUB_PM2_NAME?.trim()
  const matches = override
    ? list.filter((p) => p?.name === override)
    : list.filter((p) => {
        const cwd = p?.pm2_env?.pm_cwd
        return typeof cwd === 'string' && path.resolve(cwd) === target
      })

  if (matches.length !== 1) {
    throw new Error(
      `PM2 hedef process tek eşleşme değil (${matches.length}) — ` +
        `${override ? `ILERIHUB_PM2_NAME='${override}'` : `cwd='${target}'`}. ` +
        `Tahmin edilmez, restore REDDEDİLDİ.`
    )
  }

  const p = matches[0]
  const portRaw = p.pm2_env?.env?.PORT ?? p.pm2_env?.PORT ?? 3000
  const port = Number(portRaw) || 3000
  return { name: String(p.name), port }
}

export interface Pm2RestartResult {
  success: boolean
  error?: string
  name?: string
  port?: number
}

/**
 * Restore hedefinin PM2 process'ini restart eder (türetilen ad ile).
 * Türetme başarısızsa (0/2+ eşleşme) restart YAPMAZ, hata döner.
 */
export async function pm2RestartIlerihub(): Promise<Pm2RestartResult> {
  let t: Pm2Target
  try {
    t = await resolveRestorePm2()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    await execAsync(`pm2 restart ${JSON.stringify(t.name)} --update-env`, {
      timeout: 30_000,
    })
    return { success: true, name: t.name, port: t.port }
  } catch (err) {
    return { success: false, error: (err as Error).message, name: t.name, port: t.port }
  }
}

/**
 * RESTORE-ORCHESTRATOR (Faz 1): pm2 restart yerine DELETE + START (ecosystem'den).
 * DRILL-3 dersi: crash-loop / değişmiş .env durumunda `restart --update-env` env'i
 * tam yeniden yüklemedi (401→503 ancak delete+start ile düzeldi). delete+start
 * temiz process + güncel env garanti eder. Ad/port türetmeyi (fix-1) korur.
 */
export async function pm2DeleteStart(): Promise<Pm2RestartResult> {
  let t: Pm2Target
  try {
    t = await resolveRestorePm2()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    // delete idempotent (process yoksa hata yutulur), sonra ecosystem'den start.
    await execAsync(`pm2 delete ${JSON.stringify(t.name)}`, { timeout: 30_000 }).catch(() => {})
    await execAsync(
      `pm2 start ${JSON.stringify(ECOSYSTEM_PATH)} --only ${JSON.stringify(t.name)}`,
      { timeout: 60_000 }
    )
    return { success: true, name: t.name, port: t.port }
  } catch (err) {
    return { success: false, error: (err as Error).message, name: t.name, port: t.port }
  }
}

export interface BuildResult {
  success: boolean
  error?: string
  buildId?: string
}

/**
 * RESTORE-ORCHESTRATOR (Faz 1): restore edilen hedef dizinde `npm run build`.
 * PRESERVE artık eski .next'i taşımadığı için restore edilen kod KENDİ build'ini
 * üretir (yeni kod ↔ eski build uyumsuzluğu biter). node_modules PRESERVE'den
 * korunduğu için build'e hazır. Hedef dizin resolveRestoreTarget()'ten türetilir.
 */
export async function buildTarget(): Promise<BuildResult> {
  let dir: string
  try {
    dir = resolveRestoreTarget()
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
  try {
    await execAsync('NODE_ENV=production npm run build', {
      cwd: dir,
      timeout: 15 * 60_000, // build uzun sürebilir
      maxBuffer: 200 * 1024 * 1024,
    })
  } catch (err) {
    return { success: false, error: `Build başarısız: ${(err as Error).message}` }
  }
  try {
    const buildId = (await fs.readFile(path.join(dir, '.next/BUILD_ID'), 'utf8')).trim()
    return { success: true, buildId }
  } catch {
    return { success: false, error: '.next/BUILD_ID bulunamadı — build eksik/başarısız' }
  }
}

/**
 * /api/health endpoint'ini polleyerek server'ın hazır olduğunu doğrular.
 * Port artık PARAMETRE (hedef slotun portu) — prod:3000'e çivili değil.
 */
export async function healthCheck(
  port: number,
  maxAttempts = 30
): Promise<{ healthy: boolean; attempts: number }> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { stdout } = await execAsync(
        `curl -sf http://localhost:${port}/api/health -o /dev/null -w "%{http_code}"`,
        { timeout: 5_000 }
      )
      if (stdout.trim() === '200') return { healthy: true, attempts: i }
    } catch {
      // Henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  return { healthy: false, attempts: maxAttempts }
}
