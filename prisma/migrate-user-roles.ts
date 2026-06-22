import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Eski enum (UserRoleEnum) → yeni rol slug eşlemesi.
// Mevcut enum değerleri: SUPER_ADMIN, ADMIN, HR_MANAGER, QUALITY_MANAGER,
// IT_MANAGER, DEPT_HEAD, SUPERVISOR, EMPLOYEE.
const ROLE_MAPPING: Record<string, string[]> = {
  SUPER_ADMIN:     ['kullanici', 'super-admin'],
  ADMIN:           ['kullanici', 'admin'],
  HR_MANAGER:      ['kullanici', 'hr-yoneticisi'],
  QUALITY_MANAGER: ['kullanici', 'kalite-yoneticisi'],
  IT_MANAGER:      ['kullanici', 'it-admin'],
  DEPT_HEAD:       ['kullanici', 'departman-muduru'],
  SUPERVISOR:      ['kullanici', 'departman-muduru'],
  EMPLOYEE:        ['kullanici'],
}

async function main() {
  console.log('🔄 User.role → UserRole migration başlıyor...')

  const allRoles = await prisma.role.findMany({ where: { isSystem: true } })
  const roleIdBySlug = new Map(allRoles.map(r => [r.slug, r.id]))

  for (const slug of new Set(Object.values(ROLE_MAPPING).flat())) {
    if (!roleIdBySlug.has(slug)) {
      throw new Error(`Sistem rolü eksik: ${slug}. Önce seed-roles çalıştır.`)
    }
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  })

  console.log(`Toplam ${users.length} kullanıcı işlenecek.`)

  let assigned = 0
  let skipped = 0

  for (const user of users) {
    const slugList = ROLE_MAPPING[user.role as string] ?? ['kullanici']

    for (const slug of slugList) {
      const roleId = roleIdBySlug.get(slug)!

      const exists = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId } },
      })

      if (exists) {
        skipped++
      } else {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId,
            source: 'manual', // Migration işlemi manuel sayılır
          },
        })
        assigned++
      }
    }
  }

  console.log(`✅ Atandı: ${assigned}, zaten vardı: ${skipped}`)

  // Doğrulama
  const totalUserRoles = await prisma.userRole.count()
  const usersWithoutRole = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "User" u WHERE NOT EXISTS (SELECT 1 FROM user_role ur WHERE ur.user_id = u.id)`
  )

  console.log(`📊 user_role toplam kayıt: ${totalUserRoles}`)
  console.log(`📊 Hiç rolü olmayan kullanıcı: ${usersWithoutRole[0].count}`)

  if (Number(usersWithoutRole[0].count) > 0) {
    console.warn('⚠️ Bazı kullanıcıların rolü yok. Kontrol et!')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
