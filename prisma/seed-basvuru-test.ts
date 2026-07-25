// STAGING TEST VERİSİ — 4 sahte PublicJobApplication (farklı statülerde).
// Başvuru Değerlendirme Workflow'unu (aşama geçişi + müdür ataması + bildirim) elle
// denemek için. PROD'A GİTMEZ — yalnız elle çalıştırılır:
//   npx tsx --env-file=.env prisma/seed-basvuru-test.ts
//
// Desen: seed-suggestions.ts (PrismaPg adapter + pg.Pool + dotenv). @prisma/client YOK.
// Zorunlu alan yalnız fullName (schema'dan doğrulandı); gerisi nullable/default'lu.
// İdempotent: "TEST-BASVURU-" ön ekli mevcut test kayıtları önce silinir.

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

// ── PROD-GUARD (hard exit) — herhangi bir DB işleminden ÖNCE ────────────────
// Bu test seed'i YALNIZ staging/dev/test DB'lerine yazabilir. Prod ('ilerihub')
// veya tanımadığı DB adı → sessiz uyarı DEĞİL, process.exit(1).
function assertSafeDatabase(): void {
  const url = process.env.DATABASE_URL ?? ''
  let host = ''
  let dbName = ''
  try {
    const u = new URL(url)
    host = u.host
    dbName = decodeURIComponent(u.pathname.replace(/^\//, '')).split('?')[0]
  } catch {
    // parse edilemedi
  }
  // Sessiz çalışmasın — hedefi her zaman yaz.
  console.log(`🔌 Hedef veritabanı → host=${host || '(bilinmiyor)'}  db=${dbName || '(bilinmiyor)'}`)

  const isProd = dbName === 'ilerihub'
  const isAllowedName = /staging|dev|test/i.test(dbName)
  if (isProd || !isAllowedName) {
    console.error(
      `❌ GÜVENLİK DURDURMA: '${dbName || url}' bu test seed'i için izinli değil.\n` +
        `   İzinli: adı 'staging' / 'dev' / 'test' içeren DB'ler. Prod ('ilerihub') KESİNLİKLE YASAK.`,
    )
    process.exit(1)
  }
  if (process.env.ALLOW_TEST_SEED !== '1') {
    console.error(
      `❌ GÜVENLİK DURDURMA: ALLOW_TEST_SEED=1 ayarlı değil (kasıtsız çalıştırma koruması).\n` +
        `   Doğru kullanım:  ALLOW_TEST_SEED=1 npx tsx --env-file=.env prisma/seed-basvuru-test.ts`,
    )
    process.exit(1)
  }
  console.log(`✅ Güvenli hedef (${dbName}) + ALLOW_TEST_SEED=1 — devam ediliyor.`)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  assertSafeDatabase()
  console.log('🌱 Başvuru workflow test verisi seed başlıyor...')

  // İdempotent temizlik: önceki test kayıtları (applicationNumber ön eki ile).
  const eskiler = await prisma.publicJobApplication.findMany({
    where: { applicationNumber: { startsWith: 'TEST-BASVURU-' } },
    select: { id: true },
  })
  if (eskiler.length > 0) {
    const ids = eskiler.map((e) => e.id)
    // StageLog önce (FK), sonra başvuru.
    await prisma.publicJobApplicationStageLog.deleteMany({ where: { applicationId: { in: ids } } })
    await prisma.publicJobApplication.deleteMany({ where: { id: { in: ids } } })
    console.log(`  ${ids.length} eski test kaydı silindi.`)
  }

  // MUDUR_DEGERLENDIRME kaydına gerçek bir müdür atayalım ki MÜDÜR rolü test edilebilsin.
  // Hardcode YOK — çalıştırma anında ilk aktif User'ı seç (yoksa null).
  const ilkUser = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  const kayitlar = [
    {
      applicationNumber: 'TEST-BASVURU-0001',
      fullName: 'Ahmet Yılmaz (TEST)',
      email: 'ahmet.test@example.com',
      requestedPosition: 'Üretim Operatörü',
      status: 'PENDING' as const,
    },
    {
      applicationNumber: 'TEST-BASVURU-0002',
      fullName: 'Ayşe Demir (TEST)',
      email: 'ayse.test@example.com',
      requestedPosition: 'Kalite Kontrol Uzmanı',
      status: 'REVIEWING' as const,
    },
    {
      applicationNumber: 'TEST-BASVURU-0003',
      fullName: 'Mehmet Kaya (TEST)',
      email: 'mehmet.test@example.com',
      requestedPosition: 'Bakım Teknisyeni',
      status: 'MUDUR_DEGERLENDIRME' as const,
      assignedManagerId: ilkUser?.id ?? null,
      assignedAt: ilkUser ? new Date() : null,
    },
    {
      applicationNumber: 'TEST-BASVURU-0004',
      fullName: 'Zeynep Şahin (TEST)',
      email: 'zeynep.test@example.com',
      requestedPosition: 'İnsan Kaynakları Uzmanı',
      status: 'SINAV' as const,
    },
  ]

  for (const k of kayitlar) {
    const created = await prisma.publicJobApplication.create({ data: k })
    // Başlangıç aşama logu (fromStatus = null) — geçmiş tutarlı olsun.
    await prisma.publicJobApplicationStageLog.create({
      data: { applicationId: created.id, fromStatus: null, toStatus: k.status, note: 'seed-basvuru-test' },
    })
    console.log(`  ✓ ${k.applicationNumber} — ${k.fullName} [${k.status}]${'assignedManagerId' in k && k.assignedManagerId ? ' (müdür: ' + (ilkUser?.name ?? ilkUser?.id) + ')' : ''}`)
  }

  console.log(`✅ ${kayitlar.length} test başvurusu oluşturuldu.`)
  if (!ilkUser) console.warn('⚠️ Aktif User bulunamadı — MUDUR_DEGERLENDIRME kaydı müdürsüz (MÜDÜR rolü test edilemez).')
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
