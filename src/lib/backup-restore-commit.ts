// RESTORE-ORCHESTRATOR Faz 1.1 — Restore COMMIT fazı (detached orchestrator'dan).
//
// DRILL-4 dersi → 4 düzeltme:
//  (1) PRE-BUILT SWAP: build SWAP'tan ÖNCE, staging extract dizininde koşar; canlı
//      dizin YALNIZ doğrulanmış pre-built artifact ile takas edilir. Build fail →
//      hiçbir swap başlamaz, canlı el değmemiş kalır.
//  (2) WARM BUILD: staging'e canlı .next/cache kopyalanır (backup-restore-build.ts).
//  (3) TIMEOUT PROCESS-GROUP KILL: build timeout'unda grup öldürülür (build lib).
//  (4) SELF-DEATH DAYANIKLILIĞI: her aşama öncesi diske CHECKPOINT yazılır;
//      recoverOrphanedRestores() başlangıçta yarım-kalmış işi rollback-first çözer.
//
// Akış: pre-restore backup → BUILD(staging) → doğrula → file swap → DB swap →
//        pm2 delete+start → health → başarısızlıkta rollback.
import { promises as fs } from 'fs'
import path from 'path'
import {
  swapFilesAtomic,
  swapDbAtomic,
  rollbackFiles,
  rollbackDb,
  resolveRestoreTarget,
} from './backup-restore-swap'
import { pm2DeleteStart, healthCheck } from './backup-restore-health'
import { buildStagingArtifact } from './backup-restore-build'
import { backupILERIHub, generateBackupName } from './backup-service'
import { prisma } from './prisma'
import { logAuditEvent } from './audit-log'
import { BackupStatus, BackupType } from '@/generated/prisma'

const JOBS_DIR = '/tmp/ilerihub-restore-jobs'

/** Faz 1.2: DB swap sonrası restore-job satırını canlı DB'ye UPSERT için gereken alanlar. */
export interface JobRow {
  backupName: string
  backupType: string // BackupType ('RESTORE') — JSON'dan string gelir, upsert'te cast edilir
  projectName: string
  filePath: string
  includeDatabase: boolean
  createdBy: string
  createdByName: string
}

export interface RestoreCommitParams {
  jobId: string
  sourceBackupId: string
  backupName: string
  projectName: string
  stagingDir: string
  testDbName: string | null
  liveDbName: string
  actorId: string
  /** DB swap sonrası satır canlı DB'de yok → jobId sabit upsert için satır verisi. */
  jobRow: JobRow
}

export interface RestoreCommitResult {
  ok: boolean
  stage: string
  error?: string
  rolledBack?: boolean
  preRestoreBackupName?: string | null
  preRestoreDir?: string | null
  oldDbName?: string | null
  buildId?: string
}

// Checkpoint aşamaları — swap'tan ÖNCE (canlı el değmemiş) / SONRA ayrımı recovery için.
type CheckpointStage =
  | 'PREPARING' // pre-restore backup (canlı el değmemiş)
  | 'BUILDING' // staging build (canlı el değmemiş)
  | 'SWAPPING_FILES' // file swap BAŞLADI (canlı değişiyor)
  | 'SWAPPING_DB' // db swap
  | 'RESTARTING' // pm2 restart + health
  | 'DONE'

interface Checkpoint {
  jobId: string
  sourceBackupId: string
  stage: CheckpointStage
  preRestoreDir: string | null
  oldDbName: string | null
  liveDbName: string
  actorId: string
  pid: number
  ts: number
}

function checkpointPath(jobId: string): string {
  return path.join(JOBS_DIR, `${jobId}.checkpoint.json`)
}

async function writeCheckpoint(cp: Checkpoint): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true }).catch(() => {})
  // Atomik yaz (tmp + rename) — yarım checkpoint okunmasın.
  const p = checkpointPath(cp.jobId)
  await fs.writeFile(p + '.tmp', JSON.stringify(cp), 'utf8')
  await fs.rename(p + '.tmp', p)
}

async function clearCheckpoint(jobId: string): Promise<void> {
  await fs.rm(checkpointPath(jobId), { force: true }).catch(() => {})
}

