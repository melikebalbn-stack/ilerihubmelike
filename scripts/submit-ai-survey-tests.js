const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const surveyId = 'cm5psurvey003';

// 3 farklı profil
const profiles = [
  {
    name: "Ahmet Yılmaz",
    department: "Sistem Geliştirme",
    // Power user - Günlük kullanıcı, çok araç
    aiTools: ["aiopt001", "aiopt005", "aiopt006"], // ChatGPT, Claude, GitHub Copilot
    frequency: "aiopt009", // Günlük
    purposes: ["aiopt016", "aiopt015", "aiopt020", "aiopt021"], // Kod, Veri analizi, Araştırma, Raporlama
    taskDescription: "Yazılım geliştirme sürecinde kod review ve bug fix işlemleri",
    beforeTime: "120", // 2 saat
    afterTime: "30", // 30 dk
    monthlyFreq: "20",
    values: ["aiopt024", "aiopt025", "aiopt026"], // Hacim, Kalite, İnovasyon
    strategicExample: "ILERIHub platformunda AI destekli anket analiz modülü geliştirdim, manuel analiz yerine otomatik içgörüler sunuyor.",
    potentialArea: "Müşteri destek taleplerinin otomatik kategorilenmesi ve önceliklendirilmesi için AI kullanılabilir.",
    needs: ["aiopt031", "aiopt032"], // Lisanslı araçlar, Entegrasyon
  },
  {
    name: "Elif Demir",
    department: "Satış Pazarlama",
    // Orta düzey - Haftalık kullanıcı
    aiTools: ["aiopt001", "aiopt003"], // ChatGPT, Gemini
    frequency: "aiopt010", // Haftalık
    purposes: ["aiopt014", "aiopt022", "aiopt023"], // İçerik, E-posta, Sunum
    taskDescription: "Haftalık satış raporları ve müşteri sunumları hazırlama",
    beforeTime: "180", // 3 saat
    afterTime: "60", // 1 saat
    monthlyFreq: "8",
    values: ["aiopt024", "aiopt027"], // Hacim artışı, İş-yaşam dengesi
    strategicExample: "Yeni ürün lansmanı için sosyal medya içerik stratejisi oluşturdum, AI ile A/B test senaryoları geliştirdim.",
    potentialArea: "Müşteri segmentasyonu ve hedefli kampanya önerileri için AI kullanılabilir.",
    needs: ["aiopt030", "aiopt034"], // Eğitim, Yönetim desteği
  },
  {
    name: "Mehmet Kaya",
    department: "Üretim",
    // Başlangıç - Proje bazlı, az araç
    aiTools: ["aiopt001"], // Sadece ChatGPT
    frequency: "aiopt011", // Proje bazlı
    purposes: ["aiopt020", "aiopt017"], // Araştırma, Çeviri
    taskDescription: "Teknik dökümanların çevirisi ve makine bakım prosedürleri araştırması",
    beforeTime: "240", // 4 saat
    afterTime: "90", // 1.5 saat
    monthlyFreq: "4",
    values: ["aiopt025"], // Kalite artışı
    strategicExample: "",
    potentialArea: "Üretim hattında arıza tahmin sistemi için AI kullanılabilir, sensör verilerinden öngörücü bakım yapılabilir.",
    needs: ["aiopt030", "aiopt033", "aiopt035"], // Eğitim, Yasal, Zaman
  }
];

async function submitTestResponses() {
  console.log("AI Anketi test yanıtları oluşturuluyor...\n");

  for (const profile of profiles) {
    const responseId = uuidv4();
    const anonymousId = uuidv4();

    const answerRecords = [];

    // ai001 - AI Araçları (Multiple Choice)
    for (const toolId of profile.aiTools) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai001",
        optionId: toolId,
        textAnswer: null,
      });
    }

    // ai002 - Kullanım Sıklığı (Single Choice)
    answerRecords.push({
      id: uuidv4(),
      questionId: "ai002",
      optionId: profile.frequency,
      textAnswer: null,
    });

    // ai003 - Kullanım Amaçları (Multiple Choice)
    for (const purposeId of profile.purposes) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai003",
        optionId: purposeId,
        textAnswer: null,
      });
    }

    // ai004 - Görev Tanımı (Text)
    answerRecords.push({
      id: uuidv4(),
      questionId: "ai004",
      optionId: null,
      textAnswer: profile.taskDescription,
    });

    // ai005 - AI Öncesi Süre (Text)
    answerRecords.push({
      id: uuidv4(),
      questionId: "ai005",
      optionId: null,
      textAnswer: profile.beforeTime,
    });

    // ai006 - AI Sonrası Süre (Text)
    answerRecords.push({
      id: uuidv4(),
      questionId: "ai006",
      optionId: null,
      textAnswer: profile.afterTime,
    });

    // ai007 - Aylık Sıklık (Text)
    answerRecords.push({
      id: uuidv4(),
      questionId: "ai007",
      optionId: null,
      textAnswer: profile.monthlyFreq,
    });

    // ai008 - Değer Dağıtımı (Multiple Choice)
    for (const valueId of profile.values) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai008",
        optionId: valueId,
        textAnswer: null,
      });
    }

    // ai009 - Stratejik Proje Örneği (Text)
    if (profile.strategicExample) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai009",
        optionId: null,
        textAnswer: profile.strategicExample,
      });
    }

    // ai010 - Potansiyel Alan (Text)
    if (profile.potentialArea) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai010",
        optionId: null,
        textAnswer: profile.potentialArea,
      });
    }

    // ai011 - İhtiyaçlar (Multiple Choice)
    for (const needId of profile.needs) {
      answerRecords.push({
        id: uuidv4(),
        questionId: "ai011",
        optionId: needId,
        textAnswer: null,
      });
    }

    // Kaydet
    await prisma.surveyResponse.create({
      data: {
        id: responseId,
        surveyId,
        anonymousId,
        isComplete: true,
        respondentName: profile.name,
        respondentEmail: null,
        respondentDepartment: profile.department,
        ipAddress: "192.168.1." + Math.floor(Math.random() * 255),
        userAgent: "Mozilla/5.0 (Test Script)",
        completedAt: new Date(),
        answers: {
          create: answerRecords,
        },
      },
    });

    console.log(`✓ ${profile.name} (${profile.department}) - ${answerRecords.length} yanıt kaydedildi`);
  }

  console.log("\n3 test yanıtı başarıyla oluşturuldu!");
}

submitTestResponses()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
