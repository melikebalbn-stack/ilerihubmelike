/**
 * ANK-2026-002 (cm5psurvey003) — "Yapay Zeka Kullanım ve Verimlilik Anketi"
 * yeniden tasarımı: anonim moda alır, açıklamayı günceller ve 11 soruyu
 * 13 yeni soruyla değiştirir.
 *
 * GÜVENLİK KAPISI: anketin YANITI VARSA hiçbir şey yapmaz. Soru setini yanıt
 * geldikten sonra değiştirmek SurveyAnswer.questionId bağlarını anlamsızlaştırır.
 *
 * IDEMPOTENT: sorular her koşumda silinip aynı tanımdan yeniden yazılır; ikinci
 * koşum aynı sonucu üretir. Bölüm ön-eki YOK, düz numara.
 *
 * Kullanım:
 *   npx tsx scripts/redesign-ai-survey.ts           # DRY-RUN (varsayılan)
 *   npx tsx scripts/redesign-ai-survey.ts --apply   # gerçek yazım
 */
import { prisma } from '../src/lib/prisma'

const SURVEY_ID = 'cm5psurvey003'
const APPLY = process.argv.includes('--apply')

const ACIKLAMA =
  'Bu anket, yapay zekâ araçlarının günlük işlerde nasıl kullanıldığını anlamak ve ' +
  'verimliliği artıracak ihtiyaçları belirlemek için hazırlanmıştır. Yanıtlar anonimdir; ' +
  'sonuçlar yalnız toplu olarak değerlendirilir.'

type Tip = 'DROPDOWN' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT_LONG'
interface Soru {
  metin: string
  tip: Tip
  zorunlu: boolean
  /** null = seçenekler DB'den (bölüm listesi) doldurulur */
  secenekler: string[] | null
}

const SORULAR: Soru[] = [
  { metin: 'Hangi bölümde çalışıyorsunuz?', tip: 'DROPDOWN', zorunlu: true, secenekler: null },
  {
    metin: 'Hangi yapay zekâ araçlarını kullanıyorsunuz?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['ChatGPT', 'Microsoft Copilot', 'Google Gemini', 'Claude', 'DeepSeek',
                 'Midjourney', 'GitHub Copilot', 'Sektöre özel yazılımlar', 'Hiçbirini kullanmıyorum'],
  },
  {
    metin: 'Ne sıklıkla kullanıyorsunuz?',
    tip: 'SINGLE_CHOICE', zorunlu: true,
    secenekler: ['Günlük', 'Haftada birkaç kez', 'Ayda birkaç kez', 'Çok nadir', 'Hiç kullanmıyorum'],
  },
  {
    metin: 'Bu araçlara genelde nasıl erişiyorsunuz?',
    tip: 'SINGLE_CHOICE', zorunlu: true,
    secenekler: ['Kişisel hesap (ücretsiz sürüm)', 'Kişisel hesap (ücretli, kendim ödüyorum)',
                 'Şirket hesabı', 'Hem kişisel hem şirket hesabı', 'Kullanmıyorum'],
  },
  {
    metin: 'Hangi cihazlardan kullanıyorsunuz?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['Şirket bilgisayarı', 'Kişisel telefon', 'Kişisel bilgisayar', 'Tablet', 'Kullanmıyorum'],
  },
  {
    metin: 'Hangi amaçlarla kullanıyorsunuz?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['İçerik üretimi', 'Veri analizi', 'Kod yazma / Geliştirme', 'Çeviri',
                 'Müşteri iletişimi', 'Tasarım', 'Araştırma / Bilgi toplama', 'Raporlama',
                 'E-posta yazımı', 'Sunum hazırlama'],
  },
  {
    metin: 'Destek alırken hangi tür içeriklerle çalışıyorsunuz?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['Genel sorular (içerik girmeden)', 'Kendi yazdığım taslak metinler',
                 'Şirket dokümanları (rapor, prosedür, talimat)', 'Tablolar ve sayısal veriler',
                 'Teknik çizim, kod veya ürün bilgisi', 'Müşteri veya tedarikçi yazışmaları',
                 'Personel bilgileri içeren içerikler'],
  },
  {
    metin: 'Uzun bir doküman veya tabloyla çalışmanız gerektiğinde genelde nasıl ilerlersiniz?',
    tip: 'SINGLE_CHOICE', zorunlu: true,
    secenekler: ['Dosyayı araca yüklerim', 'İçeriği kopyalayıp yapıştırırım',
                 'Yalnızca soru sorarım, içerik girmem', 'Bu tür işlerde yapay zekâ kullanmam'],
  },
  {
    metin: 'Araca içerik girerken genelde nasıl çalışırsınız?',
    tip: 'SINGLE_CHOICE', zorunlu: true,
    secenekler: ['Metni/dosyayı olduğu gibi veririm, hızlı olur',
                 'Önce kısaltır, gereksiz kısımları çıkarırım',
                 'İçeriği kendi cümlelerimle özetleyerek sorarım',
                 'İçerik girmem, sadece soru sorarım'],
  },
  {
    metin: 'Yapay zekânın en çok zaman kazandırdığı bir görevi kısaca yazar mısınız? ' +
           '(Eskiden ne kadar sürüyordu, şimdi ne kadar sürüyor?)',
    tip: 'TEXT_LONG', zorunlu: false, secenekler: [],
  },
  {
    metin: 'Kazandığınız zamanı nasıl değerlendiriyorsunuz?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['Aynı sürede daha fazla iş üretiyorum (Hacim artışı)',
                 'İşin kalitesi/detayı arttı, hata oranı azaldı (Kalite artışı)',
                 'Daha stratejik/yaratıcı projelere vakit ayırabiliyorum (İnovasyon)',
                 'İş yüküm azaldı, iş-yaşam dengem iyileşti',
                 'Diğer ekip üyelerine destek oluyorum',
                 'Henüz belirgin bir değişiklik olmadı'],
  },
  {
    metin: 'Daha verimli kullanmak için neye ihtiyacınız var?',
    tip: 'MULTIPLE_CHOICE', zorunlu: true,
    secenekler: ['Eğitim', 'Lisanslı araçlar', 'Entegrasyon desteği', 'Yasal rehberlik',
                 'Yönetim desteği / Onay', 'Daha fazla zamana ihtiyacım var'],
  },
  { metin: 'Eklemek istedikleriniz', tip: 'TEXT_LONG', zorunlu: false, secenekler: [] },
]

