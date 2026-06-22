import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding suggestion system data...')

  // Get first category
  const categories = await prisma.suggestionCategory.findMany()
  const category = categories[0]

  // 1. Create sample suggestions
  const suggestions = [
    {
      suggestionNumber: 'ONR-2025-0001',
      title: 'Üretim hattında barkod okuyucu sistemi kurulumu',
      description: 'Üretim hattında parçaların takibi için barkod okuyucu sistemi kurulması ile envanter takibi kolaylaşacak ve hata oranı azalacaktır.',
      currentSituation: 'Şu anda parça takibi manuel olarak yapılmakta, bu da zaman kaybına ve hatalara neden olmaktadır.',
      proposedSolution: 'Her iş istasyonuna barkod okuyucu yerleştirip, ERP sistemi ile entegrasyon sağlanması.',
      expectedBenefit: 'Zaman tasarrufu, hata oranında azalma, gerçek zamanlı envanter takibi',
      estimatedSavings: 50000,
      categoryId: category?.id,
      status: 'APPROVED',
      priority: 'HIGH',
      suggestionType: 'IMPROVEMENT',
      submittedBy: 'erdi.ozturk@ilerigroup.com',
      submittedByName: 'Erdi Öztürk',
      submittedByDept: 'Bilgi Teknolojileri',
      isAnonymous: false
    },
    {
      suggestionNumber: 'ONR-2025-0002',
      title: 'Ofis aydınlatma sisteminin LED\'e dönüştürülmesi',
      description: 'Mevcut floresan aydınlatma sisteminin LED panellere dönüştürülmesi ile enerji tasarrufu sağlanabilir.',
      currentSituation: 'Ofis alanlarında eski tip floresan lambalar kullanılmakta.',
      proposedSolution: 'Tüm floresan lambaların LED panel ile değiştirilmesi.',
      expectedBenefit: 'Enerji tasarrufu, daha iyi aydınlatma, uzun ömür',
      estimatedSavings: 25000,
      categoryId: category?.id,
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      suggestionType: 'COST_REDUCTION',
      submittedBy: 'ahmet.yilmaz@ilerigroup.com',
      submittedByName: 'Ahmet Yılmaz',
      submittedByDept: 'Üretim',
      isAnonymous: false
    },
    {
      suggestionNumber: 'ONR-2025-0003',
      title: 'Yemekhane menü çeşitliliğinin artırılması',
      description: 'Yemekhanede vejetaryen ve diyet menü seçeneklerinin eklenmesi çalışan memnuniyetini artıracaktır.',
      currentSituation: 'Şu anda tek tip menü sunulmakta.',
      proposedSolution: 'Günlük menüye 1 vejetaryen ve 1 diyet seçeneği eklenmesi.',
      expectedBenefit: 'Çalışan memnuniyeti artışı',
      estimatedSavings: 0,
      categoryId: category?.id,
      status: 'SUBMITTED',
      priority: 'LOW',
      suggestionType: 'IMPROVEMENT',
      submittedBy: 'anonim@ilerigroup.com',
      submittedByName: 'Anonim',
      submittedByDept: null,
      isAnonymous: true
    }
  ]

  for (const suggestion of suggestions) {
    await prisma.suggestion.upsert({
      where: { suggestionNumber: suggestion.suggestionNumber },
      update: {},
      create: suggestion
    })
  }
  console.log('✓ 3 örnek öneri eklendi')

  // 2. Create sample Kaizen projects
  const kaizenProjects = [
    {
      projectNumber: 'KZN-2025-0001',
      title: 'Montaj hattı cycle time azaltma projesi',
      description: 'A hattında cycle time\'ın 45 saniyeden 35 saniyeye düşürülmesi için PDCA döngüsü uygulaması.',
      projectType: 'TEAM',
      problemWhat: 'A montaj hattında cycle time 45 saniye ve hedefin üzerinde.',
      problemWhy: 'Uzun cycle time müşteri taleplerinin karşılanmasını zorlaştırıyor ve fazla mesai maliyetine neden oluyor.',
      problemWhere: 'A montaj hattı, 3. iş istasyonu',
      problemWhen: 'Özellikle yoğun dönemlerde problem belirginleşiyor.',
      problemWho: 'Montaj operatörleri ve üretim planlama',
      problemHow: 'Zaman etüdü çalışmalarında tespit edildi.',
      currentState: 'Cycle time: 45 saniye, günlük üretim: 640 adet',
      targetState: 'Cycle time: 35 saniye, günlük üretim: 820 adet',
      proposedSolution: 'İş istasyonu düzenlemesi, ergonomi iyileştirme, önceden montaj',
      pdcaStage: 'DO',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      department: 'Üretim',
      teamLeaderEmail: 'mehmet.demir@ilerigroup.com',
      teamLeaderName: 'Mehmet Demir',
      createdBy: 'mehmet.demir@ilerigroup.com',
      createdByName: 'Mehmet Demir',
      startDate: new Date('2025-01-15'),
      targetEndDate: new Date('2025-03-15')
    },
    {
      projectNumber: 'KZN-2025-0002',
      title: 'Depo düzeni 5S uygulaması',
      description: 'Ana depo alanında 5S metodolojisi uygulanarak düzen ve verimlilik artırılacak.',
      projectType: 'INDIVIDUAL',
      problemWhat: 'Depoda malzeme bulma süresi uzun ve düzensizlik var.',
      problemWhy: 'Düzensizlik nedeniyle arama süreleri artıyor, yanlış malzeme kullanımı riski var.',
      currentState: 'Ortalama malzeme bulma süresi: 8 dakika',
      targetState: 'Ortalama malzeme bulma süresi: 2 dakika',
      proposedSolution: 'Görsel yönetim, raf etiketleme, alan tanımlamaları',
      pdcaStage: 'PLAN',
      status: 'PLANNING',
      priority: 'NORMAL',
      department: 'Lojistik',
      teamLeaderEmail: 'ayse.kaya@ilerigroup.com',
      teamLeaderName: 'Ayşe Kaya',
      createdBy: 'ayse.kaya@ilerigroup.com',
      createdByName: 'Ayşe Kaya',
      startDate: new Date('2025-01-20'),
      targetEndDate: new Date('2025-02-28')
    }
  ]

  for (const project of kaizenProjects) {
    await prisma.kaizenProject.upsert({
      where: { projectNumber: project.projectNumber },
      update: {},
      create: project
    })
  }
  console.log('✓ 2 örnek Kaizen projesi eklendi')

  // 3. Create sample Near Miss reports
  const nearMisses = [
    {
      reportNumber: 'RMK-2025-0001',
      title: 'Forklift ile yaya çarpışma riski',
      description: 'Depo girişinde forklift ile yaya arasında ramak kala olay yaşandı. Forklift operatörü köşeden dönerken yayayı son anda fark etti.',
      eventDate: new Date('2025-01-10'),
      eventLocation: 'Ana Depo - Giriş Kapısı',
      locationDetails: 'Depo giriş kapısı önü, köşe dönüş noktası',
      eventType: 'VEHICLE',
      potentialSeverity: 'MAJOR',
      whatHappened: 'Forklift operatörü palet taşırken köşeden döndü, tam o sırada depodan çıkan çalışan ile karşılaştı.',
      whyHappened: 'Köşede görüş alanı kısıtlı, ayna veya uyarı sistemi yok.',
      howHappened: 'Operatör yükü görmeye çalışırken yayayı fark edemedi.',
      reportedBy: 'ali.veli@ilerigroup.com',
      reportedByName: 'Ali Veli',
      reportedByDept: 'Lojistik',
      isAnonymous: false,
      status: 'ACTION_REQUIRED'
    },
    {
      reportNumber: 'RMK-2025-0002',
      title: 'Islak zeminde kayma tehlikesi',
      description: 'Üretim alanında temizlik sonrası ıslak zemin nedeniyle kayma tehlikesi oluştu.',
      eventDate: new Date('2025-01-12'),
      eventLocation: 'B Üretim Hattı - Koridor',
      locationDetails: 'B hattı ve yemekhane arasındaki koridor',
      eventType: 'SLIPPING',
      potentialSeverity: 'MODERATE',
      whatHappened: 'Temizlik sonrası ıslak kalan zeminde bir çalışan kaydı ama tutunarak düşmedi.',
      whyHappened: 'Islak zemin uyarısı konmadı, kuruma süresi beklenmedi.',
      reportedBy: 'anonim@ilerigroup.com',
      reportedByName: 'Anonim',
      reportedByDept: null,
      isAnonymous: true,
      status: 'RESOLVED'
    },
    {
      reportNumber: 'RMK-2025-0003',
      title: 'Elektrik panosu kapağı açık',
      description: 'Bakım sonrası elektrik panosu kapağının açık bırakıldığı tespit edildi.',
      eventDate: new Date('2025-01-14'),
      eventLocation: 'Teknik Oda - 2. Kat',
      eventType: 'ELECTRICAL',
      potentialSeverity: 'CRITICAL',
      whatHappened: 'Rutin kontrol sırasında elektrik panosu kapağının açık olduğu görüldü.',
      reportedBy: 'hasan.yildiz@ilerigroup.com',
      reportedByName: 'Hasan Yıldız',
      reportedByDept: 'Bakım',
      isAnonymous: false,
      status: 'CLOSED'
    }
  ]

  for (const nearMiss of nearMisses) {
    await prisma.nearMiss.upsert({
      where: { reportNumber: nearMiss.reportNumber },
      update: {},
      create: nearMiss
    })
  }
  console.log('✓ 3 örnek Ramak Kala bildirimi eklendi')

  // 4. Create sample 5S Areas
  const areas = [
    {
      name: 'Ana Üretim Hattı',
      code: 'URETIM-A1',
      description: 'A montaj hattı ve çevresi',
      department: 'Üretim',
      location: '1. Kat - Üretim Bölümü',
      responsibleEmail: 'mehmet.demir@ilerigroup.com',
      responsibleName: 'Mehmet Demir'
    },
    {
      name: 'Hammadde Deposu',
      code: 'DEPO-H1',
      description: 'Hammadde ve yarı mamul depolama alanı',
      department: 'Lojistik',
      location: 'Zemin Kat - Depo Bölümü',
      responsibleEmail: 'ayse.kaya@ilerigroup.com',
      responsibleName: 'Ayşe Kaya'
    },
    {
      name: 'Kalite Kontrol Laboratuvarı',
      code: 'KK-LAB',
      description: 'Kalite kontrol ve test laboratuvarı',
      department: 'Kalite',
      location: '2. Kat - Laboratuvar',
      responsibleEmail: 'zeynep.arslan@ilerigroup.com',
      responsibleName: 'Zeynep Arslan'
    }
  ]

  for (const area of areas) {
    await prisma.fiveSArea.upsert({
      where: { code: area.code },
      update: {},
      create: area
    })
  }
  console.log('✓ 3 örnek 5S denetim alanı eklendi')

  // 5. Create sample 5S Audits
  const createdAreas = await prisma.fiveSArea.findMany()
  const audits = [
    {
      auditNumber: '5S-2025-0001',
      areaId: createdAreas[0]?.id,
      auditDate: new Date('2025-01-08'),
      auditType: 'REGULAR',
      auditorEmail: 'erdi.ozturk@ilerigroup.com',
      auditorName: 'Erdi Öztürk',
      seiriScore: 75,
      seitonScore: 80,
      seisoScore: 85,
      seiketsuScore: 70,
      shitsukeScore: 75,
      totalScore: 77,
      strengths: 'Temizlik konusunda iyi seviye, ekip bilinci yüksek.',
      improvements: 'Ayıklama ve standartlaştırma konularında iyileştirme gerekli.',
      status: 'COMPLETED'
    },
    {
      auditNumber: '5S-2025-0002',
      areaId: createdAreas[1]?.id,
      auditDate: new Date('2025-01-15'),
      auditType: 'REGULAR',
      auditorEmail: 'erdi.ozturk@ilerigroup.com',
      auditorName: 'Erdi Öztürk',
      seiriScore: 60,
      seitonScore: 55,
      seisoScore: 70,
      seiketsuScore: 50,
      shitsukeScore: 55,
      totalScore: 58,
      strengths: 'Temizlik programı uygulanıyor.',
      improvements: 'Düzenleme ve ayıklama acil iyileştirme gerektiriyor.',
      status: 'COMPLETED'
    }
  ]

  for (const audit of audits) {
    if (audit.areaId) {
      await prisma.fiveSAudit.upsert({
        where: { auditNumber: audit.auditNumber },
        update: {},
        create: audit
      })
    }
  }
  console.log('✓ 2 örnek 5S denetimi eklendi')

  console.log('\n✅ Tüm örnek veriler başarıyla eklendi!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