// Faz 1.2: jobRow verilirse UPSERT — DB swap sonrası satır canlı DB'de yoksa
// (jobId sabit) yeniden oluşturur → COMPLETED canlı DB'de görünür. Verilmezse
// (recovery: rollbackDb sonrası satır zaten canlıda) update yeterli.
async function setStatus(
  jobId: string,
  status: BackupStatus,
  note?: string,
  jobRow?: JobRow
): Promise<void> {
  if (jobRow) {
    await prisma.backupLog
      .upsert({
        where: { id: jobId },
        update: { status, ...(note ? { notes: note } : {}) },
        create: {
          id: jobId,
          status,
          notes: note ?? null,
          backupName: jobRow.backupName,
          backupType: jobRow.backupType as BackupType,
          projectName: jobRow.projectName,
          filePath: jobRow.filePath,
          includeDatabase: jobRow.includeDatabase,
          createdBy: jobRow.createdBy,
          createdByName: jobRow.createdByName,
        },
      })
      .catch(() => {})
  } else {
    await prisma.backupLog
      .update({ where: { id: jobId }, data: { status, ...(note ? { notes: note } : {}) } })
      .catch(() => {})
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * (4) SELF-DEATH RECOVERY — orchestrator başlangıcında (ve istenirse app-boot'ta)
 * çağrılır. Yarım-kalmış (pid ölü, DONE değil) restore checkpoint'lerini GÜVENLİ
 * tarafa çözer:
 *   - PREPARING/BUILDING (swap YOK → canlı el değmemiş): status FAILED + temizlik.
 *   - SWAPPING_* / RESTARTING (canlı değişmiş olabilir): ROLLBACK-FIRST (db+dosya
 *     geri al → pm2 delete+start → ROLLED_BACK). Daemon YOK; startup-recovery.
 * Not: yalnız pid'i ÖLÜ checkpoint'lere dokunur → canlı bir koşuyu bozmaz.
 */
export async function recoverOrphanedRestores(): Promise<
  Array<{ jobId: string; stage: string; action: string }>
> {
  const results: Array<{ jobId: string; stage: string; action: string }> = []
  let files: string[]
  try {
    files = (await fs.readdir(JOBS_DIR)).filter((f) => f.endsWith('.checkpoint.json'))
  } catch {
    return results
  }
  for (const f of files) {
    let cp: Checkpoint
    try {
      cp = JSON.parse(await fs.readFile(path.join(JOBS_DIR, f), 'utf8'))
    } catch {
      continue
    }
    if (cp.stage === 'DONE') {
      await clearCheckpoint(cp.jobId)
      continue
    }
    if (cp.pid === process.pid || pidAlive(cp.pid)) continue // aktif/kendi koşusu — dokunma

    const audit = (action: string, details: Record<string, unknown>) =>
      logAuditEvent({
        action,
        actorId: cp.actorId,
        targetType: 'BACKUP',
        targetId: cp.sourceBackupId,
        details,
      }).catch(() => {})

    if (cp.stage === 'PREPARING' || cp.stage === 'BUILDING') {
      // Swap yok → canlı el değmemiş; sadece işaretle + temizle.
      await setStatus(cp.jobId, BackupStatus.FAILED, `Yarım kaldı (${cp.stage}) — swap öncesi, canlı etkilenmedi`)
      await audit('BACKUP_RESTORE_RECOVERED', { jobId: cp.jobId, stage: cp.stage, action: 'no_swap_marked_failed' })
      await clearCheckpoint(cp.jobId)
      results.push({ jobId: cp.jobId, stage: cp.stage, action: 'no_swap_marked_failed' })
      continue
    }

    // SWAPPING_FILES / SWAPPING_DB / RESTARTING → ROLLBACK-FIRST
    let rolledBack = true
    if (cp.oldDbName) await rollbackDb(cp.oldDbName, cp.liveDbName).catch(() => { rolledBack = false })
    if (cp.preRestoreDir) await rollbackFiles(cp.preRestoreDir).catch(() => { rolledBack = false })
    await pm2DeleteStart().catch(() => {})
    await setStatus(cp.jobId, rolledBack ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED,
      `Yarım kaldı (${cp.stage}) — startup recovery rollback (rolledBack=${rolledBack})`)
    await audit('BACKUP_RESTORE_RECOVERED', { jobId: cp.jobId, stage: cp.stage, rolledBack })
    await clearCheckpoint(cp.jobId)
    results.push({ jobId: cp.jobId, stage: cp.stage, action: rolledBack ? 'rolled_back' : 'rollback_incomplete' })
  }
  return results
}

/** Restore commit — detached orchestrator'dan; app ölse de bağımsız tamamlanır. */
export async function runRestoreCommit(p: RestoreCommitParams): Promise<RestoreCommitResult> {
  const { jobId, sourceBackupId, backupName, projectName, stagingDir, testDbName, liveDbName, actorId, jobRow } = p
  const audit = (action: string, details: Record<string, unknown>) =>
    logAuditEvent({ action, actorId, targetType: 'BACKUP', targetId: sourceBackupId, details }).catch(() => {})
  // Faz 1.2: her status yazımı jobRow ile UPSERT — DB swap sonrası satır canlı DB'de
  // yeniden oluşur (COMPLETED görünür); swap öncesi satır varsa update branch'i çalışır.
  const st = (status: BackupStatus, note?: string) => setStatus(jobId, status, note, jobRow)

  const cpBase = { jobId, sourceBackupId, liveDbName, actorId, pid: process.pid }
  const cp = (stage: CheckpointStage, preRestoreDir: string | null, oldDbName: string | null) =>
    writeCheckpoint({ ...cpBase, stage, preRestoreDir, oldDbName, ts: Date.now() })

  let liveDir: string
  try {
    liveDir = resolveRestoreTarget()
  } catch (err) {
    await st(BackupStatus.FAILED, `Hedef dizin çözülemedi: ${(err as Error).message}`)
    return { ok: false, stage: 'resolve_target', error: (err as Error).message }
  }

  // 1. Pre-restore güvenlik yedeği (canlı el değmemiş)
  await cp('PREPARING', null, null)
  await st(BackupStatus.RESTORING, 'Pre-restore güvenlik yedeği alınıyor')
  let preRestoreBackupName: string | null = null
  let preRestoreFilePath: string | null = null
  if (projectName === 'ILERIHub' || projectName === 'All') {
    preRestoreBackupName = generateBackupName('ilerihub_prerestore')
    const r = await backupILERIHub(preRestoreBackupName)
    if (!r.success) {
      await st(BackupStatus.FAILED, `Pre-restore backup başarısız: ${r.error}`)
      await audit('BACKUP_RESTORE_FAILED', { stage: 'pre_restore_backup', error: r.error })
      await clearCheckpoint(jobId)
      return { ok: false, stage: 'pre_restore_backup', error: r.error }
    }
    preRestoreFilePath = r.filePath
    await audit('BACKUP_RESTORE_PRE_BACKUP', { preRestoreBackupName, preRestoreFilePath })
  }

  // 2. (1)(2)(3) BUILD — SWAP'tan ÖNCE, staging dizininde (warm + grup-kill timeout).
  //    Fail → HİÇBİR SWAP YOK, canlı el değmemiş.
  await cp('BUILDING', null, null)
  await st(BackupStatus.BUILDING, 'Restore edilen kod derleniyor (staging, swap öncesi)')
  const build = await buildStagingArtifact(stagingDir, liveDir)
  if (!build.success) {
    await st(BackupStatus.FAILED, `Build başarısız (swap yapılmadı, canlı el değmemiş): ${build.error}`)
    await audit('BACKUP_RESTORE_FAILED', { stage: 'build', error: build.error, timedOut: build.timedOut ?? false, swapped: false })
    await clearCheckpoint(jobId)
    return { ok: false, stage: 'build', error: build.error }
  }
  await audit('BACKUP_RESTORE_BUILT', { buildId: build.buildId })

  // 3. File swap — staging (pre-built + doğrulanmış) → canlı. BURADAN İTİBAREN canlı değişiyor.
  await cp('SWAPPING_FILES', null, null)
  await st(BackupStatus.SWAPPING, 'Dosyalar değiştiriliyor (pre-built artifact)')
  const filesSwap = await swapFilesAtomic(stagingDir, { backupId: sourceBackupId })
  if (!filesSwap.success) {
    // swapFilesAtomic başarısızlıkta kendi içinde rollback dener; canlı korunur.
    await st(BackupStatus.FAILED, `Dosya swap başarısız: ${filesSwap.errors.join('; ')}`)
    await audit('BACKUP_RESTORE_FAILED', { stage: 'files_swap', errors: filesSwap.errors })
    await clearCheckpoint(jobId)
    return { ok: false, stage: 'files_swap', error: filesSwap.errors.join('; '), preRestoreBackupName }
  }
  await cp('SWAPPING_FILES', filesSwap.preRestoreDir, null)

  const rollback = async (reason: string, oldDbName: string | null): Promise<boolean> => {
    let rolledBack = true
    if (oldDbName) await rollbackDb(oldDbName, liveDbName).catch(() => { rolledBack = false })
    await rollbackFiles(filesSwap.preRestoreDir).catch(() => { rolledBack = false })
    await pm2DeleteStart().catch(() => {})
    await audit('BACKUP_RESTORE_ROLLBACK_TRIGGERED', { reason, rolledBack })
    return rolledBack
  }

  // 4. DB swap
  await cp('SWAPPING_DB', filesSwap.preRestoreDir, null)
  await st(BackupStatus.SWAPPING, 'Veritabanı değiştiriliyor')
  let oldDbName: string | null = null
  if (testDbName) {
    const dbSwap = await swapDbAtomic(testDbName, liveDbName)
    if (!dbSwap.success) {
      const rb = await rollback('db_swap_failed', null)
      await st(rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `DB swap başarısız: ${dbSwap.errors.join('; ')}`)
      await clearCheckpoint(jobId)
      return { ok: false, stage: 'db_swap', error: dbSwap.errors.join('; '), rolledBack: rb, preRestoreBackupName }
    }
    oldDbName = dbSwap.oldDbName
  }
  await cp('RESTARTING', filesSwap.preRestoreDir, oldDbName)
  await audit('BACKUP_RESTORE_SWAPPED', { preRestoreDir: filesSwap.preRestoreDir, oldDbName, buildId: build.buildId })

  // 5. PM2 delete+start
  await st(BackupStatus.SWAPPING, 'Uygulama yeniden başlatılıyor')
  const pm2 = await pm2DeleteStart()
  if (!pm2.success) {
    const rb = await rollback('pm2_restart_failed', oldDbName)
    await st(rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `PM2 restart başarısız: ${pm2.error}`)
    await clearCheckpoint(jobId)
    return { ok: false, stage: 'pm2_restart', error: pm2.error, rolledBack: rb, preRestoreBackupName }
  }

  // 6. Health check
  const health = await healthCheck(pm2.port ?? 3000, 30)
  if (!health.healthy) {
    const rb = await rollback('health_check_failed', oldDbName)
    await st(rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `Health check başarısız (${health.attempts} deneme)`)
    await clearCheckpoint(jobId)
    return { ok: false, stage: 'health_check', rolledBack: rb, preRestoreBackupName }
  }

  // 7. COMPLETED
  await cp('DONE', filesSwap.preRestoreDir, oldDbName)
  await st(BackupStatus.COMPLETED, `Restore tamam (build ${build.buildId}, ${health.attempts} health denemesi)`)
  await audit('BACKUP_RESTORE_COMPLETED', {
    backupName,
    preRestoreBackupName,
    preRestoreFilePath,
    preRestoreDir: filesSwap.preRestoreDir,
    oldDbName,
    buildId: build.buildId,
    healthCheckAttempts: health.attempts,
  })
  await clearCheckpoint(jobId)
  return {
    ok: true,
    stage: 'completed',
    preRestoreBackupName,
    preRestoreDir: filesSwap.preRestoreDir,
    oldDbName,
    buildId: build.buildId,
  }
}
