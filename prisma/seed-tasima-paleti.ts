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
  const filePath = path.join(__dirname, 'ROKETSAN MALİYET 171277 TASIMA PALETİ.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['Sayfa1']
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  return rows
}

function matCategory(kod: string | null, malzeme: string | null): MaterialCostCategory {
  const lmal = (malzeme || '').toLowerCase()
  if (lmal.includes('standart')) return MaterialCostCategory.STANDARD_PART
  if (!kod) return MaterialCostCategory.PURCHASED_PART
  const k = String(kod).trim()
  if (k.startsWith('VI-') || k.startsWith('MP') || k.startsWith('PT')) {
    return MaterialCostCategory.PURCHASED_PART
  }
  return MaterialCostCategory.SEMI_FINISHED
}

const OPERASYONLAR = [
  { idx: 8,  ad: 'CNC',                wc: 'CNC' },
  { idx: 9,  ad: 'Lazer',              wc: 'Lazer' },
  { idx: 10, ad: 'Matkap/Pres/Tester', wc: 'Matkap/Pres/Tester' },
  { idx: 11, ad: 'Abkant',             wc: 'Abkant' },
  { idx: 12, ad: 'Kaynak',             wc: 'Kaynak' },
  { idx: 13, ad: 'Hazırlık',           wc: 'Hazırlık' },
  { idx: 14, ad: 'Diğer',              wc: 'Diğer' },
] as const

