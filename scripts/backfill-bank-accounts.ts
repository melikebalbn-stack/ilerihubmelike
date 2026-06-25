/**
 * PR-1 — PersonnelSensitive banka alanları → PersonnelBankAccount backfill.
 *
 * PersonnelSensitive'de bankaSube/bankaHesapNo/ibanNo'dan en az biri DOLU olan her kişi için,
 * o kişide HENÜZ PersonnelBankAccount yoksa isPrimary=true tek satır oluşturur:
 *   { personnelId, bankaSube, hesapNo: bankaHesapNo, ibanNo, isPrimary:true, aktif:true,
 *     updatedBy: PersonnelSensitive.updatedBy ?? null }
 *
 * IDEMPOTENT: zaten hesabı olan kişiyi ATLAR (re-run güvenli).
 * Eski PersonnelSensitive.banka* alanlarına DOKUNMAZ (PR-1'de kalıyor, PR-2'de düşecek).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-bank-accounts.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-bank-accounts.ts --commit
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

type Mode = 'dry-run' | 'commit'
function parseMode(argv: string[]): Mode {
  const dry = argv.includes('--dry-run'), commit = argv.includes('--commit')
  if (dry && commit) throw new Error('--dry-run ve --commit aynı anda olamaz')
  if (!dry && !commit) throw new Error('--dry-run veya --commit belirtilmeli')
  return dry ? 'dry-run' : 'commit'
}
const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

async function main() {
  const mode = parseMode(process.argv.slice(2))
  const tag = mode === 'dry-run' ? '[DRY-RUN]' : '[COMMIT ]'
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  let created = 0, skippedHasAccount = 0, skippedNoBank = 0

  try {
    // Banka alanlarından en az biri dolu olan hassas kayıtlar
    const sensitives = await prisma.personnelSensitive.findMany({
      select: { personnelId: true, bankaSube: true, bankaHesapNo: true, ibanNo: true, updatedBy: true },
    })
    const withBank = sensitives.filter(
      (s) => !isEmpty(s.bankaSube) || !isEmpty(s.bankaHesapNo) || !isEmpty(s.ibanNo),
    )
    console.log(`\n=== BANKA HESABI BACKFILL — ${withBank.length} kişi banka verisi dolu ===`)

    for (const s of withBank) {
      const mevcut = await prisma.personnelBankAccount.count({ where: { personnelId: s.personnelId } })
      if (mevcut > 0) { skippedHasAccount++; continue } // zaten hesabı var → atla
      console.log(`  ${tag} ${s.personnelId} ← primary hesap (sube=${s.bankaSube ?? '-'}, iban=${isEmpty(s.ibanNo) ? '-' : 'var'})`)
      if (mode === 'commit') {
        await prisma.personnelBankAccount.create({
          data: {
            personnelId: s.personnelId,
            bankaSube: isEmpty(s.bankaSube) ? null : s.bankaSube,
            hesapNo: isEmpty(s.bankaHesapNo) ? null : s.bankaHesapNo,
            ibanNo: isEmpty(s.ibanNo) ? null : s.ibanNo,
            isPrimary: true,
            aktif: true,
            updatedBy: s.updatedBy ?? null,
          },
        })
      }
      created++
    }

    console.log(`\n${tag} ÖZET → oluşturulacak/oluşturulan: ${created} | zaten hesabı var (atlandı): ${skippedHasAccount} | banka verisi boş: ${skippedNoBank}`)
    if (mode === 'dry-run') console.log('Hiçbir değişiklik yapılmadı (dry-run).')
  } finally {
    await prisma.$disconnect(); await pool.end()
  }
}
main().catch((e) => { console.error('HATA:', e); process.exit(1) })
