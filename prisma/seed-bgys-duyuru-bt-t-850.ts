/**
 * BT-T-850 Yayım Duyurusu — BGYS Audit Evidence
 *
 * ISO 27001:2022 A.5.10 (Acceptable Use) kontrolü için kanıt kaydı.
 * Siber Hijyen Denetimi Madde 1.3 destekleyici delili.
 *
 * Schema notları:
 *  - Model: Announcement (İngilizce isimlendirme)
 *  - content alanı: HTML/Markdown destekli String @db.Text
 *  - Hedef kitle: targetType enum + targetDepartments/targetRoles String[]
 *  - Kategori opsiyonel (categoryId FK). "Bilgi Güvenliği" kategorisi
 *    yoksa upsert ile oluşturulur.
 *  - status enum: DRAFT/SCHEDULED/PUBLISHED/ARCHIVED → PUBLISHED kullanılır
 *  - priority enum: LOW/NORMAL/HIGH/URGENT → HIGH kullanılır
 *  - Author bilgileri denormalize: authorId/authorEmail/authorName/authorDepartment
 *    (FK relation yok, bu yüzden user'dan elle kopyalanır)
 *  - publishedAt elle ayarlanır (üretim ortamında bu alanı genelde
 *    publish action'ı doldurur).
 *  - requireAcknowledgment=true → AnnouncementRead.acknowledged kayıtları
 *    BGYS okundu kanıtı olarak kullanılabilir (sonraki rapor scriptinde).
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

const BASLIK =
  'BT-T-850 Bilişim Sistemleri Kullanım Yönetmeliği Yayımlandı — Tüm Çalışanların Onayı Beklenmektedir'

const OZET =
  "BT-T-850 Bilişim Sistemleri Kullanım Yönetmeliği yayımlandı. Tüm çalışanların 13 Mayıs 2026'ya kadar onaylaması gerekiyor."

const ICERIK_HTML = `<p>Değerli Çalışma Arkadaşlarımız,</p>

<p>İleri Group bünyesinde uygulanan <strong>ISO 27001:2022 Bilgi Güvenliği Yönetim Sistemi (BGYS)</strong> kapsamında, bilişim sistemlerinin doğru, güvenli ve sorumlu kullanımına yönelik kuralları belirleyen yeni yönetmeliğimiz yayımlanmıştır.</p>

<ul>
  <li><strong>Doküman:</strong> BT-T-850 Bilişim Sistemleri Kullanım Yönetmeliği — Kabul Edilebilir Kullanım Kuralları</li>
  <li><strong>Doküman No:</strong> ISO-DOC-2025-0011</li>
  <li><strong>Versiyon:</strong> 1.0 (Yayında)</li>
  <li><strong>İlgili ISO 27001:2022 Kontrolü:</strong> A.5.10</li>
</ul>

<hr />

<h2>Yönetmeliğin Kapsamı</h2>

<p>Yönetmelik, günlük iş süreçlerinizde kullandığınız tüm bilişim varlıklarına yönelik kuralları içermektedir:</p>

<ul>
  <li>Kurumsal e-posta ve iletişim araçlarının kullanımı</li>
  <li>İnternet erişimi ve web tarayıcı güvenliği</li>
  <li>Taşınabilir medya (USB, harici disk vb.) kullanımı</li>
  <li>Mobil cihaz ve uzaktan çalışma kuralları</li>
  <li>Parola yönetimi ve hesap güvenliği</li>
  <li>Yazılım yükleme ve lisans uyumu</li>
  <li>Bilgi sınıflandırması ve paylaşım kuralları</li>
</ul>

<p>Bu kurallar, hem kurumsal bilgi varlıklarımızın korunması hem de KVKK ve müşterilerimize karşı sözleşmesel yükümlülüklerimizin yerine getirilmesi için zorunludur.</p>

<hr />

<h2>Yapmanız Gerekenler</h2>

<ol>
  <li><strong>ILERIHub &gt; Dokümanlar &gt; ISO 27001</strong> menüsünden BT-T-850 yönetmeliğini açıp okuyunuz.</li>
  <li><strong>ILERIHub &gt; ISO 27001 &gt; Eğitimlerim</strong> modülünden ilgili eğitimi tamamlayıp dijital onayınızı veriniz.</li>
  <li><strong>Son tarih: 13 Mayıs 2026 (Çarşamba)</strong></li>
</ol>

<p>Onayını veren çalışanlarımız sistem tarafından otomatik olarak kayıt altına alınacaktır. Süre sonunda tamamlamayan personel, yöneticileri ile birlikte hatırlatılacaktır.</p>

<hr />

<h2>Sorularınız İçin</h2>

<p>Yönetmeliğin içeriği veya uygulanması ile ilgili sorularınız için <strong>Sistem Geliştirme Müdürlüğü</strong> ile iletişime geçebilirsiniz.</p>

<p><em>Bilgi güvenliği hepimizin sorumluluğudur. Katkılarınız için teşekkür ederiz.</em></p>

<p>
  <strong>Hazırlayan:</strong> Melike Balaban — Sistem Geliştirme Mühendisi<br />
  <strong>Onaylayan:</strong> Halit İleri — Genel Müdür
</p>`

async function findYayimlayan() {
  // Önce Melike Balaban
  const melike = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'melike', mode: 'insensitive' } },
        { name: { contains: 'Melike Balaban', mode: 'insensitive' } },
      ],
    },
  })
  if (melike) return melike

  // Fallback: Melih Dilben
  const melih = await prisma.user.findFirst({
    where: { email: { contains: 'melih', mode: 'insensitive' } },
  })
  if (melih) return melih

  throw new Error('Yayımlayan kullanıcı bulunamadı (Melike/Melih). Fake user oluşturulmuyor.')
}

async function ensureCategory() {
  // BGYS / Bilgi Güvenliği kategorisi varsa kullan, yoksa oluştur
  const existing = await prisma.announcementCategory.findUnique({
    where: { name: 'Bilgi Güvenliği' },
  })
  if (existing) return existing

  return await prisma.announcementCategory.create({
    data: {
      name: 'Bilgi Güvenliği',
      description: 'ISO 27001 BGYS kapsamındaki politika, prosedür ve yönetmelik duyuruları',
      color: '#dc2626',
      icon: 'ShieldCheck',
      isActive: true,
      sortOrder: 10,
    },
  })
}

async function main() {
  console.log('🔍 Yayımlayan kullanıcı aranıyor...')
  const yayimlayan = await findYayimlayan()
  console.log(`   Bulundu: ${yayimlayan.name} <${yayimlayan.email}>`)

  console.log('🔍 Bilgi Güvenliği kategorisi hazırlanıyor...')
  const kategori = await ensureCategory()
  console.log(`   Kategori: ${kategori.name} (${kategori.id})`)

  // Idempotency: BT-T-850 başlıklı eski kayıtları sil
  const silinen = await prisma.announcement.deleteMany({
    where: { title: { contains: 'BT-T-850' } },
  })
  console.log(`🗑️  Eski duyuru kayıtları silindi: ${silinen.count}`)

  // Tarihler
  const yayinTarihi = new Date()
  const sonGecerlilik = new Date()
  sonGecerlilik.setDate(sonGecerlilik.getDate() + 14)

  // Yeni duyuru
  const duyuru = await prisma.announcement.create({
    data: {
      title: BASLIK,
      summary: OZET,
      content: ICERIK_HTML,

      categoryId: kategori.id,
      priority: 'HIGH',

      targetType: 'ALL',
      targetDepartments: [],
      targetRoles: [],

      status: 'PUBLISHED',
      isPinned: true,
      publishAt: yayinTarihi,
      expiresAt: sonGecerlilik,
      publishedAt: yayinTarihi,

      allowComments: true,
      allowReactions: true,
      requireAcknowledgment: true, // BGYS okundu onayı

      authorId: yayimlayan.id,
      authorEmail: yayimlayan.email,
      authorName: yayimlayan.name || `${yayimlayan.firstName ?? ''} ${yayimlayan.lastName ?? ''}`.trim(),
      authorDepartment: yayimlayan.department,
    },
  })

  console.log('')
  console.log('✅ BT-T-850 yayım duyurusu oluşturuldu')
  console.log(`   Duyuru ID:        ${duyuru.id}`)
  console.log(`   Başlık:           ${duyuru.title}`)
  console.log(`   Yayımlayan:       ${duyuru.authorName} (${duyuru.authorEmail})`)
  console.log(`   Yayım Tarihi:     ${duyuru.publishedAt?.toISOString()}`)
  console.log(`   Son Geçerlilik:   ${duyuru.expiresAt?.toISOString()}`)
  console.log(`   Durum:            ${duyuru.status}`)
  console.log(`   Sabitlenmiş:      ${duyuru.isPinned}`)
  console.log(`   Okundu Onayı:     ${duyuru.requireAcknowledgment}`)
  console.log('')
  console.log('🔗 ILERIHub > Duyurular modülünde kontrol et:')
  console.log('   - Liste sayfasında görünmeli')
  console.log('   - Detay sayfası açıldığında içerik doğru render olmalı')
  console.log('   - Sabitlenmiş (pinned) olarak en üstte durmalı')
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
