/**
 * Syteline → IFS değer eşleme seed (feat/syteline-cevirici).
 * Mevcut sabit BIRIM_HARITASI satırlarını MALZEME/BIRIM olarak SyteEsleme'ye taşır.
 * Idempotent: upsert (@@unique entity+tip+kaynakDeger).
 *
 * Kullanım: npx tsx --env-file=.env prisma/seed-syte-esleme.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

// mapper.ts BIRIM_HARITASI ile birebir (kaynak büyük harf → IFS kodu).
const BIRIMLER: Record<string, string> = { AD: 'ad', LT: 'l', GR: 'g', PKT: 'pkg', RU: 'ru', TOP: 'top' }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  try {
    let n = 0
    for (const [kaynak, hedef] of Object.entries(BIRIMLER)) {
      await prisma.syteEsleme.upsert({
        where: { entity_tip_kaynakDeger: { entity: 'MALZEME', tip: 'BIRIM', kaynakDeger: kaynak } },
        update: {}, // varsa dokunma (elle düzeltilmiş olabilir)
        create: { entity: 'MALZEME', tip: 'BIRIM', kaynakDeger: kaynak, hedefDeger: hedef, not: 'seed: BIRIM_HARITASI' },
      })
      n++
    }
    const toplam = await prisma.syteEsleme.count({ where: { entity: 'MALZEME', tip: 'BIRIM' } })
    console.log(`✅ BIRIM eşlemesi seed: ${n} işlendi · toplam MALZEME/BIRIM: ${toplam}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
