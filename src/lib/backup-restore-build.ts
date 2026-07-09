// RESTORE-ORCHESTRATOR Faz 1.1 — PRE-BUILT SWAP.
// DRILL-4 dersi: build'i canlı dizinde SWAP'tan SONRA yapmak, cold+ağır build
// başarısız/yavaş olunca canlıyı yarım bırakıyordu. Artık build SWAP'tan ÖNCE,
// extract/staging dizininde koşar; canlı dizin YALNIZ known-good, doğrulanmış
// pre-built artifact ile takas edilir. Build fail → hiçbir swap başlamaz.
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import path from 'path'

// Warm build ölçümü (bu repo, cache'li): ~4-7dk. Gerçekçi timeout + 15dk üst sınır.
const HARD_CAP_MS = 15 * 60_000
const BUILD_TIMEOUT_MS = Math.min(
  Number(process.env.ILERIHUB_BUILD_TIMEOUT_MS) || 12 * 60_000,
  HARD_CAP_MS
)

export interface StagingBuildResult {
  success: boolean
  buildId?: string
  error?: string
  timedOut?: boolean
}

/**
 * Extract/staging dizinini build'e hazırla (canlı dizine DOKUNMADAN, yalnız okur):
 *  - node_modules: canlıdan SYMLINK (kopya DEĞİL). Gerekçe: node_modules GB'larca;
 *    kopya = dakikalar + disk. Restore genelde yakın snapshot → deps ~aynı. Build
 *    SWAP'tan ÖNCE olduğundan dep uyumsuzluğu GÜVENLİ fail eder (canlı el değmemiş).
 *    Symlink yalnız build süresince; swap öncesi kaldırılır (swap gerçek nm'yi
 *    PRESERVE'den koyar → build ile aynı node_modules canlıya gelir, tutarlı).
 *  - .env(.local): canlıdan KOPYA — next build NEXT_PUBLIC_* inline için okur.
 *  - .next/cache: canlıdan KOPYA (warm build) — cold derleme cezası kalkar; canlının
 *    cache'i el değmez (cp -a kopya).
 */
async function prepareStagingForBuild(stagingDir: string, liveDir: string): Promise<void> {
  const nm = path.join(stagingDir, 'node_modules')
  await fs.rm(nm, { recursive: true, force: true }).catch(() => {})
  await fs.symlink(path.join(liveDir, 'node_modules'), nm)

  for (const f of ['.env', '.env.local']) {
    const src = path.join(liveDir, f)
    if (existsSync(src)) await fs.copyFile(src, path.join(stagingDir, f)).catch(() => {})
  }

  const liveCache = path.join(liveDir, '.next', 'cache')
  if (existsSync(liveCache)) {
    await fs.mkdir(path.join(stagingDir, '.next'), { recursive: true }).catch(() => {})
    await new Promise<void>((resolve) => {
      const c = spawn('cp', ['-a', liveCache, path.join(stagingDir, '.next', 'cache')], {
        stdio: 'ignore',
      })
      c.on('exit', () => resolve())
      c.on('error', () => resolve())
    })
  }
}

/**
 * Build'i staging dizininde çalıştır. TIMEOUT'ta ÇOCUK DEĞİL PROCESS GROUP öldürülür
 * (detached → kendi group; kill(-pid) grandchild next-build dahil hepsini alır).
 * DRILL-4'te execAsync timeout grandchild'ı öldüremeyip asılı kalmıştı — bu onu çözer.
 */
function runBuildWithGroupKill(
  cwd: string,
  timeoutMs: number
): Promise<{ code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', 'build'], {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      detached: true, // kendi process group'u → grup kill mümkün
      stdio: 'ignore',
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL') // -pid = tüm grup
      } catch {
        /* zaten bitmiş */
      }
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ code, timedOut })
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ code: -1, timedOut })
    })
  })
}

/** Build artefaktını doğrula: BUILD_ID mevcut+dolu + .next iskeleti (bütünlük). */
async function verifyBuildArtifact(
  stagingDir: string
): Promise<{ ok: boolean; buildId?: string; error?: string }> {
  const nextDir = path.join(stagingDir, '.next')
  const buildIdPath = path.join(nextDir, 'BUILD_ID')
  if (!existsSync(buildIdPath)) return { ok: false, error: '.next/BUILD_ID yok' }
  const buildId = (await fs.readFile(buildIdPath, 'utf8')).trim()
  if (!buildId) return { ok: false, error: 'BUILD_ID boş' }
  for (const req of ['build-manifest.json', 'server']) {
    if (!existsSync(path.join(nextDir, req))) {
      return { ok: false, error: `.next/${req} yok — build eksik/bozuk` }
    }
  }
  return { ok: true, buildId }
}

/** Build scaffolding'i (node_modules SYMLINK) swap öncesi kaldır — gerçek dizini değil. */
export async function cleanupBuildScaffolding(stagingDir: string): Promise<void> {
  const nm = path.join(stagingDir, 'node_modules')
  const st = await fs.lstat(nm).catch(() => null)
  if (st?.isSymbolicLink()) await fs.rm(nm, { force: true }).catch(() => {})
}

/**
 * PRE-BUILT SWAP ana giriş: hazırla → build (grup-kill timeout) → doğrula →
 * scaffolding temizle. SWAP YAPMAZ (çağıran commit lib yalnız success ise swap eder).
 * Canlı dizine YAZMAZ (yalnız node_modules/env/cache okur/symlink'ler).
 */
export async function buildStagingArtifact(
  stagingDir: string,
  liveDir: string
): Promise<StagingBuildResult> {
  try {
    await prepareStagingForBuild(stagingDir, liveDir)
    const { code, timedOut } = await runBuildWithGroupKill(stagingDir, BUILD_TIMEOUT_MS)
    if (timedOut) {
      await cleanupBuildScaffolding(stagingDir)
      return {
        success: false,
        timedOut: true,
        error: `Build timeout (${BUILD_TIMEOUT_MS}ms) — process group öldürüldü`,
      }
    }
    if (code !== 0) {
      await cleanupBuildScaffolding(stagingDir)
      return { success: false, error: `Build başarısız (exit ${code})` }
    }
    const v = await verifyBuildArtifact(stagingDir)
    await cleanupBuildScaffolding(stagingDir)
    if (!v.ok) return { success: false, error: v.error }
    return { success: true, buildId: v.buildId }
  } catch (err) {
    await cleanupBuildScaffolding(stagingDir).catch(() => {})
    return { success: false, error: `Build hazırlık/çalıştırma hatası: ${(err as Error).message}` }
  }
}