async function main() {
  console.log(`mod: ${APPLY ? 'GERCEK YAZIM (--apply)' : 'DRY-RUN (yazma yok)'}\n`)

  const survey = await prisma.survey.findUnique({
    where: { id: SURVEY_ID },
    select: { id: true, surveyNumber: true, title: true, isAnonymous: true,
              requireAllQuestions: true, description: true,
              _count: { select: { responses: true, questions: true } } },
  })
  if (!survey) throw new Error(`Anket bulunamadi: ${SURVEY_ID}`)

  // ── GÜVENLİK KAPISI ──────────────────────────────────────────────────────
  if (survey._count.responses > 0) {
    console.error(`❌ IPTAL: ankette ${survey._count.responses} yanit var — soru seti degistirilemez.`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const bolumler = await prisma.departmentDefinition.findMany({
    where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' },
  })
  console.log(`aktif bolum sayisi (1. sorunun secenekleri): ${bolumler.length}`)

  const eski = await prisma.surveyQuestion.findMany({
    where: { surveyId: SURVEY_ID },
    select: { id: true, sortOrder: true, questionText: true, questionType: true, isRequired: true,
              _count: { select: { options: true } } },
    orderBy: { sortOrder: 'asc' },
  })

  console.log(`\n── ESKI (${eski.length} soru) ──`)
  for (const q of eski) {
    console.log(`  ${String(q.sortOrder).padStart(2)}. [${q.questionType}]${q.isRequired ? '*' : ' '} ` +
                `${q.questionText.slice(0, 62)}  (${q._count.options} sec)`)
  }

  console.log(`\n── YENI (${SORULAR.length} soru) ──`)
  SORULAR.forEach((q, i) => {
    const n = q.secenekler === null ? bolumler.length : q.secenekler.length
    console.log(`  ${String(i + 1).padStart(2)}. [${q.tip}]${q.zorunlu ? '*' : ' '} ` +
                `${q.metin.slice(0, 62)}  (${n} sec)`)
  })

  console.log(`\nSurvey ayarlari: isAnonymous ${survey.isAnonymous} -> true` +
              `  |  requireAllQuestions ${survey.requireAllQuestions} -> false` +
              `  |  aciklama ${survey.description === ACIKLAMA ? 'AYNI' : 'DEGISECEK'}`)

  if (!APPLY) {
    console.log('\nDRY-RUN — hicbir sey yazilmadi. Gercek kosu: --apply')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.survey.update({
      where: { id: SURVEY_ID },
      data: { isAnonymous: true, requireAllQuestions: false, description: ACIKLAMA },
    })
    // Yanıt yok (kapı geçildi) → SurveyAnswer da yok; sorular güvenle silinir.
    await tx.surveyQuestion.deleteMany({ where: { surveyId: SURVEY_ID } })

    for (let i = 0; i < SORULAR.length; i++) {
      const q = SORULAR[i]
      const secenekler = q.secenekler === null ? bolumler.map((b) => b.name) : q.secenekler
      await tx.surveyQuestion.create({
        data: {
          surveyId: SURVEY_ID,
          questionText: q.metin,
          questionType: q.tip,
          isRequired: q.zorunlu,
          sortOrder: i + 1,
          options: secenekler.length
            ? { create: secenekler.map((s, j) => ({ optionText: s, sortOrder: j + 1 })) }
            : undefined,
        },
      })
    }
  })
  console.log(`\n✅ uygulandi: ${SORULAR.length} soru yazildi, anket anonim moda alindi.`)
  await prisma.$disconnect()
}
main()
