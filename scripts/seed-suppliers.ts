import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==========================================
// Tedarikçi Değerlendirme Kriterleri (FR_SA_01)
// ==========================================

const CRITERIA = [
  {
    code: 'K1',
    name: 'SLA Uyumu',
    description: 'SLA taahhütlerine uyuyor mu? (Her bir uygunsuzluk için 10 puan kesilir.)',
    maxScore: 50,
    sortOrder: 1,
  },
  {
    code: 'K2',
    name: 'Hizmet Kapsamı',
    description: 'Hizmet kapsamı ihtiyacımızı tam olarak karşılıyor mu?',
    maxScore: 10,
    sortOrder: 2,
  },
  {
    code: 'K3',
    name: 'Hizmet Yaklaşımı',
    description: 'SLA dışında, arıza durumlarında hizmet yaklaşımı yapıcı mı?',
    maxScore: 10,
    sortOrder: 3,
  },
  {
    code: 'K4',
    name: 'Müdahale Hızı',
    description: 'Hizmet süresince çıkan arıza ve kriz hallerinde kısa sürede ve etkin bir şekilde cevap veriliyor mu?',
    maxScore: 10,
    sortOrder: 4,
  },
  {
    code: 'K5',
    name: 'Teknik Yetkinlik',
    description: 'İstediğinde sistem izleme kayıtlarını ve hata loglarını analiz edebiliyor mu?',
    maxScore: 10,
    sortOrder: 5,
  },
  {
    code: 'K6',
    name: 'Kadro Yeterliliği',
    description: 'Kadrosu yeterli ve yetkin mi?',
    maxScore: 10,
    sortOrder: 6,
  },
] as const;

// ==========================================
// Tedarikçi ve Değerlendirme Verileri (5 adet)
// ==========================================

interface SupplierSeed {
  companyName: string;
  serviceType: 'IT_SERVICES' | 'CONSULTING';
  hasNDA: boolean;
  hasDataAccess: boolean;
  bgRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evaluationNo: string;
  evaluationDate: string; // YYYY-MM-DD
  evaluatorName: string;
  evaluatorTitle: string;
  scores: [number, number, number, number, number, number]; // K1-K6
  totalScore: number;
  resultGroup: 'A_APPROVED' | 'B_CANDIDATE' | 'C_REJECTED';
}

const SUPPLIERS: SupplierSeed[] = [
  {
    companyName: 'Eclit Bilişim Hizmetleri A.Ş.',
    serviceType: 'IT_SERVICES',
    hasNDA: true,
    hasDataAccess: true,
    bgRiskLevel: 'HIGH',
    evaluationNo: 'DEG-2025-001',
    evaluationDate: '2025-03-14',
    evaluatorName: 'Hasan Engin',
    evaluatorTitle: 'BGYS Sorumlusu',
    scores: [50, 9, 10, 9, 10, 10],
    totalScore: 98,
    resultGroup: 'A_APPROVED',
  },
  {
    companyName: 'Egebimtes Bilgi Teknolojileri A.Ş.',
    serviceType: 'IT_SERVICES',
    hasNDA: true,
    hasDataAccess: true,
    bgRiskLevel: 'HIGH',
    evaluationNo: 'DEG-2025-002',
    evaluationDate: '2025-05-22',
    evaluatorName: 'Melike Balaban',
    evaluatorTitle: 'Sistem Geliştirme Mühendisi',
    scores: [40, 8, 8, 7, 9, 8],
    totalScore: 80,
    resultGroup: 'A_APPROVED',
  },
  {
    companyName: 'Ekip Mapics Ltd. Şti.',
    serviceType: 'IT_SERVICES',
    hasNDA: true,
    hasDataAccess: true,
    bgRiskLevel: 'MEDIUM',
    evaluationNo: 'DEG-2025-003',
    evaluationDate: '2025-07-10',
    evaluatorName: 'Melike Balaban',
    evaluatorTitle: 'Sistem Geliştirme Mühendisi',
    scores: [50, 10, 10, 10, 9, 10],
    totalScore: 99,
    resultGroup: 'A_APPROVED',
  },
  {
    companyName: 'MAP Elektronik Ticaret ve Veri Hizmetleri A.Ş.',
    serviceType: 'IT_SERVICES',
    hasNDA: true,
    hasDataAccess: true,
    bgRiskLevel: 'HIGH',
    evaluationNo: 'DEG-2025-004',
    evaluationDate: '2025-09-18',
    evaluatorName: 'Hasan Engin',
    evaluatorTitle: 'BGYS Sorumlusu',
    scores: [50, 9, 10, 9, 10, 9],
    totalScore: 97,
    resultGroup: 'A_APPROVED',
  },
  {
    companyName: 'Netveri Danışmanlık Ltd. Şti.',
    serviceType: 'CONSULTING',
    hasNDA: true,
    hasDataAccess: false,
    bgRiskLevel: 'MEDIUM',
    evaluationNo: 'DEG-2025-005',
    evaluationDate: '2025-11-25',
    evaluatorName: 'Melike Balaban',
    evaluatorTitle: 'Sistem Geliştirme Mühendisi',
    scores: [50, 8, 9, 8, 10, 9],
    totalScore: 94,
    resultGroup: 'A_APPROVED',
  },
];

