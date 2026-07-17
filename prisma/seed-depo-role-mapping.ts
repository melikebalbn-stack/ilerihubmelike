/**
 * Depo Permission → Role Mapping Seed
 *
 * 'depo.terminal.use' permission'ını ve 'depo-operator' rolünü kurar, ardından
 * ilgili rollere mapler. seed-uretim-role-mapping.ts ile aynı desen; farkı:
 * bu script permission VE role'ü de (yoksa) upsert eder — depo-operator henüz
 * seed-roles.ts'te tanımlı olmadığından burada bootstrap edilir.
 *
 * Idempotent:
 *   - Permission/Role: findUnique → yoksa create, varsa DOKUNMA
 *   - RolePermission: createMany + skipDuplicates ile mevcutlara dokunmaz
 *
 * NOT: seed-roles.ts bootstrap-only ("RolePermission tablosu doluysa atla").
 * Bu script tablo doluyken bile yeni permission'ı map etmek için ayrı yazıldı.
 * super-admin 'ALL' olsa da dolu DB'de otomatik almadığından açıkça eklenir.
 *
 * Default mapping:
 *   depo.terminal.use → Depo Operatörü (depo-operator), Super Admin
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-depo-role-mapping.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'
import { PERMISSION_KEYS, PERMISSION_DESCRIPTIONS } from '../src/lib/auth/permissions'

const PERM_KEY = PERMISSION_KEYS.DEPO_TERMINAL_USE // 'depo.terminal.use'

// Yeni rol: Depo Operatörü. Operasyonel rol → isProtected: false.
const DEPO_ROLE = {
  slug: 'depo-operator',
  name: 'Depo Operatörü',
  description: 'Depo el terminali kullanıcısı (stok taşıma, malzeme toplama)',
}

// permKey → hangi rol slug'larına bağlanacak.
const MAPPING: Record<string, string[]> = {
  [PERM_KEY]: ['depo-operator', 'super-admin'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Depo permission → role mapping başlıyor...')

    // 1) Permission upsert (yoksa create, varsa dokunma)
    let permission = await prisma.permission.findUnique({ where: { key: PERM_KEY } })
    if (!permission) {
      permission = await prisma.permission.create({
        data: {
          key: PERM_KEY,
          module: PERM_KEY.split('.')[0], // 'depo'
          description: PERMISSION_DESCRIPTIONS[PERM_KEY] ?? PERM_KEY,
          isSystem: true,
        },
      })
      console.log(`  ✓ Permission oluşturuldu: ${PERM_KEY}`)
    } else {
      console.log(`  • Permission mevcut: ${PERM_KEY}`)
    }

    // 2) Depo Operatörü rolü upsert (yoksa create, varsa dokunma)
    let depoRole = await prisma.role.findUnique({ where: { slug: DEPO_ROLE.slug } })
    if (!depoRole) {
      depoRole = await prisma.role.create({
        data: {
          slug: DEPO_ROLE.slug,
          name: DEPO_ROLE.name,
          description: DEPO_ROLE.description,
          isSystem: true,
          isProtected: false,
        },
      })
      console.log(`  ✓ Role oluşturuldu: ${DEPO_ROLE.name} (${DEPO_ROLE.slug})`)
    } else {
      console.log(`  • Role mevcut: ${DEPO_ROLE.name} (${DEPO_ROLE.slug})`)
    }

    // 3) Hedef rollerin ID'leri (slug → id). super-admin seed-roles'tan gelmeli.
    const allSlugs = [...new Set(Object.values(MAPPING).flat())]
    const roles = await prisma.role.findMany({
      where: { slug: { in: allSlugs } },
      select: { id: true, slug: true, name: true },
    })
    const roleBySlug = new Map(roles.map((r) => [r.slug, r]))

    const missingRoles = allSlugs.filter((s) => !roleBySlug.has(s))
    if (missingRoles.length > 0) {
      console.error('❌ Role DB\'de yok (önce seed-roles çalıştır):', missingRoles)
      process.exit(1)
    }

    // 4) RolePermission satırlarını hazırla + skipDuplicates ile insert
    const rows: { roleId: string; permissionId: string }[] = []
    for (const [, slugs] of Object.entries(MAPPING)) {
      for (const slug of slugs) {
        rows.push({ roleId: roleBySlug.get(slug)!.id, permissionId: permission.id })
      }
    }

    const result = await prisma.rolePermission.createMany({
      data: rows,
      skipDuplicates: true,
    })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)

    // 5) Doğrulama
    console.log('\n📋 Final mapping:')
    const rps = await prisma.rolePermission.findMany({
      where: { permissionId: permission.id },
      include: { role: { select: { slug: true, name: true } } },
    })
    const roleNames = rps.map((rp) => rp.role.name).join(', ')
    console.log(`  ${PERM_KEY.padEnd(22)} → ${roleNames || '(hiçbir rol)'}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
