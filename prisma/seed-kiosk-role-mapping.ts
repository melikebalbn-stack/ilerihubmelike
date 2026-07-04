/**
 * Kiosk/Tezgah permission → Role Mapping Seed (Faz 2a).
 *
 * 'uretim.tezgah.manage' iznini default rollere mapler.
 * Idempotent: createMany + skipDuplicates ile mevcut RolePermission'a dokunmaz.
 *
 * NOT: önce seed-permissions.ts (uretim.tezgah.manage'i permission tablosuna yazar)
 * çalışmalı. Eksik rol/izin bulunursa uyarı verir, THROW ETMEZ (idempotent).
 *
 * Default mapping:
 *   uretim.tezgah.manage → Super Admin, Admin, IT Admin, HR Yöneticisi, Üretim Planlama
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-kiosk-role-mapping.ts
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const MAPPING: Record<string, string[]> = {
  // Tezgah tanımı + personel↔tezgah atama. Üretim/İK operasyonel ekipleri.
  'uretim.tezgah.manage': ['super-admin', 'admin', 'it-admin', 'hr-yoneticisi', 'uretim-planlama'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Kiosk/tezgah permission → role mapping başlıyor...')

    const permissions = await prisma.permission.findMany({
      where: { key: { in: Object.keys(MAPPING) } },
      select: { id: true, key: true },
    })
    const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]))
    const missingPerms = Object.keys(MAPPING).filter((k) => !permIdByKey.has(k))
    if (missingPerms.length > 0) {
      console.warn("⚠️  Permission DB'de yok (önce seed-permissions çalıştır), atlandı:", missingPerms)
    }

    const allSlugs = [...new Set(Object.values(MAPPING).flat())]
    const roles = await prisma.role.findMany({
      where: { slug: { in: allSlugs } },
      select: { id: true, slug: true, name: true },
    })
    const roleBySlug = new Map(roles.map((r) => [r.slug, r]))
    const missingRoles = allSlugs.filter((s) => !roleBySlug.has(s))
    if (missingRoles.length > 0) {
      console.warn("⚠️  Role DB'de yok (önce ilgili role seed'i çalıştır), atlandı:", missingRoles)
    }

    const rows: { roleId: string; permissionId: string }[] = []
    for (const [permKey, slugs] of Object.entries(MAPPING)) {
      const permissionId = permIdByKey.get(permKey)
      if (!permissionId) continue
      for (const slug of slugs) {
        const role = roleBySlug.get(slug)
        if (!role) continue
        rows.push({ roleId: role.id, permissionId })
      }
    }

    const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)

    console.log('\n📋 Final mapping:')
    for (const permKey of Object.keys(MAPPING)) {
      const permId = permIdByKey.get(permKey)
      if (!permId) continue
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
