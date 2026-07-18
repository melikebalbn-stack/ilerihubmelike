/**
 * IproIfsEslesme satırlarını girer (ILERIHub bolum/gorev → IFS OrgCode/PosCode).
 *
 * Senkron (src/lib/ipro/ifs-personel-sync.ts) eşlemeyi önce BU tablodan, tutmazsa
 * IFS'teki isim birebir eşleşmesinden çözer; ikisi de tutmazsa kaydı ATLAR.
 * Buradaki satırlar "IFS'te aynı isimle karşılığı olmayan" değerler içindir.
 *
 * Idempotent: (tip, ilerihubDeger) unique → upsert. Tekrar çalıştırmak güvenli.
 * dev-guard: DATABASE_URL 'ilerihub_dev' İÇERMİYORSA → DUR (prod/staging asla).
 *
 *   npx tsx --env-file=.env scripts/ipro/seed-ifs-eslesme.ts [--dry-run]
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient, type IproIfsEslesmeTipi } from '../../src/generated/prisma'

const DRY = process.argv.includes('--dry-run')

// ONAYLI KARARLAR — her satırın gerekçesi aciklama'da durur, kod uydurulmaz.
const SATIRLAR: Array<{ tip: IproIfsEslesmeTipi; ilerihubDeger: string; ifsKod: string; aciklama: string }> = [
  {
    tip: 'ORG',
    ilerihubDeger: 'Üretim',
    ifsKod: '202',
    aciklama: 'IFS org 202 = Mekanik Montaj. ILERIHub "Üretim" bölümünün IFS karşılığı (onaylı karar).',
  },
  {
    tip: 'POZISYON',
    ilerihubDeger: 'Montaj Elemanı',
    ifsKod: '100151',
    aciklama: 'IFS pozisyon 100151 = MONTAJ OPERATÖRÜ. ILERIHub "Montaj Elemanı" karşılığı (onaylı karar).',
  },
  {
    tip: 'POZISYON',
    ilerihubDeger: 'Operatör',
    ifsKod: '100151',
    aciklama: 'IFS pozisyon 100151 = MONTAJ OPERATÖRÜ. ILERIHub "Operatör" karşılığı (onaylı karar).',
  },
]

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url.includes('ilerihub_dev')) {
    throw new Error(
      `GÜVENLİK DURDU: DATABASE_URL 'ilerihub_dev' içermiyor → ${url.replace(/:[^:@]+@/, ':****@')}`,
    )
  }

  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    for (const s of SATIRLAR) {
      if (DRY) {
        console.log(`[dry] ${s.tip.padEnd(8)} "${s.ilerihubDeger}" → ${s.ifsKod}`)
        continue
      }
      const r = await prisma.iproIfsEslesme.upsert({
        where: { tip_ilerihubDeger: { tip: s.tip, ilerihubDeger: s.ilerihubDeger } },
        create: { ...s, aktif: true },
        update: { ifsKod: s.ifsKod, aciklama: s.aciklama, aktif: true },
      })
      console.log(`${s.tip.padEnd(8)} "${s.ilerihubDeger}" → ${s.ifsKod}  (${r.id})`)
    }

    const toplam = await prisma.iproIfsEslesme.count({ where: { aktif: true } })
    console.log(`\nAktif eşleme satırı: ${toplam}${DRY ? ' (yazma yapılmadı)' : ''}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