async function main() {
  const creator = await prisma.user.findFirst({
    where: { role: { in: [Role.IT_MANAGER, Role.SUPER_ADMIN, Role.ADMIN] }, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!creator) throw new Error('Seed için uygun kullanıcı bulunamadı.')
  console.log(`✅ Oluşturan: ${creator.email}`)

  const mevcut = await prisma.costAnalysis.findFirst({
    where: { code: '171277', revisionNumber: 0 },
  })
  if (mevcut) {
    await prisma.costAnalysis.delete({ where: { id: mevcut.id } })
    console.log(`🗑️  Önceki "171277" kaydı silindi (id: ${mevcut.id}).`)
  }

  const rows = readExcel()
  console.log(`📊 Excel okundu: ${rows.length} satır`)

  // R4–R53 (idx 3–52) arasındaki veri satırları
  const VERI_BASLANGIC = 3
  const VERI_BITIS     = 52

  const materialCreates: any[] = []
  const laborCreates: any[]    = []
  let matSum  = 0
  let labSum  = 0
  let labSira = 0
  let matSira = 0

  // Excel'in atlamadan dahil etmediği R5–R11 satırlarını izlemek için
  const duzeltilenSatirlar: string[] = []

  for (let i = VERI_BASLANGIC; i <= VERI_BITIS; i++) {
    const row = rows[i]
    if (!row) continue

    const parcaKodu  = row[0] != null ? String(row[0]).trim() : null
    const parcaAdi   = row[1] != null ? String(row[1]).trim() : null
    const parcaAg    = n(row[2])
    const adet       = n(row[3]) || 1
    const toplamAg   = n(row[4])
    const malzeme    = row[5] != null ? String(row[5]).trim() : null
    const birimFiyat = n(row[6])
    const excelTotal = n(row[7])
    const toplamLab  = n(row[15])

    if (!parcaAdi) continue

    // R4 (KAYNAKLI KOMPLE üst başlık) – sadece grup başlığı, atla
    if (parcaKodu === '171626' && i === 3) {
      console.log(`   ⏭️  R${i+1} grup başlığı atlandı: ${parcaKodu} ${parcaAdi}`)
      continue
    }

    // R23 (ALT TABLA ÇAPRAZ DESTEK 189542) – tüm fiyat/işçilik null
    if (birimFiyat <= 0 && excelTotal <= 0 && toplamLab <= 0 && !malzeme) {
      console.log(`   ⚠️  R${i+1} eksik veri (sadece adet): ${parcaKodu} ${parcaAdi} – atlandı`)
      continue
    }

    // ——— CostMaterial ———
    // Excel formülü: E (toplam ağırlık) varsa H = E×G, yoksa H = D×G
    // Boya kitleri (R45–R48): D string ("2.1KG"), G null → fiyat 0 ile bilgi olarak ekle
    if (malzeme || birimFiyat > 0) {
      matSira++

      // Net miktar belirleme
      let grossQty = 0
      let unitLabel = 'adet'
      if (toplamAg > 0) {
        grossQty = toplamAg
        unitLabel = parcaAg > 0 ? 'kg' : 'adet'
      } else {
        grossQty = adet
      }

      // D string ise (2.1KG vb.) – boya kitleri
      const dRaw = row[3]
      if (typeof dRaw === 'string' && /[a-zA-Z]/.test(dRaw)) {
        grossQty = 1
        unitLabel = dRaw.trim()
      }

      // Excel'in H sütunu (excelTotal) tek truth source — formül anomalileri korunur
      const computed = birimFiyat > 0
        ? (toplamAg > 0 ? toplamAg * birimFiyat : adet * birimFiyat)
        : 0

      // R28 gibi Excel anomalilerini tespit et ve raporla
      if (excelTotal > 0 && computed > 0 && Math.abs(computed - excelTotal) > 0.01) {
        console.log(
          `   ⚠️  R${i+1} Excel anomali: ${parcaAdi} → Excel H=€${excelTotal}, ` +
          `formül E×G=€${computed.toFixed(2)} (E=${toplamAg}, G=${birimFiyat}). ` +
          `Excel değeri kullanılıyor.`
        )
      }

      const finalTotal = excelTotal > 0 ? excelTotal : computed

      const spec = parcaAg > 0
        ? `${malzeme || ''} (${parcaAg} ${parcaAg < 10 ? 'kg/adet' : 'mm/adet'})`.trim()
        : malzeme

      materialCreates.push({
        materialCode: parcaKodu,
        name: parcaAdi,
        specification: spec,
        category: matCategory(parcaKodu, malzeme),
        unit: unitLabel,
        currency: CostCurrency.EUR,
        grossQuantity: grossQty > 0 ? grossQty : 1,
        wasteRate: 0,
        netQuantity: adet,
        unitPrice: birimFiyat,
        totalPrice: finalTotal,
        sortOrder: matSira,
      })
      matSum += finalTotal
    }

    // ——— CostLabor ———
    // Her operasyon ayrı satır, totalCost = (operasyon değeri) × adet
    // R5–R11: Excel P=null bırakmış, ancak I–O dolu → kırılımdan üret (formül hatası düzeltmesi)
    let satirLab = 0
    for (const op of OPERASYONLAR) {
      const val = n(row[op.idx])
      if (val <= 0) continue

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
      satirLab += opTotal
    }

    // Excel'in P sütununda atlanan ama kırılımdan üretilen satırları işaretle
    if (toplamLab <= 0 && satirLab > 0) {
      duzeltilenSatirlar.push(`R${i+1} ${parcaAdi}: +€${satirLab.toFixed(2)}`)
    }
  }

  console.log(`\n📦 Parse edilen:`)
  console.log(`   Malzeme    : ${materialCreates.length} kalem → €${matSum.toFixed(2)} (Excel: €11231.32)`)
  console.log(`   İç İşçilik : ${laborCreates.length} satır  → €${labSum.toFixed(2)} (Excel hatalı: €5138, doğru: €5204)`)
  if (duzeltilenSatirlar.length > 0) {
    console.log(`\n🔧 Excel formül hatası düzeltildi (P sütunu boş bırakılmış):`)
    duzeltilenSatirlar.forEach(s => console.log(`   ${s}`))
  }

  // —— Dış Hizmetler (R60: TOPLAM YÜZEY İŞLEMLERİ €3500) ——
  const externalCreates: any[] = [
    {
      serviceName: 'Yüzey İşlemleri (Kumlama / Gerilim Giderme / Isıl İşlem / Kataforez / Boya)',
      description: [
        'Excel özet: TOPLAM YÜZEY İŞLEMLERİ €3500.',
        'Boya kitleri (R45-R48) bu kalem içine dahildir, ayrı listelenmemiştir:',
        '  • VI-117651 PRIMER EPOXY MIL-DTL-53022E TYPE IV (2.1KG)',
        '  • VI-117652 PRIMER EPOXY HARDENER (1.3KG)',
        '  • PT1308-3 EPOKSI ASTAR BOYA TINERI (1.3LT)',
        '  • 197860 BOYA KİTİ MIL-DTL-64159 TYPE II CARC FS33531 (12,1 LT) – Alt: 00178584',
      ].join('\n'),
      serviceType: CostServiceType.SURFACE_TREATMENT,
      quantity: 1, unit: 'kalem',
      unitPrice: 3500, totalPrice: 3500, sortOrder: 1,
    },
  ]
  const EXT_COST = 3500

  // —— Diğer Maliyetler ——
  // R59 KAYNAK İŞÇİLİK (€1500) → ek montaj/kaynak kalemi
  // R61–R64: Ölçüm-Kalite, Nakliye, Ambalaj, Mühendislik
  const otherCreates: any[] = [
    {
      name: 'Kaynak İşçiliği',
      description: 'Excel özet R59: KAYNAK İŞÇİLİK €1500. Parça-bazlı iç işçilik kırılımının dışında ek kalem.',
      category: OtherCostCategory.ASSEMBLY_LABOR,
      quantity: 1, unit: 'kalem', unitPrice: 1500, totalPrice: 1500, sortOrder: 1,
    },
    {
      name: 'Ölçüm ve Kalite Kontrol Maliyeti',
      description: 'Excel özet R61: ÖLÇÜM VE KALİTE KONT. MALİYETİ €500',
      category: OtherCostCategory.QUALITY_CONTROL,
      quantity: 1, unit: 'kalem', unitPrice: 500, totalPrice: 500, sortOrder: 2,
    },
    {
      name: 'Nakliye',
      description: 'Excel özet R62: NAKLİYE €750',
      category: OtherCostCategory.TRANSPORT,
      quantity: 1, unit: 'kalem', unitPrice: 750, totalPrice: 750, sortOrder: 3,
    },
    {
      name: 'Ambalaj',
      description: 'Excel özet R63: AMBALAJ €100',
      category: OtherCostCategory.PACKAGING,
      quantity: 1, unit: 'kalem', unitPrice: 100, totalPrice: 100, sortOrder: 4,
    },
    {
      name: 'Mühendislik Maliyeti',
      description: 'Excel özet R64: MÜHENDİSLİK MALİYETİ €500',
      category: OtherCostCategory.ENGINEERING,
      quantity: 1, unit: 'kalem', unitPrice: 500, totalPrice: 500, sortOrder: 5,
    },
  ]
  const OTH_COST = 1500 + 500 + 750 + 100 + 500 // 3350

  // —— Özet (formül hatası düzeltilmiş) ——
  const MAT_COST       = matSum                                 // 11231.32
  const LAB_COST       = labSum                                 // 5438
  const SUBTOTAL       = MAT_COST + LAB_COST + EXT_COST + OTH_COST  // 23519.32
  const OVERHEAD_RATE  = 22
  const OVERHEAD_AMT   = SUBTOTAL * OVERHEAD_RATE / 100         // 5174.2504
  const TOTAL_COST     = SUBTOTAL + OVERHEAD_AMT                // 28693.5704
  const PROFIT_RATE    = 50
  const PROFIT_AMT     = TOTAL_COST * PROFIT_RATE / 100         // 14346.7852
  const SALES_PRICE    = TOTAL_COST + PROFIT_AMT                // 43040.3556
  const FINISHED_WT    = 0   // Excel R70 boş
  const PRICE_PER_KG   = 0

  console.log(`\n📐 Aritmetik:`)
  console.log(`   Malzeme      : €${MAT_COST.toFixed(2)}  (Excel: €11231.32)`)
  console.log(`   İç İşçilik   : €${LAB_COST.toFixed(2)}  (Excel hatalı: €5138, +€66 R5–R11 düzeltmesi)`)
  console.log(`   Dış Hizmet   : €${EXT_COST.toFixed(2)}`)
  console.log(`   Diğer        : €${OTH_COST.toFixed(2)}`)
  console.log(`   Subtotal     : €${SUBTOTAL.toFixed(2)}  (Excel hatalı: €23219.32)`)
  console.log(`   GG (%${OVERHEAD_RATE}) : €${OVERHEAD_AMT.toFixed(4)}`)
  console.log(`   Toplam Mal.  : €${TOTAL_COST.toFixed(4)}  (Excel hatalı: €28327.5704)`)
  console.log(`   Kar (%${PROFIT_RATE})  : €${PROFIT_AMT.toFixed(4)}`)
  console.log(`   SATIŞ FİYATI : €${SALES_PRICE.toFixed(4)}  (Excel hatalı: €42491.3556)`)

  const description = 'Roketsan Taşıma Paleti Komplesi maliyet analizi. Kaynak: ROKETSAN MALİYET 171277 TASIMA PALETİ.xlsx.'

  // —— CostAnalysis oluştur ——
  const analysis = await prisma.costAnalysis.create({
    data: {
      code: '171277',
      name: 'Taşıma Paleti Komplesi',
      description,
      revision: 'Rev.00',
      revisionNumber: 0,
      revisionNote: 'İlk revizyon – Excel aktarımı (D01, formül hatası düzeltildi)',
      revisionDate: new Date('2026-05-04'),
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
      approvedAt:      new Date('2026-05-04'),
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
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
