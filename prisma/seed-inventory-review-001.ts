/**
 * BGYS-EGG-2026-001 — İlk Envanter Gözden Geçirme Tutanağı
 *
 * ISO 27001:2022 A.5.9 + Madde 9.1 kanıtı (Siber Hijyen Denetimi 1.6).
 * Seed pattern: PrismaPg + pg.Pool + dotenv (proje standardı).
 * Idempotent: tutanakNo ile mevcut kaydı silip yeniden oluşturur.
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TUTANAK_NO = 'BGYS-EGG-2026-001'

const AMAC_MD = `Bu tutanak, ISO 27001:2022 Bilgi Güvenliği Yönetim Sistemi (BGYS) kapsamında yürütülen **L11.711 Varlık Grupları Listesi** envanterinin yıllık gözden geçirme aktivitesini kayıt altına almak amacıyla hazırlanmıştır.

İlgili ISO 27001:2022 kontrolleri: A.5.9 (Bilgi ve diğer ilişkili varlıkların envanteri), Madde 9.1 (İzleme ve ölçme), Madde 9.3 (Yönetim gözden geçirme).`

const KAPSAM_MD = `Gözden geçirme aktivitesi, L11.711 dokümanının üç sekmesini kapsamaktadır:

- 1-Donanım Varlıkları (bilgisayar, laptop, sunucu, ağ cihazları)
- 2-Yazılım Varlıkları (kurulu yazılımlar, lisans bilgileri)
- 3-Bilgi Varlıkları (veritabanları, dokümanlar, kritik bilgi kaynakları)

Bağlı doküman: **L11.711.7 Güncel Yazılım Listesi** (yazılım varlıklarının detaylı takibi için bağımsız envanter).`

const SUREC_MD = `L11.711 envanteri 2025 yılı boyunca; satın alma, zimmet, görev başlangıcı/sonu, hurda gibi operasyonel olaylar kapsamında **sürekli güncellenmiştir**. Bu güncellemeler Sistem Geliştirme Müdürlüğü tarafından yürütülmüş ve ESET PROTECT konsolu ile Microsoft Entra ID üzerinden teknik olarak izlenmiştir.

Bu güncellemelerin **tutanaklı/formel kaydı**, BGYS belgelendirme süreci kapsamında **2026 yılında** başlatılmıştır. İşbu tutanak, bu yapının ilk kaydıdır. Bundan sonraki gözden geçirmeler yıllık periyotlarla, aynı format kullanılarak kayıt altına alınacaktır.`

const BULGULAR_MD = `## Genel Değerlendirme

- Envanter güncel durumda olup tüm kritik bilişim varlıkları kayıt altındadır.
- Personel görev değişiklikleri zimmet süreci üzerinden envantere yansıtılmaktadır.
- ESET PROTECT konsolu ve Microsoft Entra ID üzerinden cihaz×kullanıcı eşleşmesi gerçek zamanlı izlenebilmektedir.

## Tespit Edilen İyileştirme Alanları

1. **Varlık Değeri Sınıfı sütunu**: Mevcut kayıtlarda bu sütun büyük oranda boş durumdadır. ISO 27001:2022 A.5.12 (Bilgilerin Sınıflandırması) kontrolü kapsamında, tüm kayıtlar için doldurulması süreci başlatılacaktır.

2. **İmha Kayıtları**: Hurda/imha edilen varlıklar için "İmha Tarihi" ve "İmha Yöntemi" sütunlarının sistematik olarak doldurulması iyileştirme alanı olarak belirlenmiştir. ISO 27001:2022 A.7.10 (Depolama medyası) ve A.7.14 (Ekipmanın güvenli imhası veya yeniden kullanımı) kontrolleri ile bağlantılıdır.

3. **Yıllık Tutanaklı Süreç**: Envanter gözden geçirmesinin yıllık tutanaklı yapıya kavuşturulması 2026 itibarıyla devreye alınmıştır. Bu tutanak, sürecin ilk kaydıdır.

## Risk Analizi ile Bağlantı

Envanter gözden geçirme sonuçları, **L11.612_1 Risk Analizi ve İşleme Planı** dokümanı ile birlikte değerlendirilmek üzere BGYS Sorumlusu'na iletilecektir. Yeni tespit edilen varlıklar için risk değerlendirmesi güncellenecek, ayrılan varlıklar risk envanterinden kaldırılacaktır.`

const SONUC_AKSIYONLAR = [
  {
    no: 1,
    aksiyon:
      'Varlık Değeri Sınıfı sütunlarının tüm kayıtlar için tamamlanması (A.5.12)',
    sorumlu: 'Melike Balaban',
    termin: '2026-07-31',
    durum: 'AÇIK',
  },
  {
    no: 2,
    aksiyon:
      'Hurda/imha edilen varlıklar için İmha Tarihi ve İmha Yöntemi sütunlarının sistematik doldurulması',
    sorumlu: 'Melike Balaban',
    termin: '2026-06-30',
    durum: 'AÇIK',
  },
  {
    no: 3,
    aksiyon:
      'Sonraki yıllık envanter gözden geçirme aktivitesi (BGYS-EGG-2027-001)',
    sorumlu: 'Melike Balaban',
    termin: '2027-04-28',
    durum: 'PLANLI',
  },
  {
    no: 4,
    aksiyon:
      "İç Denetim Soru Listesi'ne \"Yıllık Envanter Gözden Geçirme\" maddesi eklenmesi",
    sorumlu: 'Melih Dilben',
    termin: '2026-05-31',
    durum: 'AÇIK',
  },
]

async function findHazirlayan() {
  const melike = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'melike', mode: 'insensitive' } },
        { name: { contains: 'Melike Balaban', mode: 'insensitive' } },
      ],
    },
  })
  if (!melike) {
    throw new Error('Hazırlayan kullanıcı (Melike Balaban) bulunamadı')
  }
  return melike
}

async function main() {
  console.log('🔍 Hazırlayan kullanıcı aranıyor...')
  const hazirlayan = await findHazirlayan()
  console.log(`   ${hazirlayan.name} <${hazirlayan.email}>`)

  // Idempotency
  const silinen = await prisma.inventoryReview.deleteMany({
    where: { tutanakNo: TUTANAK_NO },
  })
  console.log(`🗑️  Eski kayıtlar silindi: ${silinen.count}`)

  const review = await prisma.inventoryReview.create({
    data: {
      tutanakNo: TUTANAK_NO,
      internalCode: 'L11.711-EGG-2026-01',
      baslik:
        'Bilgi Varlıkları Envanteri Yıllık Gözden Geçirme Tutanağı (2026-01)',

      reviewDate: new Date('2026-04-29'),
      nextReviewDate: new Date('2027-04-28'),

      hardwareCount: 453,
      softwareCount: null, // PR-EGG-2'de L11.711'den otomatik çekilecek
      informationCount: null, // PR-EGG-2'de L11.711'den otomatik çekilecek

      amac: AMAC_MD,
      kapsam: KAPSAM_MD,
      surecTarihcesi: SUREC_MD,
      bulgular: BULGULAR_MD,
      sonucAksiyonlar: SONUC_AKSIYONLAR,

      iliskiliDokumanIds: [
        'ISO-DOC-2025-0012', // L11.711
        'ISO-DOC-2025-0013', // L11.711.7
        'ISO-DOC-2025-0014', // L11.612_1 Risk Analizi
        'ISO-DOC-2026-0001', // BGYS-YGG-001
        'ISO-DOC-2026-0003', // ISO27001-91-Izleme-Olcme
        'ISO-DOC-2026-0006', // İç Denetim Soru Listesi
      ],

      hazirlayanId: hazirlayan.id,
      hazirlayanAd: 'Melike Balaban',
      hazirlayanUnvan: 'Sistem Geliştirme Mühendisi',

      onaylayanId: null,
      onaylayanAd: 'Halit İleri',
      onaylayanUnvan: 'Genel Müdür',

      hazirlanmaTarihi: new Date('2026-04-29'),
      onayTarihi: null,

      durum: 'PENDING_APPROVAL',
    },
  })

  console.log('')
  console.log('✅ Envanter Gözden Geçirme Tutanağı oluşturuldu')
  console.log(`   ID:           ${review.id}`)
  console.log(`   Tutanak No:   ${review.tutanakNo}`)
  console.log(`   İç Kod:       ${review.internalCode}`)
  console.log(`   Hazırlayan:   ${review.hazirlayanAd} (${review.hazirlayanUnvan})`)
  console.log(`   Beklenen Onay: ${review.onaylayanAd} (${review.onaylayanUnvan})`)
  console.log(`   Durum:        ${review.durum}`)
  console.log(`   Sonraki:      ${review.nextReviewDate.toISOString().split('T')[0]}`)
  console.log('')
  console.log('🔗 Doğrulama URL:')
  console.log(`   /iso27001/envanter-gozden-gecirme/${review.id}`)
  console.log(`   /iso27001/envanter-gozden-gecirme/${review.id}/yazdir`)
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
