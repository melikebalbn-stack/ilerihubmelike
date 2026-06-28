/**
 * Overtime performans permission → Role Mapping Seed (PR-A).
 *
 * 'overtime.report' iznini default rollere mapler.
 * Idempotent: createMany + skipDuplicates ile mevcut RolePermission'a dokunmaz.
 *
 * NOT: önce seed-permissions.ts (overtime.report'u permission tablosuna yazar)
 * ve seed-uretim-planlama-role.ts (uretim-planlama rolünü oluşturur) çalışmalı.
 *
 * Default mapping:
 *   overtime.report → Super Admin, Admin, Departman Müdürü, Kalite Yöneticisi, Üretim Planlama
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-overtime-role-mapping.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const MAPPING: Record<string, string[]> = {
  'overtime.report': ['super-admin', 'admin', 'departman-muduru', 'kalite-yoneticisi', 'uretim-planlama'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Overtime permission → role mapping başlıyor...')

    const permissions = await prisma.permission.findMany({
      where: { key: { in: Object.keys(MAPPING) } },
      select: { id: true, key: true },
    })
    const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]))
    const missingPerms = Object.keys(MAPPING).filter((k) => !permIdByKey.has(k))
    if (missingPerms.length > 0) {
      console.error("❌ Permission DB'de yok (önce seed-permissions çalıştır):", missingPerms)
      process.exit(1)
    }

    const allSlugs = [...new Set(Object.values(MAPPING).flat())]
    const roles = await prisma.role.findMany({
      where: { slug: { in: allSlugs } },
      select: { id: true, slug: true, name: true },
    })
    const roleBySlug = new Map(roles.map((r) => [r.slug, r]))
    const missingRoles = allSlugs.filter((s) => !roleBySlug.has(s))
    if (missingRoles.length > 0) {
      console.error("❌ Role DB'de yok (önce ilgili role seed'i çalıştır):", missingRoles)
      process.exit(1)
    }

    const rows: { roleId: string; permissionId: string }[] = []
    for (const [permKey, slugs] of Object.entries(MAPPING)) {
      const permissionId = permIdByKey.get(permKey)!
      for (const slug of slugs) rows.push({ roleId: roleBySlug.get(slug)!.id, permissionId })
    }

    const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)

    console.log('\n📋 Final mapping:')
    for (const permKey of Object.keys(MAPPING)) {
      const permId = permIdByKey.get(permKey)!
      const rps = await prisma.rolePermission.findMany({
        where: { permissionId: permId },
        include: { role: { select: { slug: true, name: true } } },
      })
      console.log(`  ${permKey.padEnd(22)} → ${rps.map((rp) => rp.role.name).join(', ') || '(hiçbir rol)'}`)
    }
  } finally {
    await prisma.$disconnect(); await pool.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
