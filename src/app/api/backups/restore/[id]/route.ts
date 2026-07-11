// PR-RESTORE-3 + RESTORE-ORCHESTRATOR (Faz 1): Restore endpoint.
//
// Route = YALNIZ HAZIRLIK (senkron, çökme-dışı):
//   1. Kill switch (ENABLE_BACKUP_RESTORE)
//   2. Auth + admin.backup.manage permission
//   3. BackupLog kayıt + dosya kontrolü
//   4. validateBackup gate (PR-RESTORE-1)
//   5. extractToStaging + checkSchemaCompatibility (PR-RESTORE-2)
//   6. ?dryRun=true → buradan dön (commit atlanır)
//   7. restore-job satırı aç → DETACHED orchestrator spawn → "started" dön.
//
// COMMIT fazı (pre-restore backup → file swap → BUILD → db swap → pm2 delete+start
// → health → rollback) DETACHED çalışır: scripts/restore-orchestrator.ts →
// src/lib/backup-restore-commit.ts. DRILL-3 dersi: in-place file swap çalışan
// process'i düşürüyor; detached orchestrator app ölse bile commit+rollback'i
// tamamlar ve durumu BackupLog.status'a yazar (UI 10sn polling ile okur).
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import { validateBackup } from '@/lib/backup-validation'
import {
  extractToStaging,
  cleanupStaging,
  checkSchemaCompatibility,
} from '@/lib/backup-restore-staging'
// RESTORE-ORCHESTRATOR (Faz 1): commit fazı (swap/build/db/restart/health/rollback)
// artık route'ta DEĞİL — detached scripts/restore-orchestrator.ts +
// src/lib/backup-restore-commit.ts. Route yalnız HAZIRLIK yapar; buradan sadece
// hedef-kanıt helper'ları (describeRestoreTarget / resolveRestorePm2) gerekir.
import { describeRestoreTarget } from '@/lib/backup-restore-swap'
import { resolveRestorePm2 } from '@/lib/backup-restore-health'
import { resolveRestoreModeInfo } from '@/lib/backup-restore-mode'
import { BackupStatus, BackupType } from '@/generated/prisma'

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
  // RESTORE-PARAM-2: hedef PM2 process adını da kanıt setine yaz (türetme
  // başarısızsa sebebi görünür olsun; restore ilerideki adımda zaten reddedilir).
  let restorePm2Name: string
  try {
    restorePm2Name = (await resolveRestorePm2()).name
  } catch (err) {
    restorePm2Name = `ÇÖZÜLEMEDİ (${(err as Error).message})`
  }
  // Faz 2: mode + gerçek hedef (in-place: cwd | passive-slot: pasif slot). Guard hatası
  // burada da görünür (ör. çalışan slot CURRENT_ACTIVE ile uyuşmuyor).
  let restoreModeInfo: string
  try {
    const mi = resolveRestoreModeInfo()
    restoreModeInfo = `${mi.mode} → ${mi.targetDir}${mi.nginxSwap ? ` (aktif=${mi.activeColor}→pasif=${mi.passiveColor}, nginx swap)` : ''}`
  } catch (err) {
    restoreModeInfo = `ÇÖZÜLEMEDİ/REDDEDİLDİ (${(err as Error).message})`
  }
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
      restorePm2Name,
      restoreMode: restoreModeInfo,
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

  // ============ GERÇEK RESTORE — DETACHED ORCHESTRATOR'A DEVİR ============
  // RESTORE-ORCHESTRATOR (Faz 1): commit fazı (pre-restore backup → file swap →
  // BUILD → db swap → pm2 delete+start → health → rollback) ARTIK bu request
  // handler'da DEĞİL. In-place restore'da file swap çalışan process'i düşürdüğü
  // için (DRILL-3), commit'i DETACHED bir tsx orchestrator'a devrediyoruz: app
  // ölse bile bağımsız tamamlanır + rollback eder + durumu BackupLog'a yazar.
  // Route yalnız restore-job satırı açar, orchestrator'ı spawn eder, "started" döner.

  const liveDbName =
    process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'ilerihub'

  // tsx runner önkoşulu — yoksa hiç swap yapmadan reddet (yarım state olmaz).
  const tsxBin = path.join(process.cwd(), 'node_modules/.bin/tsx')
  if (!fs.existsSync(tsxBin)) {
    await logAuditEvent({
      action: 'BACKUP_RESTORE_FAILED',
      actorId: user.id,
      targetType: 'BACKUP',
      targetId: id,
      details: { stage: 'dispatch', error: 'tsx runner bulunamadı (node_modules/.bin/tsx)' },
    })
    await cleanupStaging(staging.staging!.stagingDir, staging.staging!.testDbName)
    return NextResponse.json(
      { error: 'Restore orchestrator runner (tsx) bulunamadı' },
      { status: 500 }
    )
  }

  // Restore-job satırı: UI'ın izleyeceği ilerleme taşıyıcısı. KAYNAK yedek satırı
  // DOKUNULMAZ; orchestrator yalnız bu satırın status'unu günceller.
  const job = await prisma.backupLog.create({
    data: {
      backupName: `restore_${backup.backupName}`,
      backupType: BackupType.RESTORE,
      projectName: backup.projectName,
      filePath: backup.filePath,
      fileSize: backup.fileSize,
      includeDatabase: !!staging.staging?.testDbName,
      status: BackupStatus.RESTORING,
      createdBy: user.id,
      createdByName: user.email ?? 'system',
      notes: `Kaynak yedek: ${backup.backupName} (id=${id}) — orchestrator başlatılıyor`,
    },
  })

  // Orchestrator parametreleri (temp JSON — spawn'a yol olarak geçilir).
  const jobsDir = '/tmp/ilerihub-restore-jobs'
  await fs.promises.mkdir(jobsDir, { recursive: true })
  const paramsPath = path.join(jobsDir, `${job.id}.json`)
  await fs.promises.writeFile(
    paramsPath,
    JSON.stringify({
      jobId: job.id,
      sourceBackupId: id,
      backupName: backup.backupName,
      projectName: backup.projectName,
      stagingDir: staging.staging!.stagingDir,
      testDbName: staging.staging?.testDbName ?? null,
      liveDbName,
      actorId: user.id,
      // Faz 1.2 (iş-kaydı görünürlüğü): DB swap sonrası restore-job satırı canlı
      // (restore edilen) DB'de bulunmaz; orchestrator bu alanlarla satırı jobId
      // sabit UPSERT eder → COMPLETED canlı DB'de görünür.
      jobRow: {
        backupName: `restore_${backup.backupName}`,
        backupType: BackupType.RESTORE,
        projectName: backup.projectName,
        filePath: backup.filePath,
        includeDatabase: !!staging.staging?.testDbName,
        createdBy: user.id,
        createdByName: user.email ?? 'system',
      },
    }),
    'utf8'
  )

  // Faz 1.2 REPARENT: orchestrator'ı `setsid --fork` ile başlat. setsid --fork
  // fork eder ve setsid ANA process'i hemen çıkar → orchestrator init'e (ppid=1)
  // reparent olur, app'in process-tree'sinden ÇIKAR. Böylece orchestrator kendi
  // `pm2 delete <app>` komutunu çalıştırınca pm2'nin tree-kill'i ona ULAŞAMAZ
  // (DRILL-5 self-death fix'i). detached+unref korunur; stdio log dosyasına.
  const logPath = path.join(jobsDir, `${job.id}.log`)
  const logFd = fs.openSync(logPath, 'a')
  const child = spawn(
    'setsid',
    ['--fork', tsxBin, 'scripts/restore-orchestrator.ts', paramsPath],
    {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: ['ignore', logFd, logFd],
    }
  )
  child.unref()

  await logAuditEvent({
    action: 'BACKUP_RESTORE_DISPATCHED',
    actorId: user.id,
    targetType: 'BACKUP',
    targetId: id,
    details: {
      jobId: job.id,
      orchestratorPid: child.pid ?? null,
      restoreTargetDir: restoreTarget.targetDir,
      restoreDbName: restoreTarget.dbName,
      liveDbName,
      logPath,
    },
  })

  return NextResponse.json({
    ok: true,
    started: true,
    jobId: job.id,
    message:
      'Restore başlatıldı (detached orchestrator). İlerleme BackupLog üzerinden izlenir.',
  })
}
