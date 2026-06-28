/**
 * Yönetim Raporu Alıcısı rolü seed (PR-B: haftalık mesai performans maili).
 *
 * 'yonetim-raporu' rolünü oluşturur (yoksa). İdempotent: varsa DOKUNMAZ.
 * Bu role kullanıcı ATAMASI YAPILMAZ — Melih panelden Gürhan/Halit'e atayacak.
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-yonetim-raporu-role.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const ROLE = {
  slug: 'yonetim-raporu',
  name: 'Yönetim Raporu Alıcısı',
  description: 'Haftalık mesai performans raporu vb. yönetim raporlarını mail ile alır.',
  isSystem: false,
  isProtected: false,
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const existing = await prisma.role.findUnique({ where: { slug: ROLE.slug } })
    if (existing) {
      console.log(`ℹ️  Rol zaten var, dokunulmadı: ${ROLE.name} (${ROLE.slug})`)
    } else {
      await prisma.role.create({ data: ROLE })
      console.log(`✓ Rol oluşturuldu: ${ROLE.name} (${ROLE.slug})`)
    }
  } finally {
    await prisma.$disconnect(); await pool.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
