/**
 * Backfill: OvertimePersonnel tekil alanlarından OvertimePersonnelUretim satırları.
 *
 * Faz 1 — her mevcut mesai personeli için 1 üretim satırı (sira=1) oluşturur.
 * Kaynak eşlemesi (tekil alan → yeni satır):
 *   targetProduction  → parcaKodu        (NOT NULL — boşsa satır oluşturulamaz)
 *   hedefAdet         → hedefAdet        (NOT NULL — null ise satır oluşturulamaz)
 *   mesaiNedeni       → mesaiNedeni      (nullable)
 *   gerceklesenAdet   → gerceklesenAdet  (nullable)
 *   gerceklesenNote   → gerceklesenNote  (nullable)
 *   (yok)             → hurdaAdet = null
 *   sabit             → sira = 1
 *
 * Idempotent: zaten en az 1 uretimSatirlari olan personel atlanır.
 * Kaynak Int (hedefAdet/gerceklesenAdet) zaten sayısal — String→Int parse GEREKMEZ.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-uretim-satirlari.ts            # DRY-RUN (yazma yok, rapor)
 *   npx tsx scripts/backfill-uretim-satirlari.ts --apply    # gerçek yazma
 */
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

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
      overtimeFormId: true,
      personnelId: true,
      targetProduction: true,
      mesaiNedeni: true,
      hedefAdet: true,
      gerceklesenAdet: true,
      gerceklesenNote: true,
      // idempotency: zaten satırı olan personeli atla
      uretimSatirlari: { select: { id: true }, take: 1 },
    },
  })

  const total = records.length
  const toCreate: { rec: (typeof records)[number]; parcaKodu: string; hedefAdet: number }[] = []
  const alreadyHas: string[] = []
  // Eksik veri: geçerli satır (parcaKodu + hedefAdet zorunlu) kurulamayanlar
  const skippedIncomplete: {
    id: string
    personnelId: string
    targetProduction: string | null
    hedefAdet: number | null
    mesaiNedeni: string | null
    reason: string
  }[] = []

  for (const rec of records) {
    if (rec.uretimSatirlari.length > 0) {
      alreadyHas.push(rec.id)
      continue
    }

    const parcaKodu = (rec.targetProduction ?? '').trim()
    const hasParca = parcaKodu !== ''
    const hasHedef = rec.hedefAdet != null

    if (!hasParca || !hasHedef) {
      const missing: string[] = []
      if (!hasParca) missing.push('targetProduction boş')
      if (!hasHedef) missing.push('hedefAdet null')
      skippedIncomplete.push({
        id: rec.id,
        personnelId: rec.personnelId,
        targetProduction: rec.targetProduction,
        hedefAdet: rec.hedefAdet,
        mesaiNedeni: rec.mesaiNedeni,
        reason: missing.join(' + '),
      })
      continue
    }

    toCreate.push({ rec, parcaKodu, hedefAdet: rec.hedefAdet as number })
  }

  // --- Rapor ---
  console.log(`Toplam OvertimePersonnel kaydı        : ${total}`)
  console.log(`Oluşturulacak üretim satırı           : ${toCreate.length}`)
  console.log(`Atlanan (zaten satırı var, idempotent): ${alreadyHas.length}`)
  console.log(`Atlanan (eksik veri, satır kurulamaz) : ${skippedIncomplete.length}`)

  if (skippedIncomplete.length > 0) {
    console.log('\n--- Eksik veri nedeniyle ATLANANLAR (karar sizde) ---')
    for (const s of skippedIncomplete) {
      console.log(
        `  OP:${s.id} personnel:${s.personnelId} | ${s.reason} | ` +
          `targetProduction=${JSON.stringify(s.targetProduction)} hedefAdet=${s.hedefAdet} ` +
          `mesaiNedeni=${JSON.stringify(s.mesaiNedeni)}`,
      )
    }
  }

  // hedefAdet <= 0 uyarısı (oluşturulacaklar içinde) — veri korunur, yalnız işaretlenir
  const nonPositive = toCreate.filter((t) => t.hedefAdet <= 0)
  if (nonPositive.length > 0) {
    console.log(`\n--- UYARI: hedefAdet <= 0 olan ${nonPositive.length} satır (oluşturulacak ama gözden geçirin) ---`)
    for (const t of nonPositive) {
      console.log(`  OP:${t.rec.id} hedefAdet=${t.hedefAdet} parcaKodu=${JSON.stringify(t.parcaKodu)}`)
    }
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] Yazma yapılmadı. Gerçek çalıştırma için: --apply\n')
    return
  }

  console.log('\n[APPLY] Satırlar oluşturuluyor...')
  let created = 0
  for (const { rec, parcaKodu } of toCreate) {
    await prisma.overtimePersonnelUretim.create({
      data: {
        overtimePersonnelId: rec.id,
        parcaKodu,
        mesaiNedeni: rec.mesaiNedeni,
        hedefAdet: rec.hedefAdet as number,
        gerceklesenAdet: rec.gerceklesenAdet,
        gerceklesenNote: rec.gerceklesenNote,
        hurdaAdet: null,
        sira: 1,
      },
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
