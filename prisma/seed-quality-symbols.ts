/**
 * Quality Symbol Seed (KALITE-1)
 *
 * 10 GD&T sembolü (ISO 1101). SVG content inline, <svg> wrapper'sız
 * (viewBox 0 0 24 24 varsayılır, runtime'da wrapper eklenir).
 *
 * Idempotent: key unique, varsa update, yoksa create.
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-quality-symbols.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const SYMBOLS = [
  {
    key: 'position',
    nameTr: 'Konum',
    nameEn: 'Position',
    order: 1,
    svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/>',
  },
  {
    key: 'parallelism',
    nameTr: 'Paralellik',
    nameEn: 'Parallelism',
    order: 2,
    svg: '<line x1="4" y1="18" x2="14" y2="6" stroke="currentColor" stroke-width="1.8"/><line x1="10" y1="18" x2="20" y2="6" stroke="currentColor" stroke-width="1.8"/>',
  },
  {
    key: 'perpendicularity',
    nameTr: 'Diklik',
    nameEn: 'Perpendicularity',
    order: 3,
    svg: '<line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="21" x2="21" y2="21" stroke="currentColor" stroke-width="1.8"/>',
  },
  {
    key: 'flatness',
    nameTr: 'Düzlemsellik',
    nameEn: 'Flatness',
    order: 4,
    svg: '<polygon points="3,17 9,7 21,7 15,17" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  },
  {
    key: 'circularity',
    nameTr: 'Yuvarlaklık',
    nameEn: 'Circularity',
    order: 5,
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  },
  {
    key: 'cylindricity',
    nameTr: 'Silindiriklik',
    nameEn: 'Cylindricity',
    order: 6,
    svg: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="5" x2="3" y2="19" stroke="currentColor" stroke-width="1.6"/><line x1="21" y1="5" x2="21" y2="19" stroke="currentColor" stroke-width="1.6"/>',
  },
  {
    key: 'concentricity',
    nameTr: 'Eş Merkezlilik',
    nameEn: 'Concentricity',
    order: 7,
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  },
  {
    key: 'symmetry',
    nameTr: 'Simetri',
    nameEn: 'Symmetry',
    order: 8,
    svg: '<line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="1.6"/>',
  },
  {
    key: 'straightness',
    nameTr: 'Düzgünlük',
    nameEn: 'Straightness',
    order: 9,
    svg: '<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>',
  },
  {
    key: 'angularity',
    nameTr: 'Açısallık',
    nameEn: 'Angularity',
    order: 10,
    svg: '<line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="1.6"/><line x1="5" y1="20" x2="17" y2="5" stroke="currentColor" stroke-width="1.6"/>',
  },
]

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    let inserted = 0
    let updated = 0

    for (const s of SYMBOLS) {
      const existing = await prisma.qualitySymbol.findUnique({ where: { key: s.key } })
      if (existing) {
        await prisma.qualitySymbol.update({
          where: { key: s.key },
          data: {
            nameTr: s.nameTr,
            nameEn: s.nameEn,
            svgContent: s.svg,
            displayOrder: s.order,
            active: true,
          },
        })
        updated++
      } else {
        await prisma.qualitySymbol.create({
          data: {
            key: s.key,
            nameTr: s.nameTr,
            nameEn: s.nameEn,
            svgContent: s.svg,
            displayOrder: s.order,
            active: true,
          },
        })
        inserted++
      }
    }

    console.log(`✅ Quality symbols seed: ${inserted} inserted, ${updated} updated`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
