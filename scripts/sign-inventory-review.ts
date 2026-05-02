/**
 * BGYS-EGG-2026-001 dijital imzalama scripti.
 *
 * İki imzalı tutanak (Hazırlayan + Onaylayan) için:
 *  1. İçerik hash'i (SHA-256) hesaplanır — kanonik içerik bütünlük kanıtı
 *  2. Her imzalayan için signatureCode üretilir (ILH-INV-YYYYMMDD-XXXX)
 *  3. signatures JSON alanı doldurulur
 *  4. durum APPROVED → onayTarihi, hazirlanmaTarihi güncellenir
 *
 * Bu script idempotent değil: tekrar çalıştırılırsa imzaları yeniler
 * (yeni signatureCode + güncel timestamp ile).
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const TUTANAK_NO = 'BGYS-EGG-2026-001'

function computeContentHash(review: {
  tutanakNo: string
  internalCode: string
  baslik: string
  reviewDate: Date
  amac: string
  kapsam: string
  surecTarihcesi: string
  bulgular: string
  sonucAksiyonlar: unknown
  iliskiliDokumanIds: string[]
}): string {
  // Kanonik temsil: alfabetik sıralı, deterministik
  const canonical = JSON.stringify(
    {
      tutanakNo: review.tutanakNo,
      internalCode: review.internalCode,
      baslik: review.baslik,
      reviewDate: review.reviewDate.toISOString().slice(0, 10),
      amac: review.amac,
      kapsam: review.kapsam,
      surecTarihcesi: review.surecTarihcesi,
      bulgular: review.bulgular,
      sonucAksiyonlar: review.sonucAksiyonlar,
      iliskiliDokumanIds: [...review.iliskiliDokumanIds].sort(),
    },
    null,
    0,
  )
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

function generateSignatureCode(seq: number): string {
  const today = new Date()
  const ymd =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, '0') +
    today.getDate().toString().padStart(2, '0')
  const rnd = crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()
  return `ILH-INV-${ymd}-${seq.toString().padStart(2, '0')}${rnd}`
}

async function main() {
  console.log(`🔍 Tutanak aranıyor: ${TUTANAK_NO}`)
  const review = await prisma.inventoryReview.findUnique({
    where: { tutanakNo: TUTANAK_NO },
  })
  if (!review) throw new Error(`Tutanak bulunamadı: ${TUTANAK_NO}`)
  console.log(`   ID: ${review.id}`)

  console.log('🔍 Hazırlayan kullanıcısı (Melike Balaban)...')
  const melike = await prisma.user.findFirst({
    where: { email: { contains: 'melike', mode: 'insensitive' } },
  })
  if (!melike) throw new Error('Melike Balaban bulunamadı')
  console.log(`   ${melike.name} <${melike.email}>`)

  console.log('🔍 Onaylayan kullanıcısı (Halit İleri)...')
  const halit = await prisma.user.findFirst({
    where: {
      AND: [
        { email: { contains: 'halit.ileri', mode: 'insensitive' } },
      ],
    },
  })
  if (!halit) throw new Error('Halit İleri bulunamadı')
  console.log(`   ${halit.name} <${halit.email}>`)

  // İçerik hash'i
  const contentHash = computeContentHash({
    tutanakNo: review.tutanakNo,
    internalCode: review.internalCode,
    baslik: review.baslik,
    reviewDate: review.reviewDate,
    amac: review.amac,
    kapsam: review.kapsam,
    surecTarihcesi: review.surecTarihcesi,
    bulgular: review.bulgular,
    sonucAksiyonlar: review.sonucAksiyonlar,
    iliskiliDokumanIds: review.iliskiliDokumanIds,
  })
  console.log(`📋 İçerik Hash: ${contentHash.substring(0, 16)}...`)

  const now = new Date()

  const hazirlayanSignature = {
    signatureType: 'PREPARATION',
    signatureCode: generateSignatureCode(1),
    signedAt: now.toISOString(),
    documentHash: contentHash,
    signerId: melike.id,
    signerName: 'Melike Balaban',
    signerEmail: melike.email,
    signerTitle: 'Sistem Geliştirme Mühendisi',
    signerDepartment: 'Sistem Geliştirme Müdürlüğü',
    role: 'HAZIRLAYAN',
    note: 'Tutanak hazırlandı ve dijital olarak imzalandı.',
  }

  const onaylayanSignature = {
    signatureType: 'APPROVAL',
    signatureCode: generateSignatureCode(2),
    signedAt: now.toISOString(),
    documentHash: contentHash,
    signerId: halit.id,
    signerName: 'Halit İleri',
    signerEmail: halit.email,
    signerTitle: 'Genel Müdür',
    signerDepartment: 'Yönetim',
    role: 'ONAYLAYAN',
    note: 'Tutanak onaylandı ve dijital olarak imzalandı.',
  }

  console.log('✍️  Hazırlayan imzası oluşturuluyor...')
  console.log(`   Kod: ${hazirlayanSignature.signatureCode}`)
  console.log('✍️  Onaylayan imzası oluşturuluyor...')
  console.log(`   Kod: ${onaylayanSignature.signatureCode}`)

  const updated = await prisma.inventoryReview.update({
    where: { id: review.id },
    data: {
      contentHash,
      signatures: {
        hazirlayan: hazirlayanSignature,
        onaylayan: onaylayanSignature,
      },
      hazirlanmaTarihi: review.hazirlanmaTarihi ?? now,
      onaylayanId: halit.id,
      onaylayanAd: 'Halit İleri',
      onaylayanUnvan: 'Genel Müdür',
      onayTarihi: now,
      durum: 'APPROVED',
    },
  })

  console.log('')
  console.log('✅ Tutanak dijital olarak imzalandı')
  console.log(`   Tutanak No:   ${updated.tutanakNo}`)
  console.log(`   Durum:        ${updated.durum}`)
  console.log(`   İçerik Hash:  ${updated.contentHash}`)
  console.log(`   İmzalar:      Hazırlayan + Onaylayan`)
  console.log(`   Onay Tarihi:  ${updated.onayTarihi?.toISOString()}`)
  console.log('')
  console.log(`🔗 Detay:    /iso27001/envanter-gozden-gecirme/${updated.id}`)
  console.log(`🔗 Yazdır:   /iso27001/envanter-gozden-gecirme/${updated.id}/yazdir`)
}

main()
  .catch((e) => {
    console.error('❌', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
