// PR-PERSONNEL-DEPARTMENT-HISTORY: Excel historical transfer kayıtlarını
// DB'deki Personnel ile eşleştir. Bu script SADECE rapor üretir; bulk import
// onay sonrası ayrı script.
//
// Eşleşme stratejisi:
//   1. Exact match: TR normalize (uppercase + diakritik fold)
//   2. Fuzzy: pg_trgm similarity > 0.7 (Personnel.adSoyad ile)
//
// Kullanım: npx tsx --env-file=.env scripts/match-historical-transfers.ts

import fs from 'fs'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface ExcelRow {
  adSoyad: string
  transferEdenBolum: string
  transferEdilenBolum: string
  transferTarihi: Date | null
}

function trNormalize(s: string): string {
  return s
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTrDate(s: string): Date | null {
  if (!s || s.trim() === '') return null
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

async function main() {
  const raw = fs.readFileSync('/tmp/historical-transfers.tsv', 'utf-8').trim()
  const lines = raw.split('\n')
  const rows: ExcelRow[] = lines.slice(1).map((line) => {
    const [adSoyad, transferEdenBolum, transferEdilenBolum, transferTarihi] = line.split('\t')
    return {
      adSoyad: (adSoyad ?? '').trim(),
      transferEdenBolum: (transferEdenBolum ?? '').trim(),
      transferEdilenBolum: (transferEdilenBolum ?? '').trim(),
      transferTarihi: parseTrDate(transferTarihi ?? ''),
    }
  })

  console.log(`\nToplam satır: ${rows.length}`)
  console.log(`Boş tarih: ${rows.filter((r) => !r.transferTarihi).length}`)

  const allPersonnel = await prisma.personnel.findMany({
    select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true },
  })
  console.log(`DB toplam personel: ${allPersonnel.length}\n`)

  const uniqueNames = [...new Set(rows.map((r) => r.adSoyad))]
  console.log(`Unique aday isim: ${uniqueNames.length}`)

  interface Match {
    excel: ExcelRow
    personnelId: string
    personnelAdSoyad: string
    personnelSicilNo: string | null
    aktif: boolean
    currentBolum: string | null
    method: string
    similarity?: number
  }
  interface Unmatch {
    excel: ExcelRow
    reason: string
  }

  const matched: Match[] = []
  const unmatched: Unmatch[] = []

  // Cache exact match için
  const normalizedMap = new Map<string, typeof allPersonnel[number]>()
  for (const p of allPersonnel) normalizedMap.set(trNormalize(p.adSoyad), p)

  for (const row of rows) {
    const target = trNormalize(row.adSoyad)

    // 1. Exact normalize match
    const exact = normalizedMap.get(target)
    if (exact) {
      matched.push({
        excel: row,
        personnelId: exact.id,
        personnelAdSoyad: exact.adSoyad,
        personnelSicilNo: exact.sicilNo,
        aktif: exact.aktif,
        currentBolum: exact.bolum,
        method: 'exact',
      })
      continue
    }

    // 2. Fuzzy (pg_trgm) — threshold 0.5, en yüksek 3 aday raporlanır
    const trgm = await prisma.$queryRaw<
      Array<{
        id: string
        sicilNo: string
        adSoyad: string
        aktif: boolean
        bolum: string | null
        similarity: number
      }>
    >`
      SELECT id, "sicilNo", "adSoyad", aktif, bolum,
             similarity("adSoyad", ${row.adSoyad})::float AS similarity
      FROM "Personnel"
      WHERE similarity("adSoyad", ${row.adSoyad}) > 0.5
      ORDER BY similarity DESC
      LIMIT 1
    `
    if (trgm.length > 0) {
      const c = trgm[0]
      matched.push({
        excel: row,
        personnelId: c.id,
        personnelAdSoyad: c.adSoyad,
        personnelSicilNo: c.sicilNo,
        aktif: c.aktif,
        currentBolum: c.bolum,
        method: `trgm(${c.similarity.toFixed(2)})`,
        similarity: c.similarity,
      })
      continue
    }

    unmatched.push({ excel: row, reason: "DB'de bulunamadı" })
  }

  console.log(`\n═══ EŞLEŞME RAPORU ═══`)
  console.log(`Eşleşen: ${matched.length}/${rows.length}`)
  console.log(`  - Exact: ${matched.filter((m) => m.method === 'exact').length}`)
  console.log(`  - Fuzzy (trgm): ${matched.filter((m) => m.method.startsWith('trgm')).length}`)
  console.log(`  - Aktif personel: ${matched.filter((m) => m.aktif).length}`)
  console.log(`  - Pasif personel: ${matched.filter((m) => !m.aktif).length}`)
  console.log(`Eşleşmeyen: ${unmatched.length}`)

  if (unmatched.length > 0) {
    console.log(`\n── Eşleşmeyen kayıtlar (${unmatched.length}) ──`)
    unmatched.forEach((u) => {
      const tarih = u.excel.transferTarihi ? u.excel.transferTarihi.toLocaleDateString('tr-TR') : '(tarih yok)'
      console.log(`  · ${u.excel.adSoyad.padEnd(28)} ${u.excel.transferEdenBolum} → ${u.excel.transferEdilenBolum} (${tarih})`)
    })
  }

  const fuzzy = matched.filter((m) => m.method.startsWith('trgm'))
  if (fuzzy.length > 0) {
    console.log(`\n── Fuzzy eşleşmeler (manuel kontrol önerilir, ${fuzzy.length} adet) ──`)
    for (const m of fuzzy) {
      console.log(
        `  Excel "${m.excel.adSoyad}" → DB "${m.personnelAdSoyad}" (${m.personnelSicilNo}, ${m.aktif ? 'aktif' : 'pasif'}) [${m.method}]`
      )
    }
  }

  // Çoklu transfer (aynı isim Excel'de N kez)
  const nameCount = new Map<string, number>()
  for (const r of rows) nameCount.set(r.adSoyad, (nameCount.get(r.adSoyad) ?? 0) + 1)
  const dupes = [...nameCount.entries()].filter(([, n]) => n > 1)
  if (dupes.length > 0) {
    console.log(`\n── Excel'de aynı isimle birden fazla transfer (${dupes.length} kişi) ──`)
    for (const [name, n] of dupes) console.log(`  · ${name}: ${n} transfer`)
  }

  fs.writeFileSync(
    '/tmp/historical-transfers-matched.json',
    JSON.stringify({ matched, unmatched, generatedAt: new Date().toISOString() }, null, 2)
  )
  console.log(`\nDetay: /tmp/historical-transfers-matched.json`)

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
