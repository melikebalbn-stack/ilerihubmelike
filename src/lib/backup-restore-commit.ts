// RESTORE-ORCHESTRATOR (Faz 1): Restore COMMIT fazı — çalışan process'ten
// AYRI (detached) çalışması için lib'e taşındı. route.ts yalnız HAZIRLIK
// (validate + extract + schema) yapıp bu commit'i detached bir tsx script
// (scripts/restore-orchestrator.ts) üzerinden spawn eder. Böylece app ölse bile
// (in-place restore'da file swap çalışan process'i düşürür) commit + rollback
// TAMAMLANIR ve durum BackupLog'a yazılır (DRILL-3 kök sebep fix'i).
//
// Akış: pre-restore backup → file swap → BUILD → DB swap → pm2 delete+start →
//        health → başarısızlıkta rollback. Her aşamada BackupLog.status + audit.
import {
  swapFilesAtomic,
  swapDbAtomic,
  rollbackFiles,
  rollbackDb,
} from './backup-restore-swap'
import { buildTarget, pm2DeleteStart, healthCheck } from './backup-restore-health'
import { backupILERIHub, generateBackupName } from './backup-service'
import { prisma } from './prisma'
import { logAuditEvent } from './audit-log'
import { BackupStatus } from '@/generated/prisma'

