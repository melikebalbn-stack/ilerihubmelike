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

// —— Yardımcı: null/undefined/NaN → 0 ——
const n = (v: any): number => {
  const f = parseFloat(v)
  return isNaN(f) ? 0 : f
}

// —— Excel parse ——
function readExcel() {
  const filePath = path.join(__dirname, 'ROKETSAN MALİYET 2 Lİ LANÇER.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['Sayfa1']
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  return rows
}

// —— Parça koduna göre malzeme kategorisi ——
function matCategory(kod: string | null): MaterialCostCategory {
  if (!kod) return MaterialCostCategory.PURCHASED_PART
  const k = String(kod).trim()
  if (k.startsWith('VI-')) return MaterialCostCategory.PURCHASED_PART
  return MaterialCostCategory.SEMI_FINISHED
}

// —— Malzeme adından birim tahmini ——
function guessUnit(name: string): string {
  const lname = name.toLowerCase()
  if (lname.includes('screw') || lname.includes('somun') || lname.includes('pul') ||
      lname.includes('perçin') || lname.includes('saplama') || lname.includes('helicoil') ||
      lname.includes('link') || lname.includes('burç') || lname.includes('yay') ||
      lname.includes('mapa') || lname.includes('plaka') || lname.includes('bağlantı') ||
      lname.includes('çerçeve') || lname.includes('kaporta') || lname.includes('kapak')) {
    return 'adet'
  }
  if (lname.includes('yapıştırıcı') || lname.includes('silikon') || lname.includes('boya') ||
      lname.includes('tiner') || lname.includes('astar') || lname.includes('mürekkep')) {
    return 'ml'
  }
  return 'adet'
}

async function main() {
  // —— 1. Kullanıcı ——
  const creator = await prisma.user.findFirst({
    where: { role: { in: [Role.IT_MANAGER, Role.SUPER_ADMIN, Role.ADMIN] }, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!creator) throw new Error('Seed için uygun kullanıcı bulunamadı.')
  console.log(`✅ Oluşturan: ${creator.email}`)

  // —— 2. Önceki kaydı temizle ——
  const mevcut = await prisma.costAnalysis.findFirst({
    where: { code: '250293', revisionNumber: 0 },
  })
  if (mevcut) {
    await prisma.costAnalysis.delete({ where: { id: mevcut.id } })
    console.log('🗑️  Önceki kayıt silindi.')
  }

  // —— 3. Excel'i oku ——
  const rows = readExcel()
  console.log(`📊 Excel okundu: ${rows.length} satır`)

  // —— 4. Malzeme, İşçilik ve Dış Hizmet kalemlerini parse et ——
  const VERI_BASLANGIC = 3
  const VERI_BITIS     = 139

  const materialCreates: any[] = []
  const laborCreates: any[]    = []
  const externalCreates: any[] = []

  let matSum   = 0
  let labSum   = 0
  let extSum   = 0

  for (let i = VERI_BASLANGIC; i <= VERI_BITIS; i++) {
    const row = rows[i]
    if (!row) continue

    const parcaKodu   = row[0]  != null ? String(row[0]).trim() : null
    const parcaAdi    = row[1]  != null ? String(row[1]).trim() : null
    const malzeme     = row[5]  != null ? String(row[5]).trim() : null
    const birimFiyat  = n(row[6])
    const toplamMat   = n(row[7])
    const toplamLab   = n(row[15])
    const toplamExt   = n(row[23])

    if (!parcaAdi) continue

    const sira = i - VERI_BASLANGIC + 1

    // ——— CostMaterial ———
    if (toplamMat > 0) {
      const grossQty = n(row[4]) || n(row[3]) || n(row[2]) || 1
      const netQty   = n(row[3]) || grossQty

      materialCreates.push({
        materialCode: parcaKodu,
        name: parcaAdi,
        specification: malzeme,
        category: matCategory(parcaKodu),
        unit: guessUnit(parcaAdi),
        currency: CostCurrency.EUR,
        grossQuantity: grossQty > 0 ? grossQty : 1,
        wasteRate: 0,
        netQuantity: netQty > 0 ? netQty : 1,
        unitPrice: birimFiyat > 0 ? birimFiyat : toplamMat,
        totalPrice: toplamMat,
        sortOrder: sira,
      })
      matSum += toplamMat
    }

    // ——— CostLabor ———
    if (toplamLab > 0) {
      laborCreates.push({
        operationName: `${parcaAdi} - İç İşçilik`,
        workCenter: n(row[8]) > 0 ? 'CNC' : n(row[9]) > 0 ? 'Lazer' : 'Genel',
        laborType: CostLaborType.INTERNAL,
        setupTime: 0,
        processTime: toplamLab,
        totalTime: toplamLab,
        hourlyRate: 1,
        totalCost: toplamLab,
        sortOrder: sira,
      })
      labSum += toplamLab
    }

    // ——— CostExternalService ———
    if (toplamExt > 0) {
      externalCreates.push({
        serviceName: `${parcaAdi} - Yüzey İşlemi`,
        serviceType: CostServiceType.SURFACE_TREATMENT,
        quantity: 1,
        unit: 'adet',
        unitPrice: toplamExt,
        totalPrice: toplamExt,
        sortOrder: sira,
      })
      extSum += toplamExt
    }
  }

  console.log(`\n📦 Parse edilen:`)
  console.log(`   Malzeme     : ${materialCreates.length} kalem → €${matSum.toFixed(3)}`)
  console.log(`   İç İşçilik  : ${laborCreates.length} kalem → €${labSum.toFixed(3)}`)
  console.log(`   Dış Hizmet  : ${externalCreates.length} kalem → €${extSum.toFixed(3)}`)

  // —— 5. Sabit özet değerleri (Excel'den) ——
  const MAT_COST  = 6775.342
  const LAB_COST  = 1030.6
  const EXT_COST  = 325.303
  const OTH_COST  = 2800
  const SUBTOTAL  = 10931.245
  const OVERHEAD_RATE   = 22
  const OVERHEAD_AMOUNT = 2404.8739
  const TOTAL_COST      = 13336.1189
  const PROFIT_RATE     = 50
  const PROFIT_AMOUNT   = 6668.0595
  const SALES_PRICE     = 20004.1783

  // —— 6. CostAnalysis oluştur ——
  const analysis = await prisma.costAnalysis.create({
    data: {
      code: '250293',
      name: 'İkili Lançer',
      description: 'Roketsan İkili Lançer (CAPS-2 Pod) maliyet analizi. Kaynak: ROKETSAN_MALİYET_2_Lİ_LANÇER.xlsx.',
      revision: 'Rev.00',
      revisionNumber: 0,
      revisionNote: 'İlk revizyon – Excel aktarımı',
      revisionDate: new Date('2024-01-01'),
      isLatest: true,
      finishedWeight: 0,
      currency: CostCurrency.EUR,

      materialCost:    MAT_COST,
      laborCost:       LAB_COST,
      externalCost:    EXT_COST,
      otherCost:       OTH_COST,
      subtotal:        SUBTOTAL,
      overheadRate:    OVERHEAD_RATE,
      overheadAmount:  OVERHEAD_AMOUNT,
      totalCost:       TOTAL_COST,
      profitRate:      PROFIT_RATE,
      profitAmount:    PROFIT_AMOUNT,
      salesPrice:      SALES_PRICE,
      pricePerKg:      0,

      status:          CostAnalysisStatus.APPROVED,
      approvedById:    creator.id,
      approvedAt:      new Date('2024-01-01'),
      createdById:     creator.id,

      materials: { create: materialCreates },
      laborItems: { create: laborCreates },
      externalServices: { create: externalCreates },

      otherCosts: {
        create: [
          {
            name: 'Montaj İşçiliği',
            category: OtherCostCategory.ASSEMBLY_LABOR,
            quantity: 1, unit: 'kalem', unitPrice: 1000, totalPrice: 1000, sortOrder: 1,
          },
          {
            name: 'Ölçüm ve Kalite Kontrol Maliyeti',
            category: OtherCostCategory.QUALITY_CONTROL,
            quantity: 1, unit: 'kalem', unitPrice: 500, totalPrice: 500, sortOrder: 2,
          },
          {
            name: 'Nakliye',
            category: OtherCostCategory.TRANSPORT,
            quantity: 1, unit: 'kalem', unitPrice: 500, totalPrice: 500, sortOrder: 3,
          },
          {
            name: 'Ambalaj',
            category: OtherCostCategory.PACKAGING,
            quantity: 1, unit: 'kalem', unitPrice: 300, totalPrice: 300, sortOrder: 4,
          },
          {
            name: 'Mühendislik Maliyeti',
            category: OtherCostCategory.ENGINEERING,
            quantity: 1, unit: 'kalem', unitPrice: 500, totalPrice: 500, sortOrder: 5,
          },
        ],
      },
    },
  })

  console.log(`\n✅ CostAnalysis oluşturuldu:`)
  console.log(`   Kod          : ${analysis.code}`)
  console.log(`   Ad           : ${analysis.name}`)
  console.log(`   Malzeme      : €${analysis.materialCost}`)
  console.log(`   İç İşçilik   : €${analysis.laborCost}`)
  console.log(`   Dış Hizmet   : €${analysis.externalCost}`)
  console.log(`   Diğer        : €${analysis.otherCost}`)
  console.log(`   Ara Toplam   : €${analysis.subtotal}`)
  console.log(`   GG (%${analysis.overheadRate})   : €${analysis.overheadAmount}`)
  console.log(`   Toplam Maliyet: €${analysis.totalCost}`)
  console.log(`   Kar (%${analysis.profitRate})     : €${analysis.profitAmount}`)
  console.log(`   SATIŞ FİYATI : €${analysis.salesPrice}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
