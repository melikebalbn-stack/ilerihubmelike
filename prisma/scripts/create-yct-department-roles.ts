/**
 * YCT İnsan Varlıkları / İdari İşler rollerini ve izinlerini hazırlar.
 *
 * Bu script kullanıcı rol ataması YAPMAZ; yalnızca Role ve RolePermission
 * kayıtlarını idempotent olarak oluşturur.
 *
 * Çalıştırma kararı verildiğinde:
 *   npx tsx prisma/scripts/create-yct-department-roles.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import { Pool } from 'pg'
import { PrismaClient } from '../../src/generated/prisma'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const ROLES = [
  {
    slug: 'yct-iv-kullanicisi',
    name: 'Yıllık Takvim - İnsan Varlıkları Kullanıcısı',
    description: 'İnsan Varlıkları için Yıllık Çalışma Takvimi kayıt oluşturma ve düzenleme yetkileri.',
    isSystem: false,
    isProtected: false,
  },
  {
    slug: 'yct-idari-isler-kullanicisi',
    name: 'Yıllık Takvim - İdari İşler Kullanıcısı',
    description: 'İdari İşler için Yıllık Çalışma Takvimi kayıt oluşturma ve düzenleme yetkileri.',
    isSystem: false,
    isProtected: false,
  },
] as const

const PERMISSION_KEYS = ['yilliktakvim.create', 'yilliktakvim.edit'] as const

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tanımlı değil')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...PERMISSION_KEYS] } },
      select: { id: true, key: true },
    })
    const permissionByKey = new Map(permissions.map(permission => [permission.key, permission]))
    const missingPermissions = PERMISSION_KEYS.filter(key => !permissionByKey.has(key))
    if (missingPermissions.length > 0) {
      throw new Error(`Eksik permission: ${missingPermissions.join(', ')}`)
    }

    const result = await prisma.$transaction(async tx => {
      const roles = []
      for (const role of ROLES) {
        roles.push(await tx.role.upsert({
          where: { slug: role.slug },
          create: role,
          update: {
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
            isProtected: role.isProtected,
          },
          select: { id: true, slug: true, name: true },
        }))
      }

      const mappings = roles.flatMap(role => PERMISSION_KEYS.map(key => ({
        roleId: role.id,
        permissionId: permissionByKey.get(key)!.id,
      })))
      const createdMappings = await tx.rolePermission.createMany({
        data: mappings,
        skipDuplicates: true,
      })

      return { roles, createdMappingCount: createdMappings.count, mappingCount: mappings.length }
    })

    for (const role of result.roles) console.log(`✓ Rol hazır: ${role.name} (${role.slug})`)
    console.log(`✓ RolePermission: ${result.createdMappingCount}/${result.mappingCount} yeni bağlantı oluşturuldu`)
    console.log('ℹ Kullanıcı rol ataması yapılmadı')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
