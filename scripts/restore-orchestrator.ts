#!/usr/bin/env tsx
/**
 * RESTORE-ORCHESTRATOR (Faz 1): Detached restore COMMIT runner.
 *
 * route.ts HAZIRLIK fazından (validate + extract + schema) sonra bu script'i
 * DETACHED (setsid/unref) spawn edip "started" döner. Bu script çağıran app
 * process'i ölse bile (in-place restore'da file swap çalışan process'i düşürür)
 * bağımsız tamamlanır: pre-restore backup → file swap → build → db swap →
 * pm2 delete+start → health → başarısızlıkta rollback. Durum BackupLog'a yazılır,
 * UI mevcut 10sn polling ile okur. (DRILL-3 kök sebep fix'i.)
 *
 * Kullanım (route spawn eder; elle de çalışır):
 *   node_modules/.bin/tsx scripts/restore-orchestrator.ts <params.json>
 * params.json ⇒ RestoreCommitParams
 */
import { promises as fs } from 'fs'
import { runRestoreCommit, type RestoreCommitParams } from '../src/lib/backup-restore-commit'

async function main(): Promise<void> {
  const paramsPath = process.argv[2]
  if (!paramsPath) {
    console.error('Kullanım: tsx scripts/restore-orchestrator.ts <params.json>')
    process.exit(1)
  }

  const raw = await fs.readFile(paramsPath, 'utf8')
  const params = JSON.parse(raw) as RestoreCommitParams
  const t0 = new Date().toISOString()
  console.log(`[orchestrator] başladı jobId=${params.jobId} backup=${params.backupName} @ ${t0}`)

  const result = await runRestoreCommit(params)

  console.log(`[orchestrator] bitti @ ${new Date().toISOString()}: ${JSON.stringify(result)}`)
  // Params dosyasını temizle (idempotent).
  await fs.rm(paramsPath, { force: true }).catch(() => {})
  process.exit(result.ok ? 0 : 1)
}

main().catch((err) => {
  console.error('[orchestrator] beklenmedik hata:', err)
  process.exit(1)
})
