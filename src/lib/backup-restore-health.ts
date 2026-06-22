import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * PR-RESTORE-3: PM2 + health check helper'ları.
 */

export async function pm2RestartIlerihub(): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('pm2 restart ilerihub --update-env', { timeout: 30_000 })
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * /api/health endpoint'ini polleyerek server'ın hazır olduğunu doğrular.
 * Her saniye dener, max attempts kadar.
 */
export async function healthCheck(maxAttempts = 30): Promise<{ healthy: boolean; attempts: number }> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { stdout } = await execAsync(
        `curl -sf http://localhost:3000/api/health -o /dev/null -w "%{http_code}"`,
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