export interface RestoreCommitParams {
  /** Restore-job BackupLog satırı id'si — ilerleme durumu buraya yazılır. */
  jobId: string
  /** Kaynak yedeğin BackupLog id'si — audit targetId. */
  sourceBackupId: string
  backupName: string
  /** 'ILERIHub' | 'All' → pre-restore güvenlik yedeği alınır. */
  projectName: string
  /** extractToStaging çıktısı (açılmış içerik + test DB dump). */
  stagingDir: string
  /** DB içeren yedeklerde test DB adı; yoksa null (yalnız dosya restore). */
  testDbName: string | null
  /** Canlı DB adı (DATABASE_URL'den) — swap hedefi. */
  liveDbName: string
  /** İşlemi başlatan kullanıcı (audit). */
  actorId: string
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

/** Restore-job satırının durumunu güncelle (best-effort; migration bekliyorsa yutulur). */
async function setStatus(jobId: string, status: BackupStatus, note?: string): Promise<void> {
  await prisma.backupLog
    .update({
      where: { id: jobId },
      data: { status, ...(note ? { notes: note } : {}) },
    })
    .catch(() => {})
}

/**
 * Restore commit fazını uçtan uca çalıştırır. Detached orchestrator'dan çağrılır;
 * çağıran process (Next.js app) ölse bile bu fonksiyon bağımsız tamamlanır.
 */
export async function runRestoreCommit(p: RestoreCommitParams): Promise<RestoreCommitResult> {
  const { jobId, sourceBackupId, backupName, projectName, stagingDir, testDbName, liveDbName, actorId } = p
  const audit = (action: string, details: Record<string, unknown>) =>
    logAuditEvent({ action, actorId, targetType: 'BACKUP', targetId: sourceBackupId, details }).catch(() => {})

  // 1. Pre-restore güvenlik yedeği (rollback dışı ikinci ağ; canlı state snapshot)
  await setStatus(jobId, BackupStatus.RESTORING, 'Pre-restore güvenlik yedeği alınıyor')
  let preRestoreBackupName: string | null = null
  let preRestoreFilePath: string | null = null
  if (projectName === 'ILERIHub' || projectName === 'All') {
    preRestoreBackupName = generateBackupName('ilerihub_prerestore')
    const r = await backupILERIHub(preRestoreBackupName)
    if (!r.success) {
      await setStatus(jobId, BackupStatus.FAILED, `Pre-restore backup başarısız: ${r.error}`)
      await audit('BACKUP_RESTORE_FAILED', { stage: 'pre_restore_backup', error: r.error })
      return { ok: false, stage: 'pre_restore_backup', error: r.error }
    }
    preRestoreFilePath = r.filePath
    await audit('BACKUP_RESTORE_PRE_BACKUP', { preRestoreBackupName, preRestoreFilePath })
  }

  // 2. Dosya swap (staging içeriği → canlı dizin; orijinal → pre-restore-backups)
  await setStatus(jobId, BackupStatus.SWAPPING, 'Dosyalar değiştiriliyor')
  const filesSwap = await swapFilesAtomic(stagingDir, { backupId: sourceBackupId })
  if (!filesSwap.success) {
    await setStatus(jobId, BackupStatus.FAILED, `Dosya swap başarısız: ${filesSwap.errors.join('; ')}`)
    await audit('BACKUP_RESTORE_FAILED', { stage: 'files_swap', errors: filesSwap.errors })
    return { ok: false, stage: 'files_swap', error: filesSwap.errors.join('; '), preRestoreBackupName }
  }

  // Ortak rollback: (varsa DB) + dosyalar → pm2 delete+start. rolledBack=false ⇒ manuel müdahale.
  const rollback = async (reason: string, oldDbName: string | null): Promise<boolean> => {
    let rolledBack = true
    if (oldDbName) await rollbackDb(oldDbName, liveDbName).catch(() => { rolledBack = false })
    await rollbackFiles(filesSwap.preRestoreDir).catch(() => { rolledBack = false })
    await pm2DeleteStart().catch(() => {})
    await audit('BACKUP_RESTORE_ROLLBACK_TRIGGERED', { reason, rolledBack })
    return rolledBack
  }

  // 3. BUILD — restore edilen kod KENDİ .next'ini üretir (PRESERVE artık .next taşımıyor)
  await setStatus(jobId, BackupStatus.BUILDING, 'Restore edilen kod derleniyor (build)')
  const build = await buildTarget()
  if (!build.success) {
    // DB henüz swap edilmedi → yalnız dosya rollback
    const rb = await rollback('build_failed', null)
    await setStatus(jobId, rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `Build başarısız: ${build.error}`)
    return { ok: false, stage: 'build', error: build.error, rolledBack: rb, preRestoreBackupName }
  }

  // 4. DB swap (test DB → canlı DB; eski canlı → *_pre_restore_<ts>)
  await setStatus(jobId, BackupStatus.SWAPPING, 'Veritabanı değiştiriliyor')
  let oldDbName: string | null = null
  if (testDbName) {
    const dbSwap = await swapDbAtomic(testDbName, liveDbName)
    if (!dbSwap.success) {
      const rb = await rollback('db_swap_failed', null)
      await setStatus(jobId, rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `DB swap başarısız: ${dbSwap.errors.join('; ')}`)
      return { ok: false, stage: 'db_swap', error: dbSwap.errors.join('; '), rolledBack: rb, preRestoreBackupName }
    }
    oldDbName = dbSwap.oldDbName
  }
  await audit('BACKUP_RESTORE_SWAPPED', { preRestoreDir: filesSwap.preRestoreDir, oldDbName, buildId: build.buildId })

  // 5. PM2 delete+start (temiz env — DRILL-3 update-env köşe durumu dersi)
  await setStatus(jobId, BackupStatus.SWAPPING, 'Uygulama yeniden başlatılıyor')
  const pm2 = await pm2DeleteStart()
  if (!pm2.success) {
    const rb = await rollback('pm2_restart_failed', oldDbName)
    await setStatus(jobId, rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `PM2 restart başarısız: ${pm2.error}`)
    return { ok: false, stage: 'pm2_restart', error: pm2.error, rolledBack: rb, preRestoreBackupName }
  }

  // 6. Health check (türetilen slot portunda)
  const health = await healthCheck(pm2.port ?? 3000, 30)
  if (!health.healthy) {
    const rb = await rollback('health_check_failed', oldDbName)
    await setStatus(jobId, rb ? BackupStatus.ROLLED_BACK : BackupStatus.FAILED, `Health check başarısız (${health.attempts} deneme)`)
    return { ok: false, stage: 'health_check', rolledBack: rb, preRestoreBackupName }
  }

  // 7. COMPLETED
  await setStatus(jobId, BackupStatus.COMPLETED, `Restore tamam (build ${build.buildId}, ${health.attempts} health denemesi)`)
  await audit('BACKUP_RESTORE_COMPLETED', {
    backupName,
    preRestoreBackupName,
    preRestoreFilePath,
    preRestoreDir: filesSwap.preRestoreDir,
    oldDbName,
    buildId: build.buildId,
    healthCheckAttempts: health.attempts,
  })
  return {
    ok: true,
    stage: 'completed',
    preRestoreBackupName,
    preRestoreDir: filesSwap.preRestoreDir,
    oldDbName,
    buildId: build.buildId,
  }
}
