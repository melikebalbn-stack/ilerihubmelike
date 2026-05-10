#!/usr/bin/env tsx
/**
 * PR-RESTORE-2: Backup staging extract + DB restore test (dry-run)
 *
 * Kullanım:
 *   npx tsx --env-file=.env scripts/restore-staging-cli.ts <backup-filename>
 *   npx tsx --env-file=.env scripts/restore-staging-cli.ts <backup-filename> --keep
 *
 * --env-file=.env ŞART — DATABASE_URL env'den okunuyor (PGPASSWORD vb.).
 * --keep: cleanup yapma, manuel inceleme için staging + test DB durur.
 */

import { extractToStaging, cleanupStaging } from '../src/lib/backup-restore-staging'
import path from 'path'

const fileName = process.argv[2]
const keep = process.argv.includes('--keep')

if (!fileName) {
  console.error('Kullanım: npx tsx scripts/restore-staging-cli.ts <backup-filename> [--keep]')
  process.exit(1)
}

const backupPath = fileName.startsWith('/')
  ? fileName
  : path.join('/home/rokunet/backups', fileName)

;(async () => {
  console.log(`📦 Staging extract: ${backupPath}\n`)

  const result = await extractToStaging(backupPath, {
    backupId: `cli_test_${Date.now()}`,
  })

  console.log(JSON.stringify(result, null, 2))

  if (!result.success) {
    console.error('\n❌ Başarısız')
    process.exit(2)
  }

  console.log(`\n✅ Başarılı (${(result.staging!.durationMs / 1000).toFixed(1)}s)`)
  console.log(`📁 Staging: ${result.staging!.stagingDir}`)
  if (result.staging!.testDbName) {
    console.log(`🗄️  Test DB: ${result.staging!.testDbName}`)
    console.log(`📊 Tablo sayısı: ${result.staging!.testDbTableCount}`)
    console.log(`📋 Kritik tablolar:`, result.staging!.testDbCriticalTables)
  }

  if (!keep) {
    console.log('\n🧹 Cleanup...')
    await cleanupStaging(result.staging!.stagingDir, result.staging!.testDbName)
    console.log('✅ Temizlendi')
  } else {
    console.log('\n⚠️  --keep: cleanup yapılmadı, manuel inceleme için duruyor')
    console.log(`   Sonra: rm -rf ${result.staging!.stagingDir}`)
    if (result.staging!.testDbName) {
      console.log(`   Sonra: psql -d postgres -c "DROP DATABASE ${result.staging!.testDbName};"`)
    }
  }
})()
