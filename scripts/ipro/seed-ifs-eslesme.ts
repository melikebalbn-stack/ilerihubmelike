/**
 * IproIfsEslesme satırlarını girer (ILERIHub bolum/gorev → IFS OrgCode/PosCode).
 *
 * Senkron (src/lib/ipro/ifs-personel-sync.ts) eşlemeyi önce BU tablodan, tutmazsa
 * IFS'teki isim birebir eşleşmesinden çözer; ikisi de tutmazsa kaydı ATLAR.
 * Buradaki satırlar "IFS'te aynı isimle karşılığı olmayan" değerler içindir.
 *
 * Idempotent: (tip, ilerihubDeger) unique → upsert. Tekrar çalıştırmak güvenli.
 * Hedef-DB guard (_guard.ts): dev serbest, dev dışı YALNIZ --prod-onay ile.
 *
 *   npx tsx --env-file=.env scripts/ipro/seed-ifs-eslesme.ts [--dry-run]
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient, type IproIfsEslesmeTipi } from '../../src/generated/prisma'
import { hedefDbGuard } from './_guard'

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

  // ── PROD bölüm eşlemeleri (9 satır) ───────────────────────────────────
  // Kaynak: personnel_prod_25062026.csv, aktif='t' → 192 kişi / 25 farklı bolum.
  // 16'sı IFS'te birebir aynı isimle var; aşağıdaki 9'u eşleşmiyordu.
  // Fark hep aynı üç kalıptan biri: "Müdürlüğü" sonekinin düşmesi, "&"↔"ve",
  // ya da kısaltma ("PAZ."). Onaylı karar — 18.07.2026.
  {
    tip: 'ORG',
    ilerihubDeger: 'MÜHENDİSLİK',
    ifsKod: '105',
    aciklama: 'IFS 105 = Mühendislik Müdürlüğü. "Müdürlüğü" soneki düşmüş (8 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'İDARİ İŞLER',
    ifsKod: '111',
    aciklama: 'IFS 111 = İdari İşler Müdürlüğü. "Müdürlüğü" soneki düşmüş (7 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'PAKETLEME & DİREKSİYON',
    ifsKod: '208',
    aciklama: 'IFS 208 = Paketleme ve Direksiyon. "&" ↔ "ve" farkı (6 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'SATIŞ VE PAZ.MÜDÜRLÜĞÜ',
    ifsKod: '108',
    aciklama: 'IFS 108 = Satış ve Pazarlama Müdürlüğü. "PAZ." kısaltması (6 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'ASANSÖR',
    ifsKod: '112',
    // DİKKAT: 113 DEĞİL 112 — "ASANSÖR SATIŞ PAZARLAMA" ILERIHub'da AYRI bir
    // bolum değeri olarak zaten var ve IFS'te 113'e birebir eşleşiyor. Çıplak
    // "ASANSÖR" bu yüzden Asansör Müdürlüğü'ne (112) gider.
    aciklama: 'IFS 112 = Asansör Müdürlüğü. 113 (Asansör Satış Pazarlama) ayrı değere gidiyor (6 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'İNSAN VARLIKLARI',
    ifsKod: '109',
    aciklama: 'IFS 109 = İnsan Varlıkları Müdürlüğü. "Müdürlüğü" soneki düşmüş (5 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'LAZER & DAİRE TESTERE',
    ifsKod: '207',
    aciklama: 'IFS 207 = Lazer ve Daire Testere. "&" ↔ "ve" farkı (4 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'YATIRIM VE TEŞVİK',
    ifsKod: '114',
    aciklama: 'IFS 114 = Yatırım ve Teşvik Müdürlüğü. "Müdürlüğü" soneki düşmüş (2 kişi).',
  },
  {
    tip: 'ORG',
    ilerihubDeger: 'YENİ İŞ GELİŞTİRME',
    ifsKod: '115',
    aciklama: 'IFS 115 = Yeni İş Geliştirme Müdürlüğü. "Müdürlüğü" soneki düşmüş (1 kişi).',
  },
]

async function main() {
  const url = hedefDbGuard()

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
