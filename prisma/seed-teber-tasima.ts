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
  const filePath = path.join(__dirname, 'ROKETSAN MALİYET TEBER TAŞIMA.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['Sayfa1']
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  return rows
}

function matCategory(kod: string | null, cinsi: string | null): MaterialCostCategory {
  const c = (cinsi || '').toLowerCase()
  if (c.includes('bağlantı')) return MaterialCostCategory.STANDARD_PART
  if (c.includes('sarf')) return MaterialCostCategory.CONSUMABLE
  if (c.includes('fason') || c.includes('kauçuk') || c.includes('tedarik')) {
    return MaterialCostCategory.PURCHASED_PART
  }
  if (c.includes('talaşlı') || c.includes('mekanik')) {
    return MaterialCostCategory.SEMI_FINISHED
  }
  if (!kod) return MaterialCostCategory.SEMI_FINISHED
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
    where: { code: '262902', revisionNumber: 0 },
  })
  if (mevcut) {
    await prisma.costAnalysis.delete({ where: { id: mevcut.id } })
    console.log(`🗑️  Önceki "262902" kaydı silindi (id: ${mevcut.id}).`)
  }

  const rows = readExcel()
  console.log(`📊 Excel okundu: ${rows.length} satır`)

  // R4 = grup başlığı (00262902 Teber Taşıma Ve Kuyruk Bütünleme Aparatı)
  // R5–R56 (idx 4–55) = parça satırları
  // R57 = boş, R58 = KOMPLE KAYNAK-MONTAJ-HAZIRLIK
  const VERI_BASLANGIC = 4
  const VERI_BITIS     = 55

  const materialCreates: any[] = []
  const laborCreates: any[]    = []
  let matSum  = 0
  let labSum  = 0
  let labSira = 0
  let matSira = 0

  for (let i = VERI_BASLANGIC; i <= VERI_BITIS; i++) {
    const row = rows[i]
    if (!row) continue

    const parcaKodu  = row[0] != null ? String(row[0]).trim() : null
    const parcaAdi   = row[1] != null ? String(row[1]).trim() : null
    const parcaAgRaw = row[2]
    const parcaAg    = n(parcaAgRaw)
    const adetRaw    = row[3]
    const adet       = n(adetRaw) || 1
    const toplamAg   = n(row[4])
    const cinsi      = row[5] != null ? String(row[5]).trim() : null
    const birimFiyat = n(row[6])
    const excelTotal = n(row[7])

    if (!parcaAdi) continue

    // R4 (00262902 üst başlık) – atla
    if (parcaKodu === '00262902') {
      console.log(`   ⏭️  R${i+1} grup başlığı atlandı: ${parcaKodu} ${parcaAdi}`)
      continue
    }

    // ——— CostMaterial ———
    if (cinsi || birimFiyat > 0 || excelTotal > 0) {
      matSira++

      // Net miktar
      let grossQty = 0
      let unitLabel = 'adet'
      if (toplamAg > 0) {
        grossQty = toplamAg
        // C numerik (kg/adet) → E ağırlık → unit='kg'
        // C metin (örn "600 mm", "Talaşlı İmalat") → E hâlâ kg cinsinden ağırlık → unit='kg'
        // C boş/0 ve metin değil → E adet → unit='adet'
        const cIsText = typeof parcaAgRaw === 'string' && parcaAgRaw.trim().length > 0
        const cHasMmHint = cIsText && /\bmm\b/i.test(parcaAgRaw as string)
        if (parcaAg > 0 || cHasMmHint) {
          unitLabel = 'kg'
        } else if (cIsText) {
          // C metin ama mm geçmiyor (Talaşlı İmalat / Fason Tedarik / Bağlantı Elemanı / Kauçuk İmalat / Sarf Malzeme)
          // → E genelde adet sayısı (D=E pattern'ı: bağlantı elemanları, fason tedarik)
          unitLabel = 'adet'
        } else {
          unitLabel = 'adet'
        }
      } else {
        grossQty = adet
      }

      // D string ise (R43: "2-500MM" gibi) – 171277 boya kiti pattern'ı
      if (typeof adetRaw === 'string' && /[a-zA-Z]/.test(adetRaw)) {
        grossQty = 1
        unitLabel = adetRaw.trim()
      }

      // C sütunu metinse (Talaşlı İmalat / Fason Tedarik / 600 mm / Bağlantı Elemanı …) →
      // specification olarak koru. Numerikse "X kg/adet" ya da "X mm/adet" notu.
      let cText: string | null = null
      if (typeof parcaAgRaw === 'string' && parcaAgRaw.trim()) {
        cText = parcaAgRaw.trim()
      } else if (parcaAg > 0) {
        cText = `${parcaAg} ${parcaAg < 10 ? 'kg/adet' : 'mm/adet'}`
      }
      const spec = [cinsi, cText].filter(Boolean).join(' • ') || null

      // Excel formülü: H = E×G (E varsa), aksi halde D×G
      const computed = birimFiyat > 0
        ? (toplamAg > 0 ? toplamAg * birimFiyat : adet * birimFiyat)
        : 0

      if (excelTotal > 0 && computed > 0 && Math.abs(computed - excelTotal) > 0.01) {
        console.log(
          `   ⚠️  R${i+1} Excel anomali: ${parcaAdi} → Excel H=€${excelTotal}, ` +
          `formül=€${computed.toFixed(2)}. Excel değeri kullanılıyor.`
        )
      }

      // C×D ≠ E tutarsızlığı (Excel'in kendi içinde): R17 (Uzun Yan Destek), R20 (V Yatak) gibi
      if (typeof parcaAgRaw === 'number' && parcaAg > 0 && toplamAg > 0
          && Math.abs(parcaAg * adet - toplamAg) > 0.01) {
        console.log(
          `   ⚠️  R${i+1} C×D≠E (Excel iç tutarsızlık): ${parcaAdi} → ` +
          `C=${parcaAg}×D=${adet}=${(parcaAg*adet).toFixed(3)} ama E=${toplamAg}. ` +
          `Excel'in E değeri kullanılıyor (fire/yığın veya birim karışıklığı olabilir).`
        )
      }

      const finalTotal = excelTotal > 0 ? excelTotal : computed

      materialCreates.push({
        materialCode: parcaKodu,
        name: parcaAdi,
        specification: spec,
        category: matCategory(parcaKodu, cinsi || (typeof parcaAgRaw === 'string' ? parcaAgRaw : null)),
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

    // ——— CostLabor (parça-bazlı operasyon kırılımı) ———
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
    }
  }

  // —— R58: KOMPLE KAYNAK-MONTAJ-HAZIRLIK (Kaynak 500, Hazırlık 200, Diğer 200) ——
  const KOMPLE_OPS = [
    { ad: 'Kaynak',   wc: 'Kaynak',   tutar: 500 },
    { ad: 'Hazırlık', wc: 'Hazırlık', tutar: 200 },
    { ad: 'Diğer',    wc: 'Diğer',    tutar: 200 },
  ]
  for (const op of KOMPLE_OPS) {
    labSira++
    laborCreates.push({
      operationName: `Komple - ${op.ad} (Montaj/Hazırlık)`,
      workCenter: op.wc,
      laborType: CostLaborType.ASSEMBLY,
      setupTime: 0,
      processTime: op.tutar,
      totalTime: op.tutar,
      hourlyRate: 1,
      totalCost: op.tutar,
      sortOrder: labSira,
    })
    labSum += op.tutar
  }

  console.log(`\n📦 Parse edilen:`)
  console.log(`   Malzeme    : ${materialCreates.length} kalem → €${matSum.toFixed(3)} (Excel: €3594.165)`)
  console.log(`   İç İşçilik : ${laborCreates.length} satır  → €${labSum.toFixed(3)} (Excel: €938.7)`)

  // —— Dış Hizmetler (R63: TOPLAM YÜZEY İŞLEMLERİ €400) ——
  const externalCreates: any[] = [
    {
      serviceName: 'Yüzey İşlemleri (Kumlama / Gerilim Giderme / Isıl İşlem / Kataforez / Boya)',
      description: 'Excel özet R63: TOPLAM YÜZEY İŞLEMLERİ €400.',
      serviceType: CostServiceType.SURFACE_TREATMENT,
      quantity: 1, unit: 'kalem',
      unitPrice: 400, totalPrice: 400, sortOrder: 1,
    },
  ]
  const EXT_COST = 400

  // —— Diğer Maliyetler (R64–R67) ——
  // 171277'deki R59 KAYNAK İŞÇİLİK kalemi TEBER'de YOK (R58 iç işçilik altında).
  const otherCreates: any[] = [
    {
      name: 'Ölçüm ve Kalite Kontrol Maliyeti',
      description: 'Excel özet R64: ÖLÇÜM VE KALİTE KONT. MALİYETİ €200',
      category: OtherCostCategory.QUALITY_CONTROL,
      quantity: 1, unit: 'kalem', unitPrice: 200, totalPrice: 200, sortOrder: 1,
    },
    {
      name: 'Nakliye',
      description: 'Excel özet R65: NAKLİYE €100',
      category: OtherCostCategory.TRANSPORT,
      quantity: 1, unit: 'kalem', unitPrice: 100, totalPrice: 100, sortOrder: 2,
    },
    {
      name: 'Ambalaj',
      description: 'Excel özet R66: AMBALAJ €50',
      category: OtherCostCategory.PACKAGING,
      quantity: 1, unit: 'kalem', unitPrice: 50, totalPrice: 50, sortOrder: 3,
    },
    {
      name: 'Mühendislik Maliyeti',
      description: 'Excel özet R67: MÜHENDİSLİK MALİYETİ €100',
      category: OtherCostCategory.ENGINEERING,
      quantity: 1, unit: 'kalem', unitPrice: 100, totalPrice: 100, sortOrder: 4,
    },
  ]
  const OTH_COST = 200 + 100 + 50 + 100 // 450

  // —— Özet ——
  const MAT_COST       = matSum                                 // 3594.165
  const LAB_COST       = labSum                                 // 938.7
  const SUBTOTAL       = MAT_COST + LAB_COST + EXT_COST + OTH_COST  // 5382.865
  const OVERHEAD_RATE  = 25
  const OVERHEAD_AMT   = SUBTOTAL * OVERHEAD_RATE / 100         // 1345.71625
  const TOTAL_COST     = SUBTOTAL + OVERHEAD_AMT                // 6728.58125
  const PROFIT_RATE    = 48.5
  const PROFIT_AMT     = TOTAL_COST * PROFIT_RATE / 100         // 3263.36190625
  const SALES_PRICE    = TOTAL_COST + PROFIT_AMT                // 9991.94315625
  const FINISHED_WT    = 0   // R73 Excel'de boş
  const PRICE_PER_KG   = 0   // R74 Excel'de boş

  console.log(`\n📐 Aritmetik:`)
  console.log(`   Malzeme      : €${MAT_COST.toFixed(3)}  (Excel: €3594.165)`)
  console.log(`   İç İşçilik   : €${LAB_COST.toFixed(3)}  (Excel: €938.7)`)
  console.log(`   Dış Hizmet   : €${EXT_COST.toFixed(2)}`)
  console.log(`   Diğer        : €${OTH_COST.toFixed(2)}`)
  console.log(`   Subtotal     : €${SUBTOTAL.toFixed(3)}  (Excel: €5382.865)`)
  console.log(`   GG (%${OVERHEAD_RATE}) : €${OVERHEAD_AMT.toFixed(5)}  (Excel: €1345.71625)`)
  console.log(`   Toplam Mal.  : €${TOTAL_COST.toFixed(5)}  (Excel: €6728.58125)`)
  console.log(`   Kar (%${PROFIT_RATE})  : €${PROFIT_AMT.toFixed(5)}  (Excel: €3263.36190625)`)
  console.log(`   SATIŞ FİYATI : €${SALES_PRICE.toFixed(5)}  (Excel: €9991.94315625)`)

  const description = 'Roketsan Teber Taşıma Ve Kuyruk Bütünleme Aparatı maliyet analizi. Kaynak: ROKETSAN MALİYET TEBER TAŞIMA.xlsx.'

  // —— CostAnalysis oluştur ——
  const analysis = await prisma.costAnalysis.create({
    data: {
      code: '262902',
      name: 'Teber Taşıma Ve Kuyruk Bütünleme Aparatı',
      description,
      revision: 'Rev.00',
      revisionNumber: 0,
      revisionNote: 'İlk revizyon – Excel aktarımı (TEBER TAŞIMA)',
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
