/**
 * Zimmet Teslim Formu Permission → Role Mapping Seed
 *
 * 3 yeni zimmet-formu.* permission'ını default rollere mapler.
 * Idempotent: createMany + skipDuplicates ile mevcut RolePermission
 * kayıtlarına dokunmaz (seed-offboarding-role-mapping.ts ile aynı desen).
 *
 * ÖNKOŞUL: permission satırları DB'de olmalı. Bu script'ten ÖNCE
 *   npx tsx --env-file=.env prisma/seed-permissions.ts
 * çalıştırılmalı — yoksa "Permission DB'de yok" ile exit(1) verir.
 *
 * NOT: Bu modül offboarding.* ("Zimmet İade / İlişik Kesme") ve Elif'in
 * envanter zimmetinden AYRIDIR — cihaz teslim tutanağı + onay/imza akışı.
 *
 * Default mapping (BT cihaz teslimini yapar ve onaylar; İK ve departman
 * müdürü kendi personelinin tutanaklarını görebilsin):
 *   zimmet-formu.view    → Super Admin, IT Admin, İK Yöneticisi, Departman Müdürü
 *   zimmet-formu.create  → Super Admin, IT Admin, İK Yöneticisi
 *   zimmet-formu.approve → Super Admin, IT Admin, İK Yöneticisi
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-zimmet-formu-role-mapping.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const MAPPING: Record<string, string[]> = {
  'zimmet-formu.view': ['super-admin', 'it-admin', 'hr-yoneticisi', 'departman-muduru'],
  'zimmet-formu.create': ['super-admin', 'it-admin', 'hr-yoneticisi'],
  'zimmet-formu.approve': ['super-admin', 'it-admin', 'hr-yoneticisi'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Zimmet Teslim Formu permission → role mapping başlıyor...')

    // Permission ID'leri (key → id)
    const permissions = await prisma.permission.findMany({
      where: { key: { in: Object.keys(MAPPING) } },
      select: { id: true, key: true },
    })
    const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]))

    const missingPerms = Object.keys(MAPPING).filter((k) => !permIdByKey.has(k))
    if (missingPerms.length > 0) {
      console.error('❌ Permission DB\'de yok (önce seed-permissions çalıştır):', missingPerms)
      process.exit(1)
    }

    // Role ID'leri (slug → id)
    const allSlugs = [...new Set(Object.values(MAPPING).flat())]
    const roles = await prisma.role.findMany({
      where: { slug: { in: allSlugs } },
      select: { id: true, slug: true, name: true },
    })
    const roleBySlug = new Map(roles.map((r) => [r.slug, r]))

    const missingRoles = allSlugs.filter((s) => !roleBySlug.has(s))
    if (missingRoles.length > 0) {
      console.error('❌ Role DB\'de yok:', missingRoles)
      process.exit(1)
    }

    // RolePermission satırlarını hazırla
    const rows: { roleId: string; permissionId: string }[] = []
    for (const [permKey, slugs] of Object.entries(MAPPING)) {
      const permissionId = permIdByKey.get(permKey)!
      for (const slug of slugs) {
        const role = roleBySlug.get(slug)!
        rows.push({ roleId: role.id, permissionId })
      }
    }

    // skipDuplicates ile insert (mevcut RolePermission kayıtlarına dokunmaz)
    const result = await prisma.rolePermission.createMany({
      data: rows,
      skipDuplicates: true,
    })

    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)

    // Doğrulama: her permission'ın hangi rollerde olduğunu raporla
    console.log('\n📋 Final mapping:')
    for (const permKey of Object.keys(MAPPING)) {
      const permId = permIdByKey.get(permKey)!
      const rps = await prisma.rolePermission.findMany({
        where: { permissionId: permId },
        include: { role: { select: { slug: true, name: true } } },
      })
      const roleNames = rps.map((rp) => rp.role.name).join(', ')
      console.log(`  ${permKey.padEnd(22)} → ${roleNames || '(hiçbir rol)'}`)
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
