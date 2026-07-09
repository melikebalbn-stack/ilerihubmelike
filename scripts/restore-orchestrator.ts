#!/usr/bin/env tsx
/**
 * RESTORE-ORCHESTRATOR (Faz 1 + Faz 1.1): Detached restore COMMIT runner.
 *
 * route.ts HAZIRLIK fazından (validate + extract + schema) sonra bu script'i
 * DETACHED (setsid/unref) spawn edip "started" döner. App process'i ölse bile
 * bağımsız tamamlanır: pre-restore backup → BUILD(staging, swap öncesi) → file
 * swap → db swap → pm2 delete+start → health → başarısızlıkta rollback. Her aşama
 * öncesi diske checkpoint yazılır. Durum BackupLog'a yazılır (UI 10sn polling).
 *
 * Faz 1.1 (4): BAŞLANGIÇTA recoverOrphanedRestores() — önceki koşu yarım kalmışsa
 * (pid ölü, DONE değil) rollback-first ile güvenli tarafa çözer (daemon YOK).
 *
 * Kullanım (route spawn eder; elle de çalışır):
 *   node_modules/.bin/tsx scripts/restore-orchestrator.ts <params.json>
 * params.json ⇒ RestoreCommitParams
 */
import { promises as fs } from 'fs'
import {
  runRestoreCommit,
  recoverOrphanedRestores,
  type RestoreCommitParams,
} from '../src/lib/backup-restore-commit'

async function main(): Promise<void> {
  const paramsPath = process.argv[2]
  if (!paramsPath) {
    console.error('Kullanım: tsx scripts/restore-orchestrator.ts <params.json>')
    process.exit(1)
  }

  // (4) SELF-DEATH RECOVERY — kendi işimizden ÖNCE yarım-kalmış orphan'ları çöz.
  const recovered = await recoverOrphanedRestores().catch(() => [])
  if (recovered.length) {
    console.log(`[orchestrator] startup-recovery: ${JSON.stringify(recovered)}`)
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
