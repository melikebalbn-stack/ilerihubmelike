/**
 * Yönetim (KPI) permission → role mapping seed (integ/kpi-arayuz destek dosyası).
 *
 * 'kpi.view' ve 'kpi.manage' izinlerini Permission tablosuna yazar (yoksa) ve
 * başlangıç rol kümesine (super-admin, admin) mapler. Idempotent: permission
 * upsert + RolePermission createMany skipDuplicates.
 *
 * seed-entegrasyon-syteline.ts deseni; Permission satırlarını da kendi oluşturur
 * (seed-permissions'a bağımlı DEĞİL). Açıklamalar bilerek INLINE tutulur: bu seed
 * KPI arayüz entegrasyonundan (permissions.ts kpi.* tanımları) ÖNCE, güncel main
 * üstünde tek başına koşulabilsin diye — permissions.ts'e bağımlılık yok.
 *
 * NOT: Rol kümesi başlangıçtır. KPI'ı görecek/gireceği İK/departman rollerine
 * genişletme UI'dan (rol-izin ekranı) veya bu listeyi büyütüp yeniden koşarak yapılır.
 *
 * Kullanım (pasif slot dizininde):
 *   npx tsx --env-file=.env prisma/seed-yonetim-role-mapping.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const PERM_DEFS: Record<string, string> = {
  'kpi.view': 'Yönetim KPI panelini görüntüleme (departman KPI tabloları, grafikler, aksiyonlar)',
  'kpi.manage': 'KPI tanımı ekleme, aylık ölçüm girme/güncelleme, aksiyon ekleme',
}
const PERM_KEYS = Object.keys(PERM_DEFS)
const ROLE_SLUGS = ['super-admin', 'admin']

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  try {
    console.log('🔐 Yönetim (KPI) permission + role mapping başlıyor...')

    // 1) Roller (hepsi DB'de olmalı).
    const roles = await prisma.role.findMany({ where: { slug: { in: ROLE_SLUGS } }, select: { id: true, slug: true, name: true } })
    const missing = ROLE_SLUGS.filter((s) => !roles.some((r) => r.slug === s))
    if (missing.length > 0) {
      console.error("❌ Role DB'de yok:", missing)
      process.exit(1)
    }

    for (const PERM_KEY of PERM_KEYS) {
      // 2) Permission satırı (yoksa oluştur, varsa dokunma).
      const perm = await prisma.permission.upsert({
        where: { key: PERM_KEY },
        update: {},
        create: {
          key: PERM_KEY,
          module: PERM_KEY.split('.')[0], // 'kpi'
          description: PERM_DEFS[PERM_KEY] ?? PERM_KEY,
          isSystem: true,
        },
        select: { id: true, key: true },
      })

      // 3) RolePermission (idempotent).
      const rows = roles.map((r) => ({ roleId: r.id, permissionId: perm.id }))
      const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
      console.log(`  ✓ ${perm.key} → eklendi ${result.count}/${rows.length} (mevcutlar atlandı)`)
    }

    const rps = await prisma.rolePermission.findMany({
      where: { permission: { key: { in: PERM_KEYS } } },
      include: { role: { select: { name: true } }, permission: { select: { key: true } } },
    })
    console.log('\n📋 Sonuç:')
    for (const PERM_KEY of PERM_KEYS) {
      const roller = rps.filter((rp) => rp.permission.key === PERM_KEY).map((rp) => rp.role.name)
      console.log(`   ${PERM_KEY} → ${roller.join(', ') || '(hiçbir rol)'}`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