// ==========================================
// Ana fonksiyon
// ==========================================

async function main() {
  console.log('==============================================');
  console.log('Tedarikçi Değerlendirme Seed Script');
  console.log('==============================================\n');

  // ---- 1. Mevcut verileri sil ----
  console.log('1. Mevcut tedarikçi verileri siliniyor...');

  const deletedScores = await prisma.supplierCriteriaScore.deleteMany({});
  console.log(`   - ${deletedScores.count} kriter puanı silindi`);

  const deletedEvals = await prisma.supplierEvaluation.deleteMany({});
  console.log(`   - ${deletedEvals.count} değerlendirme silindi`);

  const deletedSuppliers = await prisma.supplier.deleteMany({});
  console.log(`   - ${deletedSuppliers.count} tedarikçi silindi`);

  const deletedCriteria = await prisma.supplierCriteria.deleteMany({});
  console.log(`   - ${deletedCriteria.count} kriter silindi`);

  console.log('');

  // ---- 2. Değerlendirme kriterlerini oluştur ----
  console.log('2. Değerlendirme kriterleri oluşturuluyor...');

  const criteriaMap: Record<string, string> = {};

  for (const c of CRITERIA) {
    const created = await prisma.supplierCriteria.create({
      data: {
        code: c.code,
        name: c.name,
        description: c.description,
        maxScore: c.maxScore,
        evaluationType: 'SERVICE',
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
    criteriaMap[c.code] = created.id;
    console.log(`   + ${c.code}: ${c.name} (max: ${c.maxScore})`);
  }

  console.log(`   Toplam: ${CRITERIA.length} kriter oluşturuldu\n`);

  // ---- 3. createdBy kullanıcısı bul ----
  console.log('3. Oluşturan kullanıcı aranıyor...');

  const user = await prisma.user.findFirst({
    where: {
      role: { in: ['SUPER_ADMIN', 'IT_MANAGER'] },
    },
    select: { id: true, name: true, role: true },
  });

  if (!user) {
    throw new Error('SUPER_ADMIN veya IT_MANAGER rolüne sahip kullanıcı bulunamadı!');
  }

  console.log(`   Kullanıcı: ${user.name} (${user.role})\n`);

  // ---- 4. Tedarikçileri ve değerlendirmeleri oluştur ----
  console.log('4. Tedarikçiler ve değerlendirmeler oluşturuluyor...');

  let supplierCount = 0;
  let evaluationCount = 0;
  const groupDistribution: Record<string, number> = {
    A_APPROVED: 0,
    B_CANDIDATE: 0,
    C_REJECTED: 0,
  };

  for (const s of SUPPLIERS) {
    const evalDate = new Date(s.evaluationDate);

    // Tedarikçi oluştur
    const supplier = await prisma.supplier.create({
      data: {
        companyName: s.companyName,
        serviceType: s.serviceType,
        status: 'ACTIVE',
        group: s.resultGroup,
        hasNDA: s.hasNDA,
        hasDataAccess: s.hasDataAccess,
        bgRiskLevel: s.bgRiskLevel,
        lastScore: s.totalScore,
        lastEvalDate: evalDate,
        createdById: user.id,
      },
    });
    supplierCount++;

    // Değerlendirme oluştur
    const evaluation = await prisma.supplierEvaluation.create({
      data: {
        evaluationNo: s.evaluationNo,
        supplierId: supplier.id,
        evaluationDate: evalDate,
        evaluationType: 'SERVICE',
        period: '2025 Yıllık',
        totalScore: s.totalScore,
        resultGroup: s.resultGroup,
        isApproved: s.totalScore >= 50,
        evaluatorName: s.evaluatorName,
        evaluatorTitle: s.evaluatorTitle,
        status: 'APPROVED',
        createdById: user.id,
      },
    });
    evaluationCount++;

    // Kriter puanları oluştur
    const criteriaCodes = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];
    for (let i = 0; i < criteriaCodes.length; i++) {
      await prisma.supplierCriteriaScore.create({
        data: {
          evaluationId: evaluation.id,
          criteriaId: criteriaMap[criteriaCodes[i]],
          score: s.scores[i],
        },
      });
    }

    groupDistribution[s.resultGroup] = (groupDistribution[s.resultGroup] || 0) + 1;

    console.log(`   + ${s.evaluationNo} - ${s.companyName} [Puan: ${s.totalScore}, Grup: ${s.resultGroup}]`);
  }

  console.log('');

  // ---- 5. Özet ----
  console.log('==============================================');
  console.log('ÖZET');
  console.log('==============================================');
  console.log(`  Kriterler       : ${CRITERIA.length} oluşturuldu`);
  console.log(`  Tedarikçiler    : ${supplierCount} oluşturuldu`);
  console.log(`  Değerlendirmeler: ${evaluationCount} oluşturuldu`);
  console.log('');

  console.log('Grup Dağılımı:');
  console.log(`  A (Onaylı)      : ${groupDistribution['A_APPROVED'] || 0}`);
  console.log(`  B (Aday)        : ${groupDistribution['B_CANDIDATE'] || 0}`);
  console.log(`  C (Yetersiz)    : ${groupDistribution['C_REJECTED'] || 0}`);
  console.log('');
  console.log('Seed işlemi başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error('HATA:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
