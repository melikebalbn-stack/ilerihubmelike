#!/usr/bin/env tsx
/**
 * PR-RESTORE-3: Endpoint dryRun branch'inin CLI eşdeğeri.
 *
 * Endpoint'i (auth cookie + kill switch) gerektirmeden dryRun akışını
 * doğrular: validate → stage → checkSchemaCompatibility → cleanup.
 *
 * Kullanım:
 *   npx tsx --env-file=.env scripts/restore-dryrun-cli.ts <backup-filename>
 */

import { validateBackup } from '../src/lib/backup-validation'
import {
  extractToStaging,
  checkSchemaCompatibility,
  cleanupStaging,
} from '../src/lib/backup-restore-staging'
import path from 'path'

const fileName = process.argv[2]
if (!fileName) {
  console.error('Kullanım: npx tsx scripts/restore-dryrun-cli.ts <backup-filename>')
  process.exit(1)
}

const backupPath = fileName.startsWith('/')
  ? fileName
  : path.join('/home/rokunet/backups', fileName)

;(async () => {
  console.log(`📦 PR-RESTORE-3 dryRun simülasyonu: ${backupPath}\n`)
  const start = Date.now()
  const backupId = `dryrun_cli_${Date.now()}`

  console.log('--- 1. validateBackup ---')
  const validation = await validateBackup(backupPath)
  console.log(`valid=${validation.valid} sizeBytes=${validation.sizeBytes} fileCount=${validation.fileCount}`)
  if (validation.warnings.length) console.log('warnings:', validation.warnings)
  if (!validation.valid) {
    console.error('❌ Validation failed:', validation.errors)
    process.exit(2)
  }

  console.log('\n--- 2. extractToStaging ---')
  const staging = await extractToStaging(backupPath, { backupId })
  if (!staging.success) {
    console.error('❌ Staging failed:', staging.errors)
    process.exit(3)
  }
  console.log(
    `stagingDir=${staging.staging!.stagingDir}\n` +
      `extractedFileCount=${staging.staging!.extractedFileCount}\n` +
      `dbDumpPath=${staging.staging!.dbDumpPath ?? 'N/A'}\n` +
      `testDbName=${staging.staging!.testDbName ?? 'N/A'}\n` +
      `testDbTableCount=${staging.staging!.testDbTableCount ?? 'N/A'}\n` +
      `criticalTables=${JSON.stringify(staging.staging!.testDbCriticalTables)}`
  )

  let schemaCheck = null
  if (staging.staging!.testDbName) {
    console.log('\n--- 3. checkSchemaCompatibility ---')
    schemaCheck = await checkSchemaCompatibility(staging.staging!.testDbName)
    console.log(
      `compatible=${schemaCheck.compatible}\n` +
        `liveTableCount=${schemaCheck.liveTableCount} testTableCount=${schemaCheck.testTableCount}\n` +
        `criticalMissing=${JSON.stringify(schemaCheck.criticalMissing)}\n` +
        `missingInTest=${schemaCheck.missingInTest.length} extraInTest=${schemaCheck.extraInTest.length}`
    )
    if (schemaCheck.missingInTest.length && schemaCheck.missingInTest.length < 30) {
      console.log('  missingInTest detail:', schemaCheck.missingInTest)
    }
    if (schemaCheck.extraInTest.length && schemaCheck.extraInTest.length < 30) {
      console.log('  extraInTest detail:', schemaCheck.extraInTest)
    }
  }

  console.log('\n--- 4. cleanupStaging ---')
  await cleanupStaging(staging.staging!.stagingDir, staging.staging!.testDbName)
  console.log('✅ Temizlendi')

  const ok = staging.success && (schemaCheck?.compatible ?? true)
  console.log(`\n${ok ? '✅' : '❌'} dryRun ${ok ? 'BAŞARILI' : 'BAŞARISIZ'} (${((Date.now() - start) / 1000).toFixed(1)}s)`)
  process.exit(ok ? 0 : 4)
})()
