import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { PERMISSION_KEYS, PERMISSION_DESCRIPTIONS } from '../src/lib/auth/permissions'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const SERVIS_PERMISSIONS: Record<string, string> = {
  'servis.view': 'Servis yönetimi modülünü görüntüleme',
  'servis.create': 'Servis kaydı oluşturma',
  'servis.edit': 'Servis kaydı düzenleme',
  'servis.history': 'Servis işlem geçmişini görüntüleme',
  'servis.tanim.manage': 'Servis firma, yerleşke ve güzergâh tanımlarını yönetme',
  'servis.sorumlu.manage': 'Servis sorumlusu atamalarını yönetme',
  'servis.passive': 'Servis kayıtlarını pasifleştirme',
  'servis.restore': 'Pasif servis kayıtlarını geri alma',
  'servis.export': 'Servis verilerini dışa aktarma',
  'servis.kvkk.view': 'Servis kapsamındaki KVKK verilerini görüntüleme',
  // MASTER madde 30 — versiyonlu liste yayımlama (REV.0 → REV.1). servis.create
  // ile BİRLEŞTİRİLMEDİ: bu, firmaya giden ve geri alınamayan resmî bir belge
  // üretmek; servis.create ise servis kaydı oluşturmak. Ayrı anahtar olmasaydı
  // servis.create'i olan idari-isler yan etkiyle yayımcı olurdu.
  'servis.liste.publish': 'Versiyonlu servis listesi yayımlama (REV)',
  'servis.admin': 'Servis yönetimi tam yetkisi',
  // MASTER madde 46 — şikâyet/uygunsuzluk. servis.view TEK BAŞINA YETMEZ:
  // şikâyet kaydı şikâyetçi kimliğini taşır (KVKK sınıfı) ve yalnız
  // İK/İdari İşler görmelidir, bu yüzden ayrı anahtar.
  'servis.sikayet.view': 'Servis şikâyet/uygunsuzluk kayıtlarını görüntüleme',
  'servis.sikayet.manage': 'Servis şikâyet/uygunsuzluk kaydı oluşturma, aksiyon atama ve kapatma',
}

async function main() {
  console.log('🔐 Permission seed (bootstrap-only) başlıyor...')

  // PR-SEED-DRIFT: Bootstrap-only pattern
  // - Permission yoksa create, varsa DOKUNMA
  // - module/description code-driven; kod değişirse manuel migration gerekir
  // - Orphaned permission'lar uyarı olarak listelenir, otomatik silinmez

  let created = 0
  let skipped = 0

  const permissionKeys = [...new Set([
    ...Object.values(PERMISSION_KEYS),
    ...Object.keys(SERVIS_PERMISSIONS),
  ])]

  for (const key of permissionKeys) {
    const module = key.split('.')[0]
    const description = SERVIS_PERMISSIONS[key] ?? PERMISSION_DESCRIPTIONS[key] ?? key

    const existing = await prisma.permission.findUnique({ where: { key } })

    if (existing) {
      skipped++
    } else {
      await prisma.permission.create({
        data: { key, module, description, isSystem: true },
      })
      created++
      console.log(`  ✓ ${key} (${description})`)
    }
  }

  // Sistemde tanımlı olmayan eski permission'ları (kodda silinmişler) raporla
  const allInDb = await prisma.permission.findMany({ select: { key: true, isSystem: true } })
  const definedKeys = new Set<string>(permissionKeys)
  const orphaned = allInDb.filter(p => p.isSystem && !definedKeys.has(p.key))

  console.log(`✅ Oluşturuldu: ${created}, mevcut korundu: ${skipped}`)
  if (orphaned.length > 0) {
    console.warn(
      `⚠️ DB'de var ama kodda yok (otomatik silinmez, manuel temizlik gerekirse):`,
      orphaned.map(o => o.key)
    )
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
