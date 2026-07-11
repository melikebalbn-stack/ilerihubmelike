// RESTORE-ORCHESTRATOR Faz 2 — HEDEF ÇÖZÜMÜ (in-place vs passive-slot).
//
// TEK yürütme modeli; yalnız HEDEF ortama göre değişir:
//  - staging (tek slot): IN-PLACE — mevcut yol AYNEN (drill parity).
//  - prod (blue-green):  PASSIVE-SLOT — restore PASİF slotu hedefler; orada kurulur,
//    build+doğrulanır, health OK → DB swap → nginx swap. AKTİF slota hiç dokunulmaz.
//
// Env-override'lar EN ÜSTTE: ILERIHUB_RESTORE_TARGET set ise açık in-place hedef.
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// Test/ops esnekliği: upstream conf yolu env ile override edilebilir (default prod).
const UPSTREAM_CONF =
  process.env.ILERIHUB_UPSTREAM_CONF?.trim() || '/etc/nginx/conf.d/ilerihub-upstream.conf'
const ROLLBACK_SH = '/home/rokunet/scripts/rollback.sh'

// Prod blue-green topolojisi (deploy.sh/rollback.sh ile aynı — tek doğruluk kaynağı).
const SLOTS: Record<'blue' | 'green', { dir: string; pm2: string; port: number }> = {
  blue: { dir: '/home/rokunet/projects/ilerihub', pm2: 'ilerihub-blue', port: 3000 },
  green: { dir: '/home/rokunet/projects/ilerihub-green', pm2: 'ilerihub-green', port: 3002 },
}

export type RestoreMode = 'in-place' | 'passive-slot'

export interface RestoreTargetInfo {
  mode: RestoreMode
  targetDir: string
  /** null → resolveRestorePm2() türetsin (in-place). */
  pm2Name: string | null
  /** null → türetilen port. */
  port: number | null
  /** prod passive-slot'ta true → nginx swap gerekir. */
  nginxSwap: boolean
  activeColor?: string
  passiveColor?: string
}

/** nginx upstream conf'tan aktif rengi oku (# CURRENT_ACTIVE=blue|green). */
export function readCurrentActive(): 'blue' | 'green' | null {
  try {
    const conf = readFileSync(UPSTREAM_CONF, 'utf8')
    const m = conf.match(/^#\s*CURRENT_ACTIVE=(\w+)/m)
    const c = m?.[1]
    return c === 'blue' || c === 'green' ? c : null
  } catch {
    return null
  }
}

/**
 * Restore hedefini çöz. GÜVENLİK (item 4): pasif hedef AKTİF slotla aynı çıkarsa
 * (veya çalışan slot CURRENT_ACTIVE ile uyuşmazsa) restore REDDEDİLİR.
 */
export function resolveRestoreModeInfo(): RestoreTargetInfo {
  // 1) Açık env override → in-place (en üstte).
  const override = process.env.ILERIHUB_RESTORE_TARGET?.trim()
  if (override) {
    return {
      mode: 'in-place',
      targetDir: path.resolve(override),
      pm2Name: process.env.ILERIHUB_PM2_NAME?.trim() || null,
      port: null,
      nginxSwap: false,
    }
  }

  // 2) Çalışan dizin blue-green slotlarından biri mi? → PROD passive-slot.
  const cwd = path.resolve(process.cwd())
  const isProdSlot = cwd === SLOTS.blue.dir || cwd === SLOTS.green.dir
  if (isProdSlot) {
    const active = readCurrentActive()
    if (!active) {
      throw new Error('Passive restore REDDEDİLDİ: CURRENT_ACTIVE okunamadı (nginx upstream conf)')
    }
    // GUARD (item 4 — yanlış tespit emniyeti): çalışan slot AKTİF slot olmalı.
    if (cwd !== SLOTS[active].dir) {
      throw new Error(
        `Passive restore REDDEDİLDİ: çalışan slot (${cwd}) CURRENT_ACTIVE=${active} (${SLOTS[active].dir}) ile uyuşmuyor`
      )
    }
    const passiveColor: 'blue' | 'green' = active === 'blue' ? 'green' : 'blue'
    const passive = SLOTS[passiveColor]
    // GUARD (item 4): hedef, AKTİF slotla AYNI olamaz.
    if (passive.dir === SLOTS[active].dir) {
      throw new Error(`Passive restore REDDEDİLDİ: hedef=aktif (${passive.dir})`)
    }
    return {
      mode: 'passive-slot',
      targetDir: passive.dir,
      pm2Name: passive.pm2,
      port: passive.port,
      nginxSwap: true,
      activeColor: active,
      passiveColor,
    }
  }

  // 3) Staging/dev → in-place (çalışan slotun kendisi).
  return { mode: 'in-place', targetDir: cwd, pm2Name: null, port: null, nginxSwap: false }
}

export interface NginxSwapResult {
  success: boolean
  activeBefore: 'blue' | 'green' | null
  activeAfter: 'blue' | 'green' | null
  error?: string
}

/**
 * nginx aktif slotunu değiştir — rollback.sh'ı YENİDEN KULLAN (yeni bash YOK).
 * rollback.sh bir toggle: aktif↔pasif geçirir. Geri almak için tekrar çağrılır.
 * Çıktı loglanır; CURRENT_ACTIVE gerçekten değişti mi doğrulanır.
 */
export async function runNginxSwap(): Promise<NginxSwapResult> {
  const activeBefore = readCurrentActive()
  try {
    const { stdout, stderr } = await execAsync(`bash ${ROLLBACK_SH}`, {
      timeout: 120_000,
      env: { ...process.env, SUDO_ASKPASS: process.env.SUDO_ASKPASS || '/tmp/askpass.sh' },
      maxBuffer: 10 * 1024 * 1024,
    })
    console.log(`[nginx-swap] rollback.sh çıktı:\n${stdout}${stderr ? '\n[stderr] ' + stderr : ''}`)
    const activeAfter = readCurrentActive()
    if (activeAfter && activeBefore && activeAfter !== activeBefore) {
      return { success: true, activeBefore, activeAfter }
    }
    return { success: false, activeBefore, activeAfter, error: `CURRENT_ACTIVE değişmedi (${activeBefore}→${activeAfter})` }
  } catch (err) {
    return { success: false, activeBefore, activeAfter: readCurrentActive(), error: (err as Error).message }
  }
}

/** Post-swap prod health — nginx üzerinden (rollback.sh'ın verify'ı ile aynı yöntem). */
export async function postSwapHealthCheck(maxAttempts = 15): Promise<{ healthy: boolean; attempts: number }> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { stdout } = await execAsync(
        `curl -sk "https://127.0.0.1/api/health" -H "Host: hub.ilerigroup.com" -o /dev/null -w "%{http_code}"`,
        { timeout: 5_000 }
      )
      if (stdout.trim() === '200') return { healthy: true, attempts: i }
    } catch {
      // henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  return { healthy: false, attempts: maxAttempts }
}
