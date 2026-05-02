/**
 * ILERIHub Arşiv Modülü — Bolum Seed (Idempotent)
 *
 * Personnel.bolum'dan unique bolum'ları çeker, ArsivBolum'da olmayan
 * yeni bolum'ları ekler. Mevcut kayıtlara dokunmaz.
 *
 * Yeni bolum'lar için kısa kod ve renk hardcoded BOLUM_META'dan alınır.
 * Map'te olmayan bolum eklenmesi için BOLUM_META güncellenmeli.
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env prisma/seed-arsiv-bolum.ts
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type BolumMeta = { kod: string; renkHex: string }

const BOLUM_META: Record<string, BolumMeta> = {
  'KALİTE MÜDÜRLÜĞÜ':            { kod: 'KAL', renkHex: '#1D9E75' },
  'MEKANİK MONTAJ':              { kod: 'MMT', renkHex: '#475569' },
  'KAYNAKHANE':                  { kod: 'KYN', renkHex: '#888780' },
  'FİNANS MUHASEBE MÜDÜRLÜĞÜ':   { kod: 'FMM', renkHex: '#888780' },
  'SATINALMA MÜDÜRLÜĞÜ':         { kod: 'SAR', renkHex: '#D85A30' },
  'SATIŞ VE PAZ.MÜDÜRLÜĞÜ':      { kod: 'SAT', renkHex: '#EF9F27' },
  'İNSAN VARLIKLARI':            { kod: 'IVK', renkHex: '#7F77DD' },
  'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ': { kod: 'SGM', renkHex: '#534AB7' },
  'BAKIMHANE':                   { kod: 'BAK', renkHex: '#854F0B' },
  'DEPO':                        { kod: 'DEP', renkHex: '#888780' },
  'PLASTİK ENJEKSİYON':          { kod: 'PEN', renkHex: '#888780' },
  'KALIPHANE':                   { kod: 'KLP', renkHex: '#888780' },
  'FABRİKA MÜDÜRLÜĞÜ':           { kod: 'FAB', renkHex: '#378ADD' },
  'MÜHENDİSLİK':                 { kod: 'MHN', renkHex: '#0EA5E9' },
  'TALAŞLI İMALAT':              { kod: 'TLI', renkHex: '#888780' },
  'ASANSÖR':                     { kod: 'ASN', renkHex: '#888780' },
  'PAKETLEME & DİREKSİYON':      { kod: 'PKD', renkHex: '#888780' },
  'PRESHANE':                    { kod: 'PRS', renkHex: '#888780' },
  'LAZER & DAİRE TESTERE':       { kod: 'LZR', renkHex: '#888780' },
  'İDARİ İŞLER':                 { kod: 'IDR', renkHex: '#888780' },
  'PROTOTİP ATÖLYE':             { kod: 'PRT', renkHex: '#888780' },
  'YATIRIM VE TEŞVİK':           { kod: 'YAT', renkHex: '#888780' },
  'GENEL MÜDÜRLÜK':              { kod: 'GMD', renkHex: '#888780' },
  'YENİ İŞ GELİŞTİRME':          { kod: 'YIG', renkHex: '#888780' },
  'ASANSÖR SATIŞ PAZARLAMA':     { kod: 'ASP', renkHex: '#888780' },
}

async function main() {
  console.log('🗂️  ArsivBolum seed başlıyor...')

  // Personnel.bolum -> distinct
  const rows = await prisma.personnel.findMany({
    where: { aktif: true, bolum: { not: '' } },
    select: { bolum: true },
    distinct: ['bolum'],
  })
  const personnelBolumler = rows.map((r) => r.bolum)
  console.log(`📋 Personnel'de ${personnelBolumler.length} aktif unique bolum`)

  // Mevcut ArsivBolum
  const mevcut = await prisma.arsivBolum.findMany({ select: { ad: true } })
  const mevcutSet = new Set(mevcut.map((b) => b.ad))

  let yeni = 0
  let atlanan = 0
  const eksikMeta: string[] = []

  for (const ad of personnelBolumler) {
    if (mevcutSet.has(ad)) {
      atlanan++
      continue
    }
    const meta = BOLUM_META[ad]
    if (!meta) {
      eksikMeta.push(ad)
      continue
    }
    await prisma.arsivBolum.create({
      data: { ad, kod: meta.kod, renkHex: meta.renkHex, aktifMi: true },
    })
    yeni++
  }

  console.log(`✅ Yeni: ${yeni}  ⏭️  Atlanan (mevcut): ${atlanan}`)

  if (eksikMeta.length > 0) {
    console.warn(`\n⚠️  BOLUM_META'da olmayan ${eksikMeta.length} bolum:`)
    for (const ad of eksikMeta) console.warn(`   - ${ad}`)
    console.warn(`   seed-arsiv-bolum.ts içinde BOLUM_META'yı güncelle.`)
  }
}

main()
  .catch((e) => { console.error('❌ Seed hatası:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
