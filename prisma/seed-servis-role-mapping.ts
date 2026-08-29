/**
 * Servis Yönetimi Yetki Matrisi hedef tablosu (11 anahtar):
 *
 * | Anahtar                | super-admin | admin | hr-yoneticisi | idari-isler |
 * |------------------------|-------------|-------|---------------|--------------|
 * | servis.view            | ✓ | ✓ | ✓ | ✓ |
 * | servis.create          | ✓ | ✓ | ✓ | ✓ |
 * | servis.edit            | ✓ | ✓ | ✓ | ✓ |
 * | servis.history         | ✓ | ✓ | ✓ | ✓ |
 * | servis.tanim.manage    | ✓ | ✓ | ✓ | ✓ |
 * | servis.sorumlu.manage  | ✓ | ✓ | ✓ | ✓ |
 * | servis.passive         | ✓ | ✓ | ✓ | — |
 * | servis.restore         | ✓ | ✓ | ✓ | — |
 * | servis.export          | ✓ | ✓ | ✓ | — |
 * | servis.kvkk.view       | ✓ | — | ✓ | — |
 * | servis.admin           | ✓ | ✓ | — | — |
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-permissions.ts
 *   npx tsx --env-file=.env prisma/seed-servis-role-mapping.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const ROLE_MAPPING: Record<string, string[]> = {
  'servis.view': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.create': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.edit': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.history': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.tanim.manage': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.sorumlu.manage': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.passive': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.restore': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.export': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.kvkk.view': ['super-admin', 'hr-yoneticisi'],
  'servis.admin': ['super-admin', 'admin'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Servis permission → role mapping başlıyor...')

    const permissionKeys = Object.keys(ROLE_MAPPING)
    const roleSlugs = [...new Set(Object.values(ROLE_MAPPING).flat())]

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    })
    const permissionByKey = new Map(permissions.map(permission => [permission.key, permission.id]))
    const missingPermissions = permissionKeys.filter(key => !permissionByKey.has(key))
    if (missingPermissions.length > 0) {
      console.error('Permission DB\'de yok (önce seed-permissions çalıştır):', missingPermissions)
      process.exit(1)
    }

    const roles = await prisma.role.findMany({
      where: { slug: { in: roleSlugs } },
      select: { id: true, slug: true },
    })
    const roleBySlug = new Map(roles.map(role => [role.slug, role.id]))
    const missingRoles = roleSlugs.filter(slug => !roleBySlug.has(slug))
    if (missingRoles.length > 0) {
      console.error('Role DB\'de yok (önce ilgili role seed\'ini çalıştır):', missingRoles)
      process.exit(1)
    }

    const rows: { roleId: string; permissionId: string }[] = []
    for (const [permissionKey, targetRoles] of Object.entries(ROLE_MAPPING)) {
      const permissionId = permissionByKey.get(permissionKey)!
      for (const roleSlug of targetRoles) {
        const roleId = roleBySlug.get(roleSlug)!
        rows.push({ roleId, permissionId })
      }
    }

    const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
