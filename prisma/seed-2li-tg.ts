import {
  PrismaClient,
  UserRoleEnum as Role,
  CostCurrency,
  CostAnalysisStatus,
  MaterialCostCategory,
  CostLaborType,
  OtherCostCategory,
} from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // —— 1. Oluşturacak kullanıcıyı bul (ilk IT_MANAGER veya SUPER_ADMIN) ——
  const creator = await prisma.user.findFirst({
    where: { role: { in: [Role.IT_MANAGER, Role.SUPER_ADMIN, Role.ADMIN] }, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!creator) {
    throw new Error('Seed için uygun kullanıcı bulunamadı. Önce bir kullanıcı oluşturun.')
  }

  console.log(`✅ Oluşturan kullanıcı: ${creator.email}`)

  // —— 2. Varsa temizle (idempotent çalıştırma için) ——
  const mevcut = await prisma.costAnalysis.findFirst({
    where: { code: '2910', revisionNumber: 0 },
  })

  if (mevcut) {
    await prisma.costAnalysis.delete({ where: { id: mevcut.id } })
    console.log('🗑️  Önceki kayıt silindi.')
  }

  // —— 3. Ana CostAnalysis kaydını oluştur ——
  const analysis = await prisma.costAnalysis.create({
    data: {
      code: '2910',
      name: '2 Li TG',
      description: 'Roketsan 2\'li Taşıma Grubu maliyet analizi. Kaynak: Excel ROKETSAN_MALİYET_EXCELL_2_Li_TG_SON.',
      revision: 'Rev.00',
      revisionNumber: 0,
      revisionNote: 'İlk revizyon – Excel aktarımı',
      revisionDate: new Date('2024-01-01'),
      isLatest: true,
      finishedWeight: 800,           // kg
      currency: CostCurrency.EUR,

      // —— Hesaplanan maliyet kalemleri (cache) ——
      materialCost: 6866,
      laborCost: 11890,
      externalCost: 0,
      otherCost: 4350,
      subtotal: 23106,

      // —— Genel gider ve kar ——
      overheadRate: 25,              // %25
      overheadAmount: 5776.50,
      totalCost: 28882.50,
      profitRate: 71.8,              // %71.8 (Roketsan müzakere oranı)
      profitAmount: 20737.64,
      salesPrice: 49620.14,
      pricePerKg: 62.03,             // €/kg

      status: CostAnalysisStatus.APPROVED,
      approvedById: creator.id,
      approvedAt: new Date('2024-01-01'),
      createdById: creator.id,

      // —— Alt tablolar ——
      materials: {
        create: [
          // ——— MALZEME KALEMLERİ ———
          {
            name: '100x100x3 Profil',
            specification: 'ST 52',
            category: MaterialCostCategory.RAW_MATERIAL,
            unit: 'kg',
            currency: CostCurrency.EUR,
            grossQuantity: 12,
            wasteRate: 0,
            netQuantity: 12,
            unitPrice: 8,
            totalPrice: 96,
            sortOrder: 1,
          },
          {
            name: '150x100x6 Profil',
            specification: 'ST 52',
            category: MaterialCostCategory.RAW_MATERIAL,
            unit: 'kg',
            currency: CostCurrency.EUR,
            grossQuantity: 6,
            wasteRate: 0,
            netQuantity: 6,
            unitPrice: 20,
            totalPrice: 120,
            sortOrder: 2,
          },
          {
            name: 'Üst Takoz',
            specification: 'ST 52',
            category: MaterialCostCategory.SEMI_FINISHED,
            unit: 'adet',
            currency: CostCurrency.EUR,
            grossQuantity: 3,
            wasteRate: 0,
            netQuantity: 3,
            unitPrice: 700,
            totalPrice: 2100,
            sortOrder: 3,
          },
          {
            name: 'Ön Ayak',
            specification: 'ST 52',
            category: MaterialCostCategory.SEMI_FINISHED,
            unit: 'adet',
            currency: CostCurrency.EUR,
            grossQuantity: 2,
            wasteRate: 0,
            netQuantity: 2,
            unitPrice: 350,
            totalPrice: 700,
            sortOrder: 4,
          },
          {
            name: 'Arka Ayak',
            specification: 'ST 52',
            category: MaterialCostCategory.SEMI_FINISHED,
            unit: 'adet',
            currency: CostCurrency.EUR,
            grossQuantity: 2,
            wasteRate: 0,
            netQuantity: 2,
            unitPrice: 350,
            totalPrice: 700,
            sortOrder: 5,
          },
          {
            name: 'Dayama Takozları',
            specification: 'ST 52',
            category: MaterialCostCategory.SEMI_FINISHED,
            unit: 'adet',
            currency: CostCurrency.EUR,
            grossQuantity: 12,
            wasteRate: 0,
            netQuantity: 8,
            unitPrice: 150,
            totalPrice: 1800,
            sortOrder: 6,
          },
          {
            name: '5 mm Sac',
            specification: 'ST 52',
            category: MaterialCostCategory.RAW_MATERIAL,
            unit: 'kg',
            currency: CostCurrency.EUR,
            grossQuantity: 180,
            wasteRate: 0,
            netQuantity: 34,
            unitPrice: 1.5,
            totalPrice: 270,
            sortOrder: 7,
          },
          {
            name: '8 mm Sac',
            specification: 'ST 52',
            category: MaterialCostCategory.RAW_MATERIAL,
            unit: 'kg',
            currency: CostCurrency.EUR,
            grossQuantity: 290,
            wasteRate: 0,
            netQuantity: 16,
            unitPrice: 1.5,
            totalPrice: 435,
            sortOrder: 8,
          },
          {
            name: '12 mm Sac',
            specification: 'ST 52',
            category: MaterialCostCategory.RAW_MATERIAL,
            unit: 'kg',
            currency: CostCurrency.EUR,
            grossQuantity: 430,
            wasteRate: 0,
            netQuantity: 4,
            unitPrice: 1.5,
            totalPrice: 645,
            sortOrder: 9,
          },
        ],
      },

      laborItems: {
        create: [
          // ——— İÇ İŞÇİLİK – MALZEME SATIRLARINDAN ———
          {
            operationName: '100x100x3 Profil - CNC İşçilik',
            workCenter: 'CNC',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 120,
            totalTime: 120,
            hourlyRate: 1,
            totalCost: 120,
            sortOrder: 1,
          },
          {
            operationName: '150x100x6 Profil - CNC İşçilik',
            workCenter: 'CNC',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 60,
            totalTime: 60,
            hourlyRate: 1,
            totalCost: 60,
            sortOrder: 2,
          },
          {
            operationName: '5 mm Sac - Lazer İşçilik',
            workCenter: 'Lazer',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 170,
            totalTime: 170,
            hourlyRate: 1,
            totalCost: 170,
            sortOrder: 3,
          },
          {
            operationName: '8 mm Sac - Lazer İşçilik',
            workCenter: 'Lazer',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 160,
            totalTime: 160,
            hourlyRate: 1,
            totalCost: 160,
            sortOrder: 4,
          },
          {
            operationName: '12 mm Sac - Lazer İşçilik',
            workCenter: 'Lazer',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 60,
            totalTime: 60,
            hourlyRate: 1,
            totalCost: 60,
            sortOrder: 5,
          },
          // ——— İÇ İŞÇİLİK – OPERASYON SATIRLARINDAN ———
          {
            operationName: 'Kumlama + Kataforez - İç İşçilik',
            workCenter: 'Yüzey İşleme',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 1500,
            totalTime: 1500,
            hourlyRate: 1,
            totalCost: 1500,
            sortOrder: 6,
          },
          {
            operationName: 'Boya + İşçilik - İç İşçilik',
            workCenter: 'Boya',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 4320,
            totalTime: 4320,
            hourlyRate: 1,
            totalCost: 4320,
            sortOrder: 7,
          },
          {
            operationName: 'Kaynak İşçilik',
            workCenter: 'Kaynak',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 3000,
            totalTime: 3000,
            hourlyRate: 1,
            totalCost: 3000,
            sortOrder: 8,
          },
          {
            operationName: 'Borwerk İşçilik',
            workCenter: 'Borwerk',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 2000,
            totalTime: 2000,
            hourlyRate: 1,
            totalCost: 2000,
            sortOrder: 9,
          },
          {
            operationName: 'Gerilim Giderme + NDT',
            workCenter: 'NDT',
            laborType: CostLaborType.INTERNAL,
            setupTime: 0,
            processTime: 500,
            totalTime: 500,
            hourlyRate: 1,
            totalCost: 500,
            sortOrder: 10,
          },
        ],
      },

      otherCosts: {
        create: [
          // ——— DİĞER MALİYETLER ———
          {
            name: 'Montaj İşçiliği',
            category: OtherCostCategory.ASSEMBLY_LABOR,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 300,
            totalPrice: 300,
            sortOrder: 1,
          },
          {
            name: 'Merkezleme Pimleri',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 6,
            unit: 'adet',
            unitPrice: 50,
            totalPrice: 300,
            sortOrder: 2,
          },
          {
            name: 'Gözlü Civata',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 6,
            unit: 'adet',
            unitPrice: 60,
            totalPrice: 360,
            sortOrder: 3,
          },
          {
            name: 'Gözlü Civata Pimi',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 6,
            unit: 'adet',
            unitPrice: 45,
            totalPrice: 270,
            sortOrder: 4,
          },
          {
            name: 'Somun',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 12,
            unit: 'adet',
            unitPrice: 2,
            totalPrice: 24,
            sortOrder: 5,
          },
          {
            name: 'Sızdırmazlık Burcu',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 12,
            unit: 'adet',
            unitPrice: 5,
            totalPrice: 60,
            sortOrder: 6,
          },
          {
            name: 'Diğer Bağlantı Elemanları',
            description: 'Excel Sayfa2 ile özet tablo arasındaki 74€ farkını karşılar.',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 74,
            totalPrice: 74,
            sortOrder: 7,
          },
          {
            name: 'Diğer Sarf (12 adet)',
            category: OtherCostCategory.CONNECTION_PARTS,
            quantity: 12,
            unit: 'adet',
            unitPrice: 1,
            totalPrice: 12,
            sortOrder: 8,
          },
          {
            name: 'Ölçüm ve Kalite Kontrol Maliyeti',
            category: OtherCostCategory.QUALITY_CONTROL,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 1000,
            totalPrice: 1000,
            sortOrder: 9,
          },
          {
            name: 'Nakliye',
            category: OtherCostCategory.TRANSPORT,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 750,
            totalPrice: 750,
            sortOrder: 10,
          },
          {
            name: 'Ambalaj',
            category: OtherCostCategory.PACKAGING,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 200,
            totalPrice: 200,
            sortOrder: 11,
          },
          {
            name: 'Mühendislik Maliyeti',
            category: OtherCostCategory.ENGINEERING,
            quantity: 1,
            unit: 'kalem',
            unitPrice: 1000,
            totalPrice: 1000,
            sortOrder: 12,
          },
        ],
      },
    },
  })

  console.log(`\n✅ CostAnalysis oluşturuldu:`)
  console.log(`   Kod    : ${analysis.code}`)
  console.log(`   Ad     : ${analysis.name}`)
  console.log(`   Malzeme: €${analysis.materialCost}`)
  console.log(`   İşçilik: €${analysis.laborCost}`)
  console.log(`   Diğer  : €${analysis.otherCost}`)
  console.log(`   Toplam : €${analysis.totalCost}`)
  console.log(`   Satış  : €${analysis.salesPrice}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
