/**
 * Backfill: OvertimePersonnel tekil alanlarından OvertimePersonnelUretim satırları.
 *
 * Faz 1 — her mevcut mesai personeli için 1 üretim satırı (sira=1).
 * PROD GERÇEĞİ: parça kodu `mesaiNedeni` alanına girilmiş; `targetProduction` %100 boş.
 * Kaynak eşlemesi (buildBackfillRow):
 *   mesaiNedeni       → parcaKodu        (boşsa satır oluşmaz — kayıt atlanır)
 *   (yok)             → mesaiNedeni=null (tarihsel gerekçe yok; kod parcaKodu'na taşındı)
 *   hedefAdet         → hedefAdet        (nullable — null ise NULL taşınır, satır yine oluşur)
 *   gerceklesenAdet   → gerceklesenAdet ; gerceklesenNote → gerceklesenNote
 *   (yok)             → hurdaAdet=null   ; sabit → sira=1
 *
 * Idempotent: zaten en az 1 uretimSatirlari olan personel atlanır.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-uretim-satirlari.ts            # DRY-RUN (yazma yok, rapor)
 *   npx tsx scripts/backfill-uretim-satirlari.ts --apply    # gerçek yazma
 */
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { buildBackfillRow } from '../src/lib/overtime-uretim'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const APPLY = process.argv.includes('--apply')

async function main() {
  const mode = APPLY ? 'APPLY (yazma)' : 'DRY-RUN (yalnız rapor)'
  console.log(`\n=== Backfill üretim satırları — ${mode} ===\n`)

  const records = await prisma.overtimePersonnel.findMany({
    select: {
      id: true,
      personnelId: true,
      mesaiNedeni: true,
      hedefAdet: true,
      gerceklesenAdet: true,
      gerceklesenNote: true,
      // idempotency: zaten satırı olan personeli atla
      uretimSatirlari: { select: { id: true }, take: 1 },
    },
  })

  const total = records.length
  const toCreate: { rec: (typeof records)[number]; row: NonNullable<ReturnType<typeof buildBackfillRow>> }[] = []
  const alreadyHas: string[] = []
  const skippedNoParca: { id: string; personnelId: string }[] = []

  for (const rec of records) {
    if (rec.uretimSatirlari.length > 0) {
      alreadyHas.push(rec.id)
      continue
    }
    const row = buildBackfillRow(rec)
    if (!row) {
      // parcaKodu (mesaiNedeni) boş → satır kurulamaz
      skippedNoParca.push({ id: rec.id, personnelId: rec.personnelId })
      continue
    }
    toCreate.push({ rec, row })
  }

  const hedefAdetNull = toCreate.filter((t) => t.row.hedefAdet == null)

  // --- Rapor / dağılım ---
  console.log(`Toplam OvertimePersonnel kaydı        : ${total}`)
  console.log(`Oluşturulacak üretim satırı           : ${toCreate.length}`)
  console.log(`  ├─ hedefAdet dolu                    : ${toCreate.length - hedefAdetNull.length}`)
  console.log(`  └─ hedefAdet NULL taşınacak          : ${hedefAdetNull.length}`)
  console.log(`Atlanan (zaten satırı var, idempotent): ${alreadyHas.length}`)
  console.log(`Atlanan (parcaKodu/mesaiNedeni boş)   : ${skippedNoParca.length}`)

  if (skippedNoParca.length > 0) {
    console.log('\n--- parcaKodu boş nedeniyle ATLANANLAR ---')
    for (const s of skippedNoParca) {
      console.log(`  OP:${s.id} personnel:${s.personnelId}`)
    }
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] Yazma yapılmadı. Gerçek çalıştırma için: --apply\n')
    return
  }

  console.log('\n[APPLY] Satırlar oluşturuluyor...')
  let created = 0
  for (const { rec, row } of toCreate) {
    await prisma.overtimePersonnelUretim.create({
      data: { overtimePersonnelId: rec.id, ...row },
    })
    created++
  }
  console.log(`[APPLY] Oluşturulan satır: ${created}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
