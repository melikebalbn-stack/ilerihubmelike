/**
 * IPRO vardiya seed (Melike #5) — idempotent (upsert by kod).
 * VARDIYA-1: 07:00–17:00 (gündüz), VARDIYA-2: 21:00–07:00 (gece, ertesi güne taşar).
 * Kullanım: npx tsx --env-file=.env prisma/seed-ipro-vardiya.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const VARDIYALAR = [
  { kod: 'VARDIYA-1', ad: '1. Vardiya', baslangicSaat: '07:00', bitisSaat: '17:00', ertesiGuneTasar: false, sira: 1, aktif: true },
  { kod: 'VARDIYA-2', ad: '2. Vardiya', baslangicSaat: '21:00', bitisSaat: '07:00', ertesiGuneTasar: true, sira: 2, aktif: true },
]

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    for (const v of VARDIYALAR) {
      await prisma.iproVardiya.upsert({ where: { kod: v.kod }, update: {}, create: v })
      console.log(`✅ ${v.kod} (${v.baslangicSaat}–${v.bitisSaat})`)
    }
    console.log('Vardiya seed tamam (idempotent).')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
