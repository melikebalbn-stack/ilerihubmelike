/**
 * Servis Yönetimi Yetki Matrisi hedef tablosu (11 anahtar):
 *
 * | Anahtar                | Hedef kullanım |
 * |------------------------|------------------|
 * | servis.view            | Modülü görüntüleme |
 * | servis.create          | Servis kaydı oluşturma |
 * | servis.edit            | Servis kaydı düzenleme |
 * | servis.history         | İşlem geçmişini görüntüleme |
 * | servis.tanim.manage    | Firma/yerleşke/güzergâh tanımlarını yönetme |
 * | servis.sorumlu.manage  | Sorumlu atamalarını yönetme |
 * | servis.passive         | Kayıt pasifleştirme |
 * | servis.restore         | Pasif kaydı geri alma |
 * | servis.export          | Dışa aktarma |
 * | servis.kvkk.view       | KVKK verilerini görüntüleme |
 * | servis.admin           | Tam yönetim |
 *
 * Faz 1A'da yalnız route'u bulunan servis.view ve servis.tanim.manage
 * rollere bağlanır. Diğer dokuz anahtar ileride ilgili route'lar geldiğinde
 * bu hedef tabloya göre ayrıca eşlenecektir.
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
  'servis.tanim.manage': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
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
