/**
 * Üretim Planlama rolü seed (PR-A: Mesai performans raporu).
 *
 * 'uretim-planlama' rolünü oluşturur (yoksa). İdempotent: varsa DOKUNMAZ
 * (seed-roles.ts bootstrap deseni — UI'dan düzenlenmiş kayıt korunur).
 * İzin ataması seed-overtime-role-mapping.ts'de yapılır.
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-uretim-planlama-role.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const ROLE = {
  slug: 'uretim-planlama',
  name: 'Üretim Planlama',
  description: 'Üretim planlama ekibi — mesai performans raporu vb. üretim görünürlüğü.',
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
