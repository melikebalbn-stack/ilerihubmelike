#!/usr/bin/env tsx
/**
 * Backup validation CLI — manuel test için
 * Kullanım: npx tsx scripts/validate-backup-cli.ts <tarball-path>
 *
 * Exit codes:
 *   0 — valid
 *   1 — kullanım hatası
 *   2 — invalid backup
 */

import { validateBackup } from '../src/lib/backup-validation'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Kullanım: npx tsx scripts/validate-backup-cli.ts <tarball-path>')
  process.exit(1)
}

;(async () => {
  console.log(`Doğrulanıyor: ${filePath}\n`)
  const start = Date.now()
  const result = await validateBackup(filePath)
  const duration = ((Date.now() - start) / 1000).toFixed(1)

  console.log(JSON.stringify(result, null, 2))
  console.log(`\n⏱️  ${duration}s`)

  if (!result.valid) {
    console.error('\n❌ Doğrulama BAŞARISIZ')
    process.exit(2)
  }
  console.log('\n✅ Doğrulama başarılı')
})()
