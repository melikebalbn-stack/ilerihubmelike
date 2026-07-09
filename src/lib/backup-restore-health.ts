import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { resolveRestoreTarget } from './backup-restore-swap'

const execAsync = promisify(exec)

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
