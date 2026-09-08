/**
 * Entegrasyon (Syteline) permission → role mapping seed (feat/syteline-part-sync).
 *
 * 'entegrasyon.syteline' iznini Permission tablosuna yazar (yoksa) ve ipro.admin ile
 * AYNI role kümesine (super-admin, admin, it-admin — Melih super-admin olduğu için kapsanır)
 * mapler. Idempotent: permission upsert + RolePermission createMany skipDuplicates.
 *
 * seed-ipro-role-mapping.ts deseni; ek olarak Permission satırını da kendi oluşturur
 * (seed-permissions'a bağımlı değil).
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-entegrasyon-syteline.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'
import { PERMISSION_DESCRIPTIONS } from '../src/lib/auth/permissions'

const PERM_KEY = 'entegrasyon.syteline'
const ROLE_SLUGS = ['super-admin', 'admin', 'it-admin']

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  try {
    console.log('🔐 entegrasyon.syteline permission + role mapping başlıyor...')

    // 1) Permission satırı (yoksa oluştur, varsa dokunma).
    const perm = await prisma.permission.upsert({
      where: { key: PERM_KEY },
      update: {},
      create: {
        key: PERM_KEY,
        module: PERM_KEY.split('.')[0], // 'entegrasyon'
        description: PERMISSION_DESCRIPTIONS[PERM_KEY] ?? PERM_KEY,
        isSystem: true,
      },
      select: { id: true, key: true },
    })
    console.log(`  ✓ Permission hazır: ${perm.key}`)

    // 2) Roller.
    const roles = await prisma.role.findMany({ where: { slug: { in: ROLE_SLUGS } }, select: { id: true, slug: true, name: true } })
    const missing = ROLE_SLUGS.filter((s) => !roles.some((r) => r.slug === s))
    if (missing.length > 0) {
      console.error("❌ Role DB'de yok:", missing)
      process.exit(1)
    }

    // 3) RolePermission (idempotent).
    const rows = roles.map((r) => ({ roleId: r.id, permissionId: perm.id }))
    const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (mevcutlar atlandı)`)

    const rps = await prisma.rolePermission.findMany({
      where: { permissionId: perm.id },
      include: { role: { select: { name: true } } },
    })
    console.log(`\n📋 ${PERM_KEY} → ${rps.map((rp) => rp.role.name).join(', ') || '(hiçbir rol)'}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
