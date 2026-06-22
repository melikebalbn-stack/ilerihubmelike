import {
  PrismaClient,
  UserRoleEnum as Role,
  CostCurrency,
  CostAnalysisStatus,
  MaterialCostCategory,
  CostLaborType,
  CostServiceType,
  OtherCostCategory,
} from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import XLSX from 'xlsx'
import path from 'path'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const n = (v: any): number => {
  const f = parseFloat(v)
  return isNaN(f) ? 0 : f
}

function readExcel() {
  const filePath = path.join(__dirname, 'ROKETSAN MALİYET deflektör.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['Sayfa1']
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  return rows
}

function matCategory(kod: string | null, name: string): MaterialCostCategory {
  const lname = (name || '').toLowerCase()
  if (lname.includes('bağlantı eleman')) return MaterialCostCategory.STANDARD_PART
  if (!kod) return MaterialCostCategory.PURCHASED_PART
  return MaterialCostCategory.SEMI_FINISHED
}

const OPERASYONLAR = [
  { idx: 8,  ad: 'CNC',                 wc: 'CNC' },
  { idx: 9,  ad: 'Lazer',               wc: 'Lazer' },
  { idx: 10, ad: 'Matkap/Pres/Tester',  wc: 'Matkap/Pres/Tester' },
  { idx: 11, ad: 'Abkant',              wc: 'Abkant' },
  { idx: 12, ad: 'Kaynak',              wc: 'Kaynak' },
  { idx: 13, ad: 'Hazırlık',            wc: 'Hazırlık' },
  { idx: 14, ad: 'Diğer',               wc: 'Diğer' },
] as const

async function main() {
  const creator = await prisma.user.findFirst({
    where: { role: { in: [Role.IT_MANAGER, Role.SUPER_ADMIN, Role.ADMIN] }, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!creator) throw new Error('Seed için uygun kullanıcı bulunamadı.')
  console.log(`✅ Oluşturan: ${creator.email}`)

  const mevcut = await prisma.costAnalysis.findFirst({
    where: { code: '8513', revisionNumber: 0 },
  })
  if (mevcut) {
    throw new Error(
      `❌ "8513" kodlu CostAnalysis zaten mevcut (id: ${mevcut.id}). ` +
      `Yeni kod olarak ekleneceği için seed durduruldu.`
    )
  }

  const rows = readExcel()
  console.log(`📊 Excel okundu: ${rows.length} satır`)

  const VERI_BASLANGIC = 3
  const VERI_BITIS     = 8

  const materialCreates: any[] = []
  const laborCreates: any[]    = []
  let matSum = 0
  let labSum = 0
  let labSira = 0

  for (let i = VERI_BASLANGIC; i <= VERI_BITIS; i++) {
    const row = rows[i]
    if (!row) continue

    const parcaKodu  = row[0]  != null ? String(row[0]).trim() : null
    const parcaAdi   = row[1]  != null ? String(row[1]).trim() : null
    const brutAgirlik = n(row[2])
    const adet       = n(row[3]) || 1
    const toplamAg   = n(row[4]) || (brutAgirlik * adet) || adet
    const malzeme    = row[5]  != null ? String(row[5]).trim() : null
    const birimFiyat = n(row[6])
    const toplamLab  = n(row[15])

    if (!parcaAdi) continue

    // Hem malzeme hem işçilik boşsa grup başlığı satırı → atla
    if (birimFiyat <= 0 && toplamLab <= 0) {
      console.log(`   ⏭️  Atlandı (grup başlığı): ${parcaKodu} ${parcaAdi}`)
      continue
    }

    const sira = i - VERI_BASLANGIC + 1

    // ——— CostMaterial (U3 düzeltmesi: totalPrice = toplamAğırlık × birimFiyat) ———
    if (birimFiyat > 0) {
      const computedTotal = toplamAg * birimFiyat
      const excelTotal    = n(row[7])

      // Excel formül hatası tespiti
      if (Math.abs(computedTotal - excelTotal) > 0.01) {
        console.log(
          `   🔧 Formül düzeltildi: ${parcaAdi} → Excel ${excelTotal}€, ` +
          `doğru ${computedTotal}€ (${toplamAg} × ${birimFiyat})`
        )
      }

      // U1 düzeltmesi: brüt ağırlık specification içine yazılır
      const spec = brutAgirlik > 0
        ? `${malzeme || ''} (${brutAgirlik} kg/adet)`.trim()
        : malzeme

      materialCreates.push({
        materialCode: parcaKodu,
        name: parcaAdi,
        specification: spec,
        category: matCategory(parcaKodu, parcaAdi),
        unit: 'adet',
        currency: CostCurrency.EUR,
        grossQuantity: toplamAg > 0 ? toplamAg : adet,
        wasteRate: 0,
        netQuantity: adet,
        unitPrice: birimFiyat,
        totalPrice: computedTotal,
        sortOrder: sira,
      })
      matSum += computedTotal
    }

    // ——— CostLabor (U2 düzeltmesi: her operasyon ayrı satır, totalCost = değer × adet) ———
    if (toplamLab > 0) {
      for (const op of OPERASYONLAR) {
        const val = n(row[op.idx])
        if (val <= 0) continue

        // Excel'de I:O*D array formülü → her değer adet ile çarpılır
        const opTotal = val * adet
        labSira++

        laborCreates.push({
          operationName: `${parcaAdi} - ${op.ad}`,
          workCenter: op.wc,
          laborType: CostLaborType.INTERNAL,
          setupTime: 0,
          processTime: opTotal,
          totalTime: opTotal,
          hourlyRate: 1,
          totalCost: opTotal,
          sortOrder: labSira,
        })
        labSum += opTotal
      }
    }
  }

  // —— Dış Hizmetler (S2: ayrı kalemler) ——
  const externalCreates: any[] = [
    {
      serviceName: 'DEFLEKTÖR ŞASİ KOMPLESİ - CNC Dış İşçilik',
      description: 'Excel ana tablodan: 234830 / DEFLEKTÖR ŞASİ KOMPLESİ - CNC Dış İşçilik sütunu',
      serviceType: CostServiceType.PROCESSING,
      quantity: 1, unit: 'kalem',
      unitPrice: 500, totalPrice: 500, sortOrder: 1,
    },
    {
      serviceName: 'Yüzey İşlemleri (Kataforez vb.)',
      description: 'Excel özet bölgesinden: TOPLAM YÜZEY İŞLEMLERİ. NOT: birim fiyatlara boya dahil değildir, kataforez dahildir.',
      serviceType: CostServiceType.SURFACE_TREATMENT,
      quantity: 1, unit: 'kalem',
      unitPrice: 1000, totalPrice: 1000, sortOrder: 2,
    },
  ]
  const extSum = 1500

  // —— Diğer Maliyetler (S3: MONTAJ → ASSEMBLY_LABOR) ——
  const otherCreates: any[] = [
    {
      name: 'Montaj İşçiliği',
      description: 'Excel ana tablo MONTAJ satırından (TOPLAM DIŞ İŞÇİLİK sütununda 200€)',
      category: OtherCostCategory.ASSEMBLY_LABOR,
      quantity: 1, unit: 'kalem', unitPrice: 200, totalPrice: 200, sortOrder: 1,
    },
    {
      name: 'Ölçüm ve Kalite Kontrol',
      description: 'Excel özet bölgesinden: ÖLÇÜM VE KALİTE KONT. MALİYETİ',
      category: OtherCostCategory.QUALITY_CONTROL,
      quantity: 1, unit: 'kalem', unitPrice: 250, totalPrice: 250, sortOrder: 2,
    },
    { name: 'Nakliye',  category: OtherCostCategory.TRANSPORT,
      quantity: 1, unit: 'kalem', unitPrice: 250, totalPrice: 250, sortOrder: 3 },
    { name: 'Ambalaj',  category: OtherCostCategory.PACKAGING,
      quantity: 1, unit: 'kalem', unitPrice: 300, totalPrice: 300, sortOrder: 4 },
    { name: 'Mühendislik Maliyeti', category: OtherCostCategory.ENGINEERING,
      quantity: 1, unit: 'kalem', unitPrice: 200, totalPrice: 200, sortOrder: 5 },
  ]
  const othSum = 1200

  // —— Özet cache (Excel formül hatası düzeltildikten sonra yeniden hesaplanmış) ——
  const MAT_COST       = matSum                       // 4210 (Excel: 4450, ORTA AYAK düzeltmesi -240)
  const LAB_COST       = labSum                       // 1634
  const EXT_COST       = extSum                       // 1500
  const OTH_COST       = othSum                       // 1200
  const SUBTOTAL       = MAT_COST + LAB_COST + EXT_COST + OTH_COST  // 8544
  const OVERHEAD_RATE  = 25
  const OVERHEAD_AMT   = SUBTOTAL * OVERHEAD_RATE / 100             // 2136
  const TOTAL_COST     = SUBTOTAL + OVERHEAD_AMT                    // 10680
  const PROFIT_RATE    = 60
  const PROFIT_AMT     = TOTAL_COST * PROFIT_RATE / 100             // 6408
  const SALES_PRICE    = TOTAL_COST + PROFIT_AMT                    // 17088
  const FINISHED_WT    = 955
  const PRICE_PER_KG   = SALES_PRICE / FINISHED_WT                  // 17.89...

  console.log(`\n📐 Aritmetik kontrol (formül hatası düzeltilmiş):`)
  console.log(`   Malzeme parse:      €${matSum.toFixed(2)} (Excel hatalı: 4450)`)
  console.log(`   İç İşçilik parse:   €${labSum.toFixed(2)} (Excel: 1634)`)
  console.log(`   Dış Hizmet:         €${EXT_COST.toFixed(2)}`)
  console.log(`   Diğer:              €${OTH_COST.toFixed(2)}`)
  console.log(`   Subtotal:           €${SUBTOTAL.toFixed(2)} (Excel hatalı: 8784)`)
  console.log(`   Toplam Maliyet:     €${TOTAL_COST.toFixed(2)} (Excel hatalı: 10980)`)
  console.log(`   Satış Fiyatı:       €${SALES_PRICE.toFixed(2)} (Excel hatalı: 17568)`)
  console.log(`   CostLabor satırı:   ${laborCreates.length} (operasyon kırılımı)`)
  console.log(`   CostMaterial satır: ${materialCreates.length}`)

  const description = 'Roketsan Deflektör Montajı maliyet analizi. Kaynak: ROKETSAN MALİYET deflektör.xlsx.'

  // —— CostAnalysis ——
  const analysis = await prisma.costAnalysis.create({
    data: {
      code: '8513',
      name: 'Deflektör Montajı',
      description,
      revision: 'Rev.00',
      revisionNumber: 0,
      revisionNote: 'İlk revizyon – Excel aktarımı (08.03.2026 teklif, formül hatası düzeltildi)',
      revisionDate: new Date('2026-03-08'),
      isLatest: true,
      finishedWeight: FINISHED_WT,
      currency: CostCurrency.EUR,

      materialCost:    MAT_COST,
      laborCost:       LAB_COST,
      externalCost:    EXT_COST,
      otherCost:       OTH_COST,
      subtotal:        SUBTOTAL,
      overheadRate:    OVERHEAD_RATE,
      overheadAmount:  OVERHEAD_AMT,
      totalCost:       TOTAL_COST,
      profitRate:      PROFIT_RATE,
      profitAmount:    PROFIT_AMT,
      salesPrice:      SALES_PRICE,
      pricePerKg:      PRICE_PER_KG,

      status:          CostAnalysisStatus.APPROVED,
      approvedById:    creator.id,
      approvedAt:      new Date('2026-03-08'),
      createdById:     creator.id,

      materials:        { create: materialCreates },
      laborItems:       { create: laborCreates },
      externalServices: { create: externalCreates },
      otherCosts:       { create: otherCreates },
    },
  })

  console.log(`\n✅ CostAnalysis oluşturuldu:`)
  console.log(`   ID            : ${analysis.id}`)
  console.log(`   Kod / Ad      : ${analysis.code} / ${analysis.name}`)
  console.log(`   Malzeme       : ${materialCreates.length} kalem → €${analysis.materialCost}`)
  console.log(`   İç İşçilik    : ${laborCreates.length} satır → €${analysis.laborCost}`)
  console.log(`   Dış Hizmet    : ${externalCreates.length} kalem → €${analysis.externalCost}`)
  console.log(`   Diğer         : ${otherCreates.length} kalem → €${analysis.otherCost}`)
  console.log(`   Subtotal      : €${analysis.subtotal}`)
  console.log(`   Toplam Mal.   : €${analysis.totalCost}`)
  console.log(`   SATIŞ FİYATI  : €${analysis.salesPrice}`)
  console.log(`   Kg Fiyatı     : €${analysis.pricePerKg}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
