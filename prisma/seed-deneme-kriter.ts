/**
 * IV-FR-27 · Deneme Süresi Değerlendirme — Kriter Kataloğu Seed
 *
 * Form: IV-FR-27 Rev.2 (18.01.2021). 20 kriter, 4 grup, her biri 1-5 puan
 * (1 Çok Yetersiz · 2 Yetersiz · 3 Orta · 4 İyi · 5 Çok İyi).
 * 2 ay ve 6 ay formları BİREBİR AYNI — tek katalog, tür ayrımı form üzerinde.
 *
 * Idempotent davranış:
 *   - Anahtar (revizyon, sira) — tekrar çalışınca çoğaltmaz, metinleri refresh eder
 *   - `aktif` BİLİNÇLİ olarak update'te DIŞARIDA — İV bir kriteri elle kapattıysa
 *     seed onu geri açmasın (seed-arsiv-evrak-turu.ts'teki `aktifMi` deseninin aynısı)
 *   - Katalogda olmayan (elle eklenmiş) kriterler SİLİNMEZ
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env prisma/seed-deneme-kriter.ts
 */

import { PrismaClient, DenemeKriterGrup } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const REVIZYON = 'Rev.2'

type Kriter = { sira: number; grup: DenemeKriterGrup; baslik: string; aciklama: string }

// Metinler forma AYNEN sadıktır — kısaltma/düzeltme yapılmadı.
const KRITERLER: Kriter[] = [
  // ── MESLEKİ YETERLİLİK (1-5) ──
  { sira: 1, grup: 'MESLEKI', baslik: 'İş Bilgisi',
    aciklama: 'Yaptığı işe ilişkin teorik ve pratik bilgi düzeyi' },
  { sira: 2, grup: 'MESLEKI', baslik: 'Verimlilik',
    aciklama: 'Görevini kurallara uygun, istenilen zamanda ve miktarda yapabilmesi' },
  { sira: 3, grup: 'MESLEKI', baslik: 'İş Kalitesi',
    aciklama: 'İşini standartlara uygun olarak yapabilme' },
  { sira: 4, grup: 'MESLEKI', baslik: 'Sorumluluk',
    aciklama: 'Görev sorumluluğu, araç gereç kullanımı, sonuçları üstlenme' },
  { sira: 5, grup: 'MESLEKI', baslik: 'Problem Çözme ve Üretkenlik',
    aciklama: 'Problemleri hızlı ve doğru çözme, fikir geliştirme, araştırma, farklı düşünceler ortaya koyma' },

  // ── DAVRANIŞSAL YETERLİLİK (6-11) ──
  { sira: 6, grup: 'DAVRANISSAL', baslik: 'İnsan İlişkileri',
    aciklama: 'Üstleri, astları, çalışma arkadaşları ve çevresiyle uyumlu ilişkiler ve sağlıklı iletişim' },
  { sira: 7, grup: 'DAVRANISSAL', baslik: 'Organizasyon Becerisi',
    aciklama: 'Verilen görevi organize edebilme ve sonuçlarını takip edebilme' },
  { sira: 8, grup: 'DAVRANISSAL', baslik: 'Öğrenmeye Yatkın Olma',
    aciklama: 'Hizmet içi eğitim ve görev aldığı çalışmalarda başarılı performans' },
  { sira: 9, grup: 'DAVRANISSAL', baslik: 'Girişimcilik ve Yeniliklere Yatkın Olma',
    aciklama: 'Güncel olayları takip, yönetime yeni öneriler sunabilme' },
  { sira: 10, grup: 'DAVRANISSAL', baslik: 'Takım Çalışması',
    aciklama: 'İşbirliği ve dayanışma, bilgiyi paylaşma' },
  { sira: 11, grup: 'DAVRANISSAL', baslik: 'Hizmete Odaklılık',
    aciklama: 'Diğer birimler ve toplumun beklentileri doğrultusunda görevini yerine getirebilme' },

  // ── BİREYSEL YETERLİLİK (12-15) ──
  { sira: 12, grup: 'BIREYSEL', baslik: 'Karar Alma',
    aciklama: 'Kendisini ilgilendiren konularda karar alabilme, inisiyatif kullanabilme' },
  { sira: 13, grup: 'BIREYSEL', baslik: 'Programlı Çalışma',
    aciklama: 'Çalışmalarını önem ve aciliyetine göre sıraya koyarak bitirebilme' },
  { sira: 14, grup: 'BIREYSEL', baslik: 'İşe Bağlılığı',
    aciklama: 'Yaptığı işi benimseme, işe ve kuruma bağlılık' },
  { sira: 15, grup: 'BIREYSEL', baslik: 'Esneklik',
    aciklama: 'Yöneticisinin bilgi ve izniyle verilen diğer görevleri yerine getirme' },

  // ── ÇALIŞANLAR İÇİN KRİTERLER (16-20) ──
  { sira: 16, grup: 'CALISAN', baslik: 'Temsil Yeteneği',
    aciklama: 'Dış görünüş, tavır ve davranışlarla temsil' },
  { sira: 17, grup: 'CALISAN', baslik: 'İletişim Becerisi',
    aciklama: 'Yazılı/sözlü iletişim ve beden dili' },
  { sira: 18, grup: 'CALISAN', baslik: 'Çalışma Masası ve Mekanı Temiz ve Tertipli Tutma',
    aciklama: 'Çalışma masası ve mekanını temiz ve tertipli tutma' },
  { sira: 19, grup: 'CALISAN', baslik: 'Kullandığı Araç ve Gereci Koruma ve Tasarruf Yapabilme',
    aciklama: 'Kullandığı araç ve gereci koruma ve tasarruf yapabilme' },
  { sira: 20, grup: 'CALISAN', baslik: 'Kendisine Verilen Görevleri Yerine Getirebilme',
    aciklama: 'Kendisine verilen görevleri yerine getirebilme' },
]

async function main() {
  if (KRITERLER.length !== 20) throw new Error(`Katalog 20 kriter olmalı, ${KRITERLER.length} bulundu`)

  let eklenen = 0
  let guncellenen = 0

  for (const k of KRITERLER) {
    const mevcut = await prisma.denemeKriter.findUnique({
      where: { revizyon_sira: { revizyon: REVIZYON, sira: k.sira } },
      select: { id: true },
    })

    await prisma.denemeKriter.upsert({
      where: { revizyon_sira: { revizyon: REVIZYON, sira: k.sira } },
      // `aktif` update'te YOK — İV elle kapattıysa seed geri açmasın.
      update: { grup: k.grup, baslik: k.baslik, aciklama: k.aciklama, sortOrder: k.sira },
      create: {
        revizyon: REVIZYON, sira: k.sira, grup: k.grup,
        baslik: k.baslik, aciklama: k.aciklama, aktif: true, sortOrder: k.sira,
      },
    })

    if (mevcut) guncellenen++
    else eklenen++
  }

  const gruplar = await prisma.denemeKriter.groupBy({
    by: ['grup'],
    where: { revizyon: REVIZYON },
    _count: true,
  })

  console.log(`IV-FR-27 ${REVIZYON} kriter kataloğu — eklenen: ${eklenen}, güncellenen: ${guncellenen}`)
  for (const g of gruplar) console.log(`   ${g.grup}: ${g._count}`)
  const toplam = await prisma.denemeKriter.count({ where: { revizyon: REVIZYON } })
  console.log(`   TOPLAM: ${toplam} (beklenen 20)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
