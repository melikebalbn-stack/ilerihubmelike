import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('QDMS örnek verileri ekleniyor...\n');

  // Önce bir kullanıcı ve departman alalım
  const user = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'QUALITY_MANAGER', 'SUPER_ADMIN'] } },
  });

  const department = await prisma.department.findFirst({
    where: { code: 'KALITE' },
  });

  if (!user) {
    console.log('❌ Kullanıcı bulunamadı. Önce bir kullanıcı oluşturun.');
    return;
  }

  console.log(`Kullanıcı: ${user.name} (${user.email})`);
  console.log(`Departman: ${department?.name || 'Yok'}\n`);

  // =========================================================================
  // 1. DOKÜMANLAR
  // =========================================================================
  console.log('📄 Dokümanlar ekleniyor...');

  const documents = [
    {
      documentNumber: 'PR-QMS-001',
      title: 'Kalite Yönetim Sistemi Prosedürü',
      description: 'ISO 9001:2015 standardına uygun kalite yönetim sistemi ana prosedürü. Tüm kalite süreçlerinin temelini oluşturur.',
      category: 'PROCEDURE' as const,
      version: '2.0',
      revisionNumber: 3,
      status: 'PUBLISHED' as const,
      effectiveDate: new Date('2024-01-15'),
      reviewDate: new Date('2025-01-15'),
      reviewPeriodMonths: 12,
      tags: ['ISO 9001', 'Kalite', 'Prosedür'],
      isConfidential: false,
      ownerId: user.id,
      createdById: user.id,
      departmentId: department?.id,
      publishedAt: new Date('2024-01-15'),
    },
    {
      documentNumber: 'WI-PRD-001',
      title: 'Üretim İş Talimatı - Kaynak İşlemleri',
      description: 'Kaynak işlemlerinin güvenli ve kaliteli bir şekilde gerçekleştirilmesi için adım adım talimatlar.',
      category: 'INSTRUCTION' as const,
      version: '1.2',
      revisionNumber: 2,
      status: 'PUBLISHED' as const,
      effectiveDate: new Date('2024-03-01'),
      reviewDate: new Date('2025-03-01'),
      reviewPeriodMonths: 12,
      tags: ['Üretim', 'Kaynak', 'Talimat'],
      isConfidential: false,
      ownerId: user.id,
      createdById: user.id,
      departmentId: department?.id,
      publishedAt: new Date('2024-03-01'),
    },
  ];

  for (const doc of documents) {
    const existing = await prisma.qdmsDocument.findUnique({
      where: { documentNumber: doc.documentNumber },
    });

    if (!existing) {
      await prisma.qdmsDocument.create({ data: doc });
      console.log(`  ✓ ${doc.documentNumber} - ${doc.title}`);
    } else {
      console.log(`  ○ ${doc.documentNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 2. CAPA
  // =========================================================================
  console.log('\n🔧 CAPA kayıtları ekleniyor...');

  const capas = [
    {
      capaNumber: 'CAPA-2024-001',
      title: 'Kaynak Kalite Sorunlarının Düzeltilmesi',
      description: 'Üretim hattında tespit edilen kaynak kalite sorunlarının kök neden analizi ve düzeltici faaliyetler.',
      type: 'CORRECTIVE' as const,
      priority: 'HIGH' as const,
      status: 'IN_PROGRESS' as const,
      sourceType: 'NCR',
      sourceReference: 'NCR-2024-001',
      rootCause: 'Kaynak personelinin yetersiz eğitimi ve eski kaynak parametrelerinin kullanılması',
      rootCauseMethod: '5 WHY',
      immediateAction: 'Hatalı kaynak yapılan ürünler ayrıştırıldı ve yeniden işleme alındı',
      plannedActions: '1. Kaynak personeli eğitimi\n2. Kaynak parametrelerinin güncellenmesi\n3. Kontrol sıklığının artırılması',
      dueDate: new Date('2024-12-31'),
      initiatorId: user.id,
      responsibleId: user.id,
      departmentId: department?.id,
    },
    {
      capaNumber: 'CAPA-2024-002',
      title: 'Önleyici Bakım Programının İyileştirilmesi',
      description: 'Makine arızalarını önlemek için önleyici bakım programının güncellenmesi.',
      type: 'PREVENTIVE' as const,
      priority: 'MEDIUM' as const,
      status: 'OPEN' as const,
      sourceType: 'AUDIT',
      sourceReference: 'AUD-2024-001',
      rootCause: null,
      rootCauseMethod: null,
      immediateAction: null,
      plannedActions: '1. Mevcut bakım programının gözden geçirilmesi\n2. Kritik ekipmanların belirlenmesi\n3. Yeni bakım takviminin oluşturulması',
      dueDate: new Date('2025-01-31'),
      initiatorId: user.id,
      responsibleId: user.id,
      departmentId: department?.id,
    },
  ];

  for (const capa of capas) {
    const existing = await prisma.qdmsCapa.findUnique({
      where: { capaNumber: capa.capaNumber },
    });

    if (!existing) {
      await prisma.qdmsCapa.create({ data: capa });
      console.log(`  ✓ ${capa.capaNumber} - ${capa.title}`);
    } else {
      console.log(`  ○ ${capa.capaNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 3. DENETİMLER
  // =========================================================================
  console.log('\n📋 Denetimler ekleniyor...');

  const audits = [
    {
      auditNumber: 'AUD-2024-001',
      title: 'ISO 9001 İç Denetim - Üretim Prosesleri',
      description: 'Üretim departmanının ISO 9001:2015 gerekliliklerine uygunluğunun denetlenmesi',
      type: 'INTERNAL' as const,
      standard: 'ISO 9001:2015',
      scope: 'Üretim planlama, kaynak yönetimi, kalite kontrol süreçleri',
      plannedDate: new Date('2024-11-15'),
      actualDate: new Date('2024-11-15'),
      duration: 8,
      status: 'COMPLETED' as const,
      summary: 'Denetim başarıyla tamamlandı. 2 minör bulgu tespit edildi.',
      conclusion: 'Uygun - İyileştirme Önerileri İle',
      leadAuditorId: user.id,
      departmentId: department?.id,
      completedAt: new Date('2024-11-15'),
    },
    {
      auditNumber: 'AUD-2024-002',
      title: 'Tedarikçi Denetimi - ABC Metal Ltd.',
      description: 'Ana malzeme tedarikçisinin kalite sistemi ve üretim kapasitesi denetimi',
      type: 'SUPPLIER' as const,
      standard: 'ISO 9001:2015',
      scope: 'Giriş kalite kontrol, depolama, izlenebilirlik',
      plannedDate: new Date('2025-01-20'),
      actualDate: null,
      duration: 6,
      status: 'PLANNED' as const,
      summary: null,
      conclusion: null,
      leadAuditorId: user.id,
      departmentId: department?.id,
      completedAt: null,
    },
  ];

  for (const audit of audits) {
    const existing = await prisma.qdmsAudit.findUnique({
      where: { auditNumber: audit.auditNumber },
    });

    if (!existing) {
      await prisma.qdmsAudit.create({ data: audit });
      console.log(`  ✓ ${audit.auditNumber} - ${audit.title}`);
    } else {
      console.log(`  ○ ${audit.auditNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 4. RİSKLER
  // =========================================================================
  console.log('\n⚠️ Riskler ekleniyor...');

  const risks = [
    {
      riskNumber: 'RISK-2024-001',
      title: 'Tedarikçi Bağımlılığı Riski',
      description: 'Kritik hammaddelerin tek tedarikçiden temin edilmesi durumunda tedarik kesintisi riski',
      category: 'SUPPLY_CHAIN',
      source: 'Stratejik Planlama Toplantısı',
      likelihood: 3,
      impact: 4,
      riskScore: 12,
      riskLevel: 'HIGH' as const,
      currentControls: 'Yıllık tedarikçi değerlendirmesi yapılıyor',
      mitigationPlan: '1. Alternatif tedarikçi araştırması\n2. Güvenlik stoğu seviyesinin artırılması\n3. Uzun vadeli sözleşmelerin yapılması',
      status: 'OPEN',
      reviewDate: new Date('2025-06-01'),
      createdById: user.id,
      responsibleId: user.id,
      departmentId: department?.id,
    },
    {
      riskNumber: 'RISK-2024-002',
      title: 'Personel Yetkinlik Riski',
      description: 'Kritik pozisyonlarda yedek personel bulunmaması durumunda operasyonel süreklilik riski',
      category: 'OPERATIONAL',
      source: 'Yönetim Gözden Geçirme',
      likelihood: 2,
      impact: 4,
      riskScore: 8,
      riskLevel: 'MEDIUM' as const,
      currentControls: 'Çapraz eğitim programı mevcut',
      mitigationPlan: '1. Yedekleme planının güncellenmesi\n2. Dokümantasyonun iyileştirilmesi\n3. Eğitim matrisinin gözden geçirilmesi',
      status: 'MITIGATED',
      reviewDate: new Date('2025-03-01'),
      createdById: user.id,
      responsibleId: user.id,
      departmentId: department?.id,
    },
  ];

  for (const risk of risks) {
    const existing = await prisma.qdmsRisk.findUnique({
      where: { riskNumber: risk.riskNumber },
    });

    if (!existing) {
      await prisma.qdmsRisk.create({ data: risk });
      console.log(`  ✓ ${risk.riskNumber} - ${risk.title}`);
    } else {
      console.log(`  ○ ${risk.riskNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 5. TEDARİKÇİLER
  // =========================================================================
  console.log('\n🚚 Tedarikçiler ekleniyor...');

  const suppliers = [
    {
      supplierCode: 'SUP-001',
      name: 'ABC Metal Sanayi Ltd. Şti.',
      contactPerson: 'Ahmet Yılmaz',
      email: 'ahmet@abcmetal.com',
      phone: '+90 212 555 1234',
      address: 'OSB 5. Cadde No:25 Gebze/Kocaeli',
      category: 'RAW_MATERIAL',
      products: 'Çelik sac, Profil, Boru',
      status: 'APPROVED' as const,
      rating: 85,
      certifications: JSON.stringify(['ISO 9001:2015', 'ISO 14001:2015']),
      certExpiryDate: new Date('2026-06-15'),
      lastAuditDate: new Date('2024-06-15'),
      nextAuditDate: new Date('2025-06-15'),
    },
    {
      supplierCode: 'SUP-002',
      name: 'XYZ Elektronik A.Ş.',
      contactPerson: 'Mehmet Demir',
      email: 'mehmet@xyzelectronic.com',
      phone: '+90 216 444 5678',
      address: 'Teknoloji Vadisi No:10 Pendik/İstanbul',
      category: 'COMPONENTS',
      products: 'Sensörler, Kontrol kartları, Kablolar',
      status: 'CONDITIONAL' as const,
      rating: 72,
      certifications: JSON.stringify(['ISO 9001:2015']),
      certExpiryDate: new Date('2025-08-20'),
      lastAuditDate: new Date('2024-02-10'),
      nextAuditDate: new Date('2025-02-10'),
    },
  ];

  for (const supplier of suppliers) {
    const existing = await prisma.qdmsSupplier.findUnique({
      where: { supplierCode: supplier.supplierCode },
    });

    if (!existing) {
      await prisma.qdmsSupplier.create({ data: supplier });
      console.log(`  ✓ ${supplier.supplierCode} - ${supplier.name}`);
    } else {
      console.log(`  ○ ${supplier.supplierCode} zaten mevcut`);
    }
  }

  // =========================================================================
  // 6. EĞİTİMLER
  // =========================================================================
  console.log('\n📚 Eğitimler ekleniyor...');

  const trainings = [
    {
      trainingTitle: 'ISO 9001:2015 Temel Eğitimi',
      trainingType: 'CLASSROOM',
      status: 'COMPLETED' as const,
      assignedAt: new Date('2024-09-01'),
      dueDate: new Date('2024-09-15'),
      completedAt: new Date('2024-09-10'),
      score: 92,
      passed: true,
      userId: user.id,
      trainerId: user.id,
      notes: 'Eğitim başarıyla tamamlandı. Katılımcı tüm konuları kavradı.',
    },
    {
      trainingTitle: 'İç Denetçi Yetkinlik Eğitimi',
      trainingType: 'CLASSROOM',
      status: 'IN_PROGRESS' as const,
      assignedAt: new Date('2024-11-01'),
      dueDate: new Date('2024-12-15'),
      completedAt: null,
      score: null,
      passed: null,
      userId: user.id,
      trainerId: user.id,
      notes: 'Eğitim devam ediyor. 2. modül tamamlandı.',
    },
  ];

  for (const training of trainings) {
    // Aynı kullanıcı ve eğitim başlığı kontrolü
    const existing = await prisma.qdmsTrainingRecord.findFirst({
      where: {
        userId: training.userId,
        trainingTitle: training.trainingTitle,
      },
    });

    if (!existing) {
      await prisma.qdmsTrainingRecord.create({ data: training });
      console.log(`  ✓ ${training.trainingTitle}`);
    } else {
      console.log(`  ○ ${training.trainingTitle} zaten mevcut`);
    }
  }

  // =========================================================================
  // 7. DEĞİŞİKLİK TALEPLERİ
  // =========================================================================
  console.log('\n🔄 Değişiklik talepleri ekleniyor...');

  const changes = [
    {
      changeNumber: 'ECR-2024-001',
      title: 'Kaynak Prosedürü Güncelleme',
      description: 'Yeni kaynak teknolojisinin uygulanması için prosedür güncellemesi',
      type: 'PROCESS',
      priority: 'HIGH' as const,
      status: 'APPROVED' as const,
      impactAnalysis: 'Üretim verimliliğinde %15 artış bekleniyor. Operatör eğitimi gerekli.',
      riskAssessment: 'Düşük risk - Pilot uygulama ile test edilecek',
      costEstimate: 25000,
      implementationPlan: '1. Pilot uygulama\n2. Eğitim\n3. Tam uygulama',
      requesterId: user.id,
      departmentId: department?.id,
    },
    {
      changeNumber: 'ECR-2024-002',
      title: 'Kalite Kontrol Formu Revizyonu',
      description: 'Müşteri geri bildirimleri doğrultusunda kalite kontrol formunun güncellenmesi',
      type: 'DOCUMENT',
      priority: 'MEDIUM' as const,
      status: 'UNDER_REVIEW' as const,
      impactAnalysis: 'Daha detaylı kayıt tutulacak, izlenebilirlik artacak',
      riskAssessment: 'Minimum risk - Doküman değişikliği',
      costEstimate: 0,
      implementationPlan: '1. Form tasarımı\n2. Onay\n3. Dağıtım',
      requesterId: user.id,
      departmentId: department?.id,
    },
  ];

  for (const change of changes) {
    const existing = await prisma.qdmsChangeRequest.findUnique({
      where: { changeNumber: change.changeNumber },
    });

    if (!existing) {
      await prisma.qdmsChangeRequest.create({ data: change });
      console.log(`  ✓ ${change.changeNumber} - ${change.title}`);
    } else {
      console.log(`  ○ ${change.changeNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 8. NCR (UYGUNSUZLUK)
  // =========================================================================
  console.log('\n❌ NCR kayıtları ekleniyor...');

  const ncrs = [
    {
      ncrNumber: 'NCR-2024-001',
      title: 'Kaynak Dikişinde Gözeneklilik',
      description: 'Üretim kontrolünde A-123 ürününün kaynak dikişinde gözeneklilik tespit edildi. Toplam 15 adet ürün etkilendi.',
      level: 'MAJOR' as const,
      category: 'PRODUCTION',
      detectedAt: new Date('2024-10-15'),
      detectedById: user.id,
      detectedArea: 'Üretim Hattı 2',
      productId: 'A-123',
      batchNumber: 'LOT-2024-1015',
      quantity: 15,
      disposition: 'REWORK',
      dispositionById: user.id,
      dispositionDate: new Date('2024-10-16'),
      dispositionNotes: 'Ürünler yeniden işleme alındı ve kaynak dikişleri tekrarlandı.',
      costOfNonConformance: 3500,
      status: 'CLOSED' as const,
      closedAt: new Date('2024-10-20'),
      closedById: user.id,
      departmentId: department?.id,
    },
    {
      ncrNumber: 'NCR-2024-002',
      title: 'Boyut Tolerans Aşımı',
      description: 'Giriş kalite kontrolde tedarikçiden gelen malzemede boyut tolerans aşımı tespit edildi.',
      level: 'MINOR' as const,
      category: 'INCOMING',
      detectedAt: new Date('2024-11-05'),
      detectedById: user.id,
      detectedArea: 'Giriş Kalite Kontrol',
      productId: 'MAT-456',
      batchNumber: 'SUP-2024-1105',
      quantity: 50,
      disposition: null,
      dispositionById: null,
      dispositionDate: null,
      dispositionNotes: null,
      costOfNonConformance: null,
      status: 'OPEN' as const,
      closedAt: null,
      closedById: null,
      departmentId: department?.id,
    },
  ];

  for (const ncr of ncrs) {
    const existing = await prisma.qdmsNonConformance.findUnique({
      where: { ncrNumber: ncr.ncrNumber },
    });

    if (!existing) {
      await prisma.qdmsNonConformance.create({ data: ncr });
      console.log(`  ✓ ${ncr.ncrNumber} - ${ncr.title}`);
    } else {
      console.log(`  ○ ${ncr.ncrNumber} zaten mevcut`);
    }
  }

  // =========================================================================
  // 9. MÜŞTERİ ŞİKAYETLERİ
  // =========================================================================
  console.log('\n📞 Müşteri şikayetleri ekleniyor...');

  const complaints = [
    {
      complaintNumber: 'CMP-2024-001',
      customerName: 'İleri İnşaat A.Ş.',
      customerContact: 'Ali Kaya',
      customerEmail: 'ali.kaya@ileriinsaat.com',
      customerPhone: '+90 532 111 2233',
      title: 'Teslimat Gecikmesi',
      description: 'Sipariş edilen asansör kabinleri planlanan tarihten 10 gün geç teslim edildi. Proje takvimi etkilendi.',
      category: 'DELIVERY',
      priority: 'HIGH' as const,
      receivedAt: new Date('2024-10-20'),
      receivedById: user.id,
      source: 'EMAIL',
      responsibleId: user.id,
      investigation: 'Tedarikçiden gelen malzeme gecikmesi nedeniyle üretim planı aksadı.',
      rootCause: 'Tedarikçi kapasitesinin yetersizliği ve iletişim eksikliği',
      resolution: 'Müşteriye resmi özür yazısı gönderildi. Bir sonraki siparişte %5 indirim uygulanacak.',
      customerResponse: 'Müşteri çözümü kabul etti ancak gelecekte benzeri durumların önlenmesini talep etti.',
      capaRequired: true,
      status: 'CLOSED' as const,
      closedAt: new Date('2024-10-30'),
      departmentId: department?.id,
    },
    {
      complaintNumber: 'CMP-2024-002',
      customerName: 'Mega Yapı Ltd.',
      customerContact: 'Fatma Şen',
      customerEmail: 'fatma.sen@megayapi.com',
      customerPhone: '+90 533 444 5566',
      title: 'Ürün Boyut Uyumsuzluğu',
      description: 'Montaj sırasında asansör kapısının çerçeve boyutlarının şartname ile uyumsuz olduğu tespit edildi.',
      category: 'QUALITY',
      priority: 'CRITICAL' as const,
      receivedAt: new Date('2024-11-10'),
      receivedById: user.id,
      source: 'PHONE',
      responsibleId: user.id,
      investigation: null,
      rootCause: null,
      resolution: null,
      customerResponse: null,
      capaRequired: false,
      status: 'OPEN' as const,
      closedAt: null,
      departmentId: department?.id,
    },
  ];

  for (const complaint of complaints) {
    const existing = await prisma.qdmsCustomerComplaint.findUnique({
      where: { complaintNumber: complaint.complaintNumber },
    });

    if (!existing) {
      await prisma.qdmsCustomerComplaint.create({ data: complaint });
      console.log(`  ✓ ${complaint.complaintNumber} - ${complaint.title}`);
    } else {
      console.log(`  ○ ${complaint.complaintNumber} zaten mevcut`);
    }
  }

  // Özet
  console.log('\n' + '='.repeat(50));
  console.log('📊 QDMS Örnek Veri Özeti:');
  console.log('='.repeat(50));

  const counts = await Promise.all([
    prisma.qdmsDocument.count(),
    prisma.qdmsCapa.count(),
    prisma.qdmsAudit.count(),
    prisma.qdmsRisk.count(),
    prisma.qdmsSupplier.count(),
    prisma.qdmsTrainingRecord.count(),
    prisma.qdmsChangeRequest.count(),
    prisma.qdmsNonConformance.count(),
    prisma.qdmsCustomerComplaint.count(),
  ]);

  console.log(`📄 Dokümanlar:          ${counts[0]}`);
  console.log(`🔧 CAPA:                ${counts[1]}`);
  console.log(`📋 Denetimler:          ${counts[2]}`);
  console.log(`⚠️  Riskler:             ${counts[3]}`);
  console.log(`🚚 Tedarikçiler:        ${counts[4]}`);
  console.log(`📚 Eğitimler:           ${counts[5]}`);
  console.log(`🔄 Değişiklik Talepleri: ${counts[6]}`);
  console.log(`❌ NCR:                 ${counts[7]}`);
  console.log(`📞 Müşteri Şikayetleri: ${counts[8]}`);
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
