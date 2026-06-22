/**
 * ILERIHub Arşiv Modülü — Evrak Türü Seed
 *
 * Mevzuat dayanaklı default evrak türleri. Departman müdürleri kendi
 * modüllerinden ekleme/silme/süre değiştirme yapabilir; bu seed
 * sadece BAŞLANGIÇ değerlerini sağlar.
 *
 * Idempotent davranış:
 *   - varsayilanSaklamaYili ve yasalDayanak her seferinde refresh edilir
 *   - aktifMi BİLİNÇLİ olarak update'te DIŞARIDA — departman manuel
 *     deaktive etmiş olabilir, seed onu reaktif etmesin
 *   - EVRAK_MATRISI'nde olmayan türler (departmanın elle eklediği) silinmez
 *
 * Çalıştırma:
 *   cd /home/rokunet/projects/ilerihub
 *   npx tsx --env-file=.env prisma/seed-arsiv-evrak-turu.ts
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// "Süresiz" için cap. CHECK constraint'in izin verdiği güvenli üst değer.
// Patent/teknik resim için departman daha yüksek isterse UI'dan modifiye etsin.
const SURESIZ = 30

type EvrakTanimi = {
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak: string
}

const EVRAK_MATRISI: Record<string, EvrakTanimi[]> = {
  // ──────────────────────────────────────────────────────────
  FAB: [ // Fabrika Müdürlüğü (eski URP - Üretim Planlama)
    { ad: 'Üretim emri',                    varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82 + AQAP-2110 izlenebilirlik' },
    { ad: 'İş emri / iş kartı',             varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82 + AQAP-2110' },
    { ad: 'Üretim planı',                   varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Stok hareket raporu',            varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'MRP / plan revizyonu',           varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Kapasite / yük analiz raporu',   varsayilanSaklamaYili: 5,  yasalDayanak: 'İç pratik' },
    { ad: 'Üretim performans raporu',       varsayilanSaklamaYili: 5,  yasalDayanak: 'İç pratik' },
  ],
  // ──────────────────────────────────────────────────────────
  KAL: [ // Kalite
    { ad: 'Kalite kontrol formu',                          varsayilanSaklamaYili: 10,        yasalDayanak: 'ISO 9001 + AQAP-2110 m.7.5.3' },
    { ad: 'Kalibrasyon sertifikası',                       varsayilanSaklamaYili: 10,        yasalDayanak: 'AQAP-2110 + müşteri sözleşmesi' },
    { ad: 'İlk parça muayene raporu (FAI)',                varsayilanSaklamaYili: 10,        yasalDayanak: 'AQAP-2110' },
    { ad: 'Uygunsuzluk raporu (NCR)',                      varsayilanSaklamaYili: 10,        yasalDayanak: 'ISO 9001 + AQAP-2110' },
    { ad: 'Düzeltici / önleyici faaliyet (DÖF/CAPA)',      varsayilanSaklamaYili: 10,        yasalDayanak: 'ISO 9001 + AQAP-2110' },
    { ad: 'İç tetkik raporu',                              varsayilanSaklamaYili: 5,         yasalDayanak: 'ISO 9001 m.9.2' },
    { ad: 'Müşteri şikayet kaydı',                         varsayilanSaklamaYili: 10,        yasalDayanak: 'TTK m.82 + ISO 9001' },
    { ad: 'Sevkiyat muayene raporu',                       varsayilanSaklamaYili: 10,        yasalDayanak: 'AQAP-2131' },
    { ad: 'Test / muayene planı',                          varsayilanSaklamaYili: 10,        yasalDayanak: 'AQAP-2110' },
    { ad: 'Kalite el kitabı revizyonu',                    varsayilanSaklamaYili: SURESIZ,   yasalDayanak: 'Kurumsal kayıt' },
    { ad: 'Sertifika (ISO 9001 / AQAP)',                   varsayilanSaklamaYili: SURESIZ,   yasalDayanak: 'Kurumsal kayıt' },
  ],
  // ──────────────────────────────────────────────────────────
  SAT: [ // Satış
    { ad: 'Müşteri sözleşmesi',                varsayilanSaklamaYili: 10, yasalDayanak: 'TBK m.146 + TTK m.82' },
    { ad: 'Sözleşme eki / revizyon',           varsayilanSaklamaYili: 10, yasalDayanak: 'TBK m.146' },
    { ad: 'Teklif / proforma fatura',          varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Satış sipariş formu',               varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Sevk irsaliyesi',                   varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82 + VUK m.253' },
    { ad: 'İhracat / gümrük belgeleri',        varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82 + Gümrük K.' },
    { ad: 'CRM yazışma / e-posta arşivi',      varsayilanSaklamaYili: 5,  yasalDayanak: 'İç pratik' },
    { ad: 'Müşteri ziyaret raporu',            varsayilanSaklamaYili: 5,  yasalDayanak: 'İç pratik' },
    { ad: 'Pazarlama / tanıtım dokümanları',   varsayilanSaklamaYili: 5,  yasalDayanak: 'İç pratik' },
  ],
  // ──────────────────────────────────────────────────────────
  IVK: [ // İnsan Varlıkları (eski INS - İnsan Kaynakları)
    { ad: 'Özlük dosyası (işten çıkış sonrası)',  varsayilanSaklamaYili: 10,       yasalDayanak: 'İş K. m.75 + SGK 5510 m.86 + KVKK' },
    { ad: 'İş sözleşmesi',                        varsayilanSaklamaYili: 10,       yasalDayanak: 'TBK m.146' },
    { ad: 'Bordro / ücret kaydı',                 varsayilanSaklamaYili: 10,       yasalDayanak: 'SGK 5510 m.86' },
    { ad: 'Yıllık izin formu',                    varsayilanSaklamaYili: 10,       yasalDayanak: 'İş K. + Yıllık İzin Yön.' },
    { ad: 'İSG eğitim belgesi',                   varsayilanSaklamaYili: 15,       yasalDayanak: 'İSG Hiz. Yön. m.7/1' },
    { ad: 'Kişisel sağlık dosyası',               varsayilanSaklamaYili: 15,       yasalDayanak: 'İSG Hiz. Yön. m.7/1' },
    { ad: 'İş kazası tutanağı / raporu',          varsayilanSaklamaYili: 15,       yasalDayanak: 'İSG Hiz. Yön. m.7/1 + 5510' },
    { ad: 'SGK işe giriş / çıkış bildirgesi',     varsayilanSaklamaYili: 10,       yasalDayanak: 'SGK 5510 m.86' },
    { ad: 'Performans değerlendirme',             varsayilanSaklamaYili: 5,        yasalDayanak: 'İç pratik (KVKK amaçla sınırlı)' },
    { ad: 'İK politikası / yönetmelik',           varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Kurumsal kayıt' },
    { ad: 'Disiplin kararı / savunma',            varsayilanSaklamaYili: 10,       yasalDayanak: 'İş K. zamanaşımı' },
    { ad: 'Eğitim katılım tutanağı (İSG dışı)',   varsayilanSaklamaYili: 5,        yasalDayanak: 'İç pratik' },
    { ad: 'Adli sicil belgesi kopyası',           varsayilanSaklamaYili: 1,        yasalDayanak: 'KVKK — en geç 6 ayda imha (1 yıl üst sınır)' },
  ],
  // ──────────────────────────────────────────────────────────
  FMM: [ // Finans Muhasebe Müdürlüğü (eski MUH)
    { ad: 'Yevmiye defteri',                      varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Defter-i kebir',                       varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Envanter defteri',                     varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Alış faturası',                        varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82 (VUK 5 → üst sınır 10)' },
    { ad: 'Satış faturası',                       varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Banka dekontu / ekstre',               varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Vergi beyannamesi (KDV/Gelir/KV)',     varsayilanSaklamaYili: 5,  yasalDayanak: 'VUK m.253' },
    { ad: 'Gider pusulası / müstahsil makbuzu',   varsayilanSaklamaYili: 5,  yasalDayanak: 'VUK m.254' },
    { ad: 'Bilanço / gelir tablosu',              varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Kasa hareket fişi',                    varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Çek / senet kaydı',                    varsayilanSaklamaYili: 10, yasalDayanak: 'TTK m.82' },
    { ad: 'Sigorta poliçesi',                     varsayilanSaklamaYili: 10, yasalDayanak: 'TBK m.146' },
    { ad: 'Bordro tahakkuk / SGK e-bildirge',     varsayilanSaklamaYili: 10, yasalDayanak: 'SGK 5510 m.86' },
  ],
  // ──────────────────────────────────────────────────────────
  SAR: [ // Satınalma
    { ad: 'Tedarikçi sözleşmesi',                  varsayilanSaklamaYili: 10,       yasalDayanak: 'TBK m.146' },
    { ad: 'Sözleşme eki / revizyon',               varsayilanSaklamaYili: 10,       yasalDayanak: 'TBK m.146' },
    { ad: 'Satınalma siparişi',                    varsayilanSaklamaYili: 10,       yasalDayanak: 'TTK m.82' },
    { ad: 'Tedarikçi teklif değerlendirme',        varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 (kalite kaydı)' },
    { ad: 'Tedarikçi kalite belgesi (ISO/AQAP)',   varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 9001' },
    { ad: 'Mal kabul / muayene raporu',            varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2131' },
    { ad: 'Onaylı tedarikçi listesi (revizyon)',   varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110' },
    { ad: 'Gizlilik anlaşması (NDA)',              varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Sözleşme süresi + 10 yıl' },
    { ad: 'Tedarikçi denetim raporu',              varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 9001' },
  ],
  // ──────────────────────────────────────────────────────────
  SGM: [ // Sistem Geliştirme Müdürlüğü (eski BIL - Bilgi İşlem)
    { ad: 'İnternet / firewall trafik logu',       varsayilanSaklamaYili: 2,        yasalDayanak: '5651 sayılı Kanun' },
    { ad: 'Sistem / sunucu erişim logu',           varsayilanSaklamaYili: 2,        yasalDayanak: '5651 + ISO 27001 A.8.15' },
    { ad: 'Olay / incident kaydı',                 varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 27001 A.5.27' },
    { ad: 'Yazılım lisans belgesi',                varsayilanSaklamaYili: 10,       yasalDayanak: 'TBK m.146 (lisans + 5 yıl)' },
    { ad: 'Donanım envanter kaydı',                varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 27001 A.5.9' },
    { ad: 'Yedekleme / restore kaydı',             varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 27001 A.8.13' },
    { ad: 'Erişim yetki formu',                    varsayilanSaklamaYili: 10,       yasalDayanak: 'ISO 27001 A.5.18' },
    { ad: 'Kullanıcı politika onayı (KVKK/BGYS)',  varsayilanSaklamaYili: 10,       yasalDayanak: 'KVKK rıza + ISO 27001' },
    { ad: 'BGYS politika / prosedür dokümanı',     varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Kurumsal kayıt' },
    { ad: 'Risk değerlendirme raporu (BGYS)',      varsayilanSaklamaYili: 10,       yasalDayanak: 'ISO 27001 m.6.1' },
    { ad: 'İç tetkik raporu (BGYS)',               varsayilanSaklamaYili: 5,        yasalDayanak: 'ISO 27001 m.9.2' },
    { ad: 'Sertifika (ISO 27001)',                 varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Kurumsal kayıt' },
  ],
  // ──────────────────────────────────────────────────────────
  BAK: [ // Bakım
    { ad: 'Periyodik bakım kaydı',                 varsayilanSaklamaYili: 10,       yasalDayanak: 'ISO 9001 + AQAP-2110' },
    { ad: 'Arıza / onarım raporu',                 varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 + iş güvenliği' },
    { ad: 'Bakım sözleşmesi',                      varsayilanSaklamaYili: 10,       yasalDayanak: 'TBK m.146' },
    { ad: 'Yedek parça stok kaydı',                varsayilanSaklamaYili: 5,        yasalDayanak: 'İç pratik' },
    { ad: 'Kalibrasyon kaydı (BAK ekipmanları)',   varsayilanSaklamaYili: 10,       yasalDayanak: 'ISO 9001' },
    { ad: 'Garanti belgesi',                       varsayilanSaklamaYili: 10,       yasalDayanak: 'Garanti süresi + 5 yıl' },
    { ad: 'Tezgah / makine kullanım talimatı',     varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Kurumsal kayıt' },
  ],
  // ──────────────────────────────────────────────────────────
  MMT: [ // Mekanik Montaj (eski URT - Üretim)
    { ad: 'İş emri kaydı (üretim sahası)',         varsayilanSaklamaYili: 10,       yasalDayanak: 'TTK m.82 + AQAP-2110' },
    { ad: 'Günlük üretim raporu',                  varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 izlenebilirlik' },
    { ad: 'Vardiya raporu',                        varsayilanSaklamaYili: 5,        yasalDayanak: 'İç pratik' },
    { ad: 'Tezgah bakım kaydı (operatör)',         varsayilanSaklamaYili: 10,       yasalDayanak: 'ISO 9001' },
    { ad: 'Hammadde sarf kaydı',                   varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 izlenebilirlik' },
    { ad: 'Lot / parti izleme kaydı',              varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110' },
    { ad: 'Personel iş takip formu',               varsayilanSaklamaYili: 5,        yasalDayanak: 'İç pratik' },
    { ad: 'Üretim talimatı (Work Instruction)',    varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Kurumsal kayıt' },
  ],
  // ──────────────────────────────────────────────────────────
  MHN: [ // Mühendislik (eski TAS - Tasarım / AR-GE)
    { ad: 'Teknik resim / CAD dosyası',            varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Sınai mülkiyet + müşteri sözleşmesi' },
    { ad: 'Tasarım gözden geçirme kaydı',          varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 m.7.3' },
    { ad: 'Ürün şartnamesi (PRD)',                 varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Ürün ömrü + 10 yıl' },
    { ad: 'Test / doğrulama raporu',               varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110' },
    { ad: 'AR-GE proje dosyası',                   varsayilanSaklamaYili: 10,       yasalDayanak: 'TÜBİTAK/KOSGEB destekli ise 10+ yıl' },
    { ad: 'Patent / sınai mülkiyet belgesi',       varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Süresiz' },
    { ad: 'Tasarım değişiklik talimatı (ECN/ECO)', varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110' },
    { ad: 'Yazılım kaynak kodu / dokümantasyon',   varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Ürün ömrü + 10 yıl' },
    { ad: 'Müşteri tasarım gereksinim dosyası',    varsayilanSaklamaYili: SURESIZ,  yasalDayanak: 'Sözleşme süresi + 10 yıl' },
    { ad: 'Prototip / numune kayıtları',           varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110' },
    { ad: 'Risk analizi (FMEA)',                   varsayilanSaklamaYili: 10,       yasalDayanak: 'AQAP-2110 + ISO 9001' },
  ],
}

async function main() {
  console.log('🗂️  Arşiv evrak türü seed başlıyor...')

  // Bolum kod -> ID lookup
  const bolumler = await prisma.arsivBolum.findMany({
    select: { id: true, kod: true },
  })
  const kodToId: Record<string, number> = Object.fromEntries(
    bolumler.map((b) => [b.kod, b.id])
  )

  console.log(`📋 Bulunan bolum: ${bolumler.length} (${Object.keys(kodToId).join(', ')})`)

  let yeniEklenen = 0
  let guncellenen = 0
  let atlanan = 0
  const eksikBolumler: string[] = []

  for (const [kod, evraklar] of Object.entries(EVRAK_MATRISI)) {
    const bolumId = kodToId[kod]
    if (!bolumId) {
      eksikBolumler.push(kod)
      atlanan += evraklar.length
      continue
    }

    for (const evrak of evraklar) {
      // Önce var mı kontrol et (sayım için)
      const mevcut = await prisma.arsivEvrakTuru.findUnique({
        where: {
          bolumId_ad: { bolumId, ad: evrak.ad },
        },
      })

      await prisma.arsivEvrakTuru.upsert({
        where: {
          bolumId_ad: { bolumId, ad: evrak.ad },
        },
        update: {
          // aktifMi BİLİNÇLİ olarak DIŞARIDA — runtime durumu korunur
          varsayilanSaklamaYili: evrak.varsayilanSaklamaYili,
          yasalDayanak: evrak.yasalDayanak,
        },
        create: {
          bolumId,
          ad: evrak.ad,
          varsayilanSaklamaYili: evrak.varsayilanSaklamaYili,
          yasalDayanak: evrak.yasalDayanak,
          aktifMi: true,
        },
      })

      if (mevcut) guncellenen++
      else yeniEklenen++
    }
  }

  console.log('')
  console.log(`✅ Yeni eklenen:  ${yeniEklenen}`)
  console.log(`🔄 Güncellenen:   ${guncellenen}`)
  if (atlanan > 0) {
    console.log(`⚠️  Atlanan:       ${atlanan} (eksik bolum: ${eksikBolumler.join(', ')})`)
  }
  console.log(`📊 Toplam matris: ${yeniEklenen + guncellenen + atlanan} evrak türü`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
