// PR-RESTORE-3: Restore endpoint atomic swap + rollback
//
// Akış:
//   1. Kill switch (ENABLE_BACKUP_RESTORE)
//   2. Auth + admin.backup.manage permission
//   3. BackupLog kayıt + dosya kontrolü
//   4. validateBackup gate (PR-RESTORE-1)
//   5. extractToStaging + checkSchemaCompatibility (PR-RESTORE-2)
//   6. ?dryRun=true → buradan dön (atomic swap atlanır)
//   7. Pre-restore safety backup
//   8. swapFilesAtomic → swapDbAtomic
//   9. pm2 restart → healthCheck
//  10. Hata her aşamada otomatik rollback + audit log
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import { validateBackup } from '@/lib/backup-validation'
import {
  extractToStaging,
  cleanupStaging,
  checkSchemaCompatibility,
} from '@/lib/backup-restore-staging'
import {
  swapFilesAtomic,
  swapDbAtomic,
  rollbackFiles,
  rollbackDb,
  describeRestoreTarget,
} from '@/lib/backup-restore-swap'
import { pm2RestartIlerihub, healthCheck } from '@/lib/backup-restore-health'
import { backupILERIHub, generateBackupName } from '@/lib/backup-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Kill switch — auth'tan ÖNCE (info disclosure önle)
  if (process.env.ENABLE_BACKUP_RESTORE !== 'true') {
    const { id: blockedId } = await params
    console.warn(
      `[backup-restore] Blocked by kill switch. ` +
        `backupId=${blockedId}, ip=${request.headers.get('x-forwarded-for') ?? 'n/a'}`
    )
    return NextResponse.json(
      {
        error: 'Restore is disabled',
        message: 'Backup restore is currently disabled by operations policy.',
      },
      { status: 503 }
    )
  }

  const { id } = await params
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'

  // 2. Auth + permission
  const { session, user, error: authError } = await requireUser()
  if (authError) return authError
  if (!session.user.permissions?.includes('admin.backup.manage')) {
    return NextResponse.json(
      { error: 'Restore işlemi sadece SUPER_ADMIN yetkisi gerektirir' },
      { status: 403 }
    )
  }

  // 3. Real restore safety: confirmRestore body field zorunlu
  if (!dryRun) {
    let body: { confirmRestore?: boolean }
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    if (!body.confirmRestore) {
      return NextResponse.json(
        {
          error: 'Geri yükleme onayı gerekiyor',
          message:
            'Bu işlem mevcut verilerin üzerine yazacaktır. Devam etmek için confirmRestore: true gönderin (veya ?dryRun=true ile test edin).',
        },
        { status: 400 }
      )
    }
  }

  // 4. BackupLog kayıt + dosya kontrolü
  const backup = await prisma.backupLog.findUnique({ where: { id } })
  if (!backup) {
    return NextResponse.json({ error: 'Yedek bulunamadı' }, { status: 404 })
  }
  if (backup.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Sadece tamamlanmış yedekler geri yüklenebilir' },
      { status: 400 }
    )
  }
  if (!backup.filePath || !fs.existsSync(backup.filePath)) {
    return NextResponse.json({ error: 'Yedek dosyası bulunamadı' }, { status: 404 })
  }

  // AUDIT: STARTED — PR-RESTORE-PARAM: "neyi hedefledi" kanıtı (hedef dizin +
  // hedef DB host/adı). Tatbikatta hangi ortama restore edildiği okunabilir.
  const restoreTarget = describeRestoreTarget()
  await logAuditEvent({
    action: dryRun ? 'BACKUP_RESTORE_DRY_RUN_STARTED' : 'BACKUP_RESTORE_STARTED',
    actorId: user.id,
    targetType: 'BACKUP',
    targetId: id,
    details: {
      actorEmail: user.email,
      backupName: backup.backupName,
      projectName: backup.projectName,
      dryRun,
      restoreTargetDir: restoreTarget.targetDir,
      restoreDbHost: restoreTarget.dbHost,
      restoreDbName: restoreTarget.dbName,
    },
  })

  // 5. Validation gate (PR-RESTORE-1)
  const validation = await validateBackup(backup.filePath)
  if (!validation.valid) {
    await logAuditEvent({
      action: 'BACKUP_RESTORE_FAILED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { stage: 'validation', errors: validation.errors },
    })
    return NextResponse.json(
      { error: 'Validation failed', details: validation.errors },
      { status: 400 }
    )
  }

  // 6. Staging extract (PR-RESTORE-2)
  const staging = await extractToStaging(backup.filePath, { backupId: id })
  if (!staging.success) {
    await logAuditEvent({
      action: 'BACKUP_RESTORE_FAILED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { stage: 'staging', errors: staging.errors },
    })
    return NextResponse.json(
      { error: 'Staging failed', details: staging.errors },
      { status: 500 }
    )
  }

  // 7. Schema compatibility (DB içeren backup'lar için)
  let schemaCheck = null
  if (staging.staging?.testDbName) {
    schemaCheck = await checkSchemaCompatibility(staging.staging.testDbName)
    if (!schemaCheck.compatible) {
      await cleanupStaging(staging.staging.stagingDir, staging.staging.testDbName)
      await logAuditEvent({
        action: 'BACKUP_RESTORE_FAILED',
        actorId: user.id,
        targetType: 'BACKUP',
        targetId: id,
        details: {
          stage: 'schema_check',
          criticalMissing: schemaCheck.criticalMissing,
          missingInTest: schemaCheck.missingInTest,
        },
      })
      return NextResponse.json(
        {
          error: 'Schema incompatible — kritik tablolar backup\'ta yok',
          details: schemaCheck,
        },
        { status: 409 }
      )
    }
  }

  // ============ DRY RUN: BURADAN DÖN ============
  if (dryRun) {
    await cleanupStaging(staging.staging!.stagingDir, staging.staging!.testDbName)
    await logAuditEvent({
      action: 'BACKUP_RESTORE_DRY_RUN_COMPLETED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: {
        stagingDurationMs: staging.staging?.durationMs,
        testDbTableCount: staging.staging?.testDbTableCount,
        criticalTables: staging.staging?.testDbCriticalTables,
        schemaCheck,
      },
    })
    return NextResponse.json({
      ok: true,
      dryRun: true,
      validation: {
        valid: validation.valid,
        sizeBytes: validation.sizeBytes,
        sha256: validation.sha256,
        warnings: validation.warnings,
      },
      staging: staging.staging,
      schemaCheck,
    })
  }

  // ============ GERÇEK RESTORE ============
  // 8. Pre-restore safety backup (canlı state'i yedekle, rollback için)
  let preRestoreBackupName: string | null = null
  let preRestoreFilePath: string | null = null
  if (backup.projectName === 'ILERIHub' || backup.projectName === 'All') {
    preRestoreBackupName = generateBackupName('ilerihub_prerestore')
    const result = await backupILERIHub(preRestoreBackupName)
    if (!result.success) {
      await cleanupStaging(staging.staging!.stagingDir, staging.staging!.testDbName)
      await logAuditEvent({
        action: 'BACKUP_RESTORE_FAILED',
        actorId: user.id,
        targetType: 'BACKUP',
        targetId: id,
        details: { stage: 'pre_restore_backup', error: result.error },
      })
      return NextResponse.json(
        { error: 'Pre-restore backup failed', details: result.error },
        { status: 500 }
      )
    }
    preRestoreFilePath = result.filePath
    await logAuditEvent({
      action: 'BACKUP_RESTORE_PRE_BACKUP',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { preRestoreBackupName, preRestoreFilePath },
    })
  }

  // 9. Atomic swap (dosyalar)
  const filesSwap = await swapFilesAtomic(staging.staging!.stagingDir, { backupId: id })
  if (!filesSwap.success) {
    await cleanupStaging(staging.staging!.stagingDir, staging.staging!.testDbName)
    await logAuditEvent({
      action: 'BACKUP_RESTORE_FAILED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { stage: 'files_swap', errors: filesSwap.errors },
    })
    return NextResponse.json(
      { error: 'Files swap failed', details: filesSwap.errors },
      { status: 500 }
    )
  }

  // 10. Atomic swap (DB) — staging test DB → live DB
  const liveDbName = process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'ilerihub'
  let dbSwap: Awaited<ReturnType<typeof swapDbAtomic>> | null = null
  if (staging.staging?.testDbName) {
    dbSwap = await swapDbAtomic(staging.staging.testDbName, liveDbName)
    if (!dbSwap.success) {
      // FELAKET: dosyalar swap edildi, DB swap başarısız → rollback dosyalar
      await rollbackFiles(filesSwap.preRestoreDir).catch(() => {})
      await logAuditEvent({
        action: 'BACKUP_RESTORE_ROLLBACK_TRIGGERED',
        actorId: user.id,
        targetType: 'BACKUP',
        targetId: id,
        details: { reason: 'db_swap_failed', errors: dbSwap.errors },
      })
      return NextResponse.json(
        { error: 'DB swap failed, files rolled back', details: dbSwap.errors },
        { status: 500 }
      )
    }
  }

  await logAuditEvent({
    action: 'BACKUP_RESTORE_SWAPPED',
    actorId: user.id,
    targetType: 'BACKUP',
    targetId: id,
    details: {
      filesSwap: { preRestoreDir: filesSwap.preRestoreDir },
      dbSwap: dbSwap ? { oldDbName: dbSwap.oldDbName } : null,
    },
  })

  // 11. PM2 restart
  const pm2 = await pm2RestartIlerihub()
  if (!pm2.success) {
    if (dbSwap) await rollbackDb(dbSwap.oldDbName, liveDbName).catch(() => {})
    await rollbackFiles(filesSwap.preRestoreDir).catch(() => {})
    await pm2RestartIlerihub().catch(() => {})
    await logAuditEvent({
      action: 'BACKUP_RESTORE_ROLLBACK_TRIGGERED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { reason: 'pm2_restart_failed', error: pm2.error },
    })
    return NextResponse.json(
      { error: 'PM2 restart failed, rolled back', details: pm2.error },
      { status: 500 }
    )
  }

  // 12. Health check (max 30sn)
  const health = await healthCheck(30)
  if (!health.healthy) {
    if (dbSwap) await rollbackDb(dbSwap.oldDbName, liveDbName).catch(() => {})
    await rollbackFiles(filesSwap.preRestoreDir).catch(() => {})
    await pm2RestartIlerihub().catch(() => {})
    await logAuditEvent({
      action: 'BACKUP_RESTORE_ROLLBACK_TRIGGERED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { reason: 'health_check_failed', attempts: health.attempts },
    })
    return NextResponse.json(
      { error: 'Health check failed, rolled back' },
      { status: 500 }
    )
  }

  // 13. COMPLETED
  await logAuditEvent({
    action: 'BACKUP_RESTORE_COMPLETED',
    actorId: user.id,
    targetType: 'BACKUP',
    targetId: id,
    details: {
      backupName: backup.backupName,
      preRestoreBackupName,
      preRestoreFilePath,
      preRestoreDir: filesSwap.preRestoreDir,
      oldDbName: dbSwap?.oldDbName ?? null,
      healthCheckAttempts: health.attempts,
    },
  })

  return NextResponse.json({
    ok: true,
    message: 'Restore completed successfully',
    preRestoreBackup: preRestoreBackupName,
    preRestoreDir: filesSwap.preRestoreDir,
    oldDbPreserved: dbSwap?.oldDbName ?? null,
    healthCheckAttempts: health.attempts,
  })
}
