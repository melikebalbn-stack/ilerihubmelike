/**
 * IPRO ayar düzenleme izni + rolü seed (idempotent).
 * - Permission: ipro.ayar.duzenle (seed-permissions da yazar; burada garanti).
 * - Rol: ipro-ayar-duzenleyici ("IPRO Ayar Düzenleyici").
 * - Mapping: ipro.ayar.duzenle → [ipro-ayar-duzenleyici, super-admin].
 * KİŞİ ATAMA YAPMAZ (role kullanıcı eklenmez — İK/Melih kararı).
 *
 *   npx tsx --env-file=.env prisma/seed-ipro-ayar-role.ts    (prod: --env-file=.env.local / prod DATABASE_URL)
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const PERM = 'ipro.ayar.duzenle'
const ROL_SLUG = 'ipro-ayar-duzenleyici'
const ROL_AD = 'IPRO Ayar Düzenleyici'
const HEDEF_ROLLER = [ROL_SLUG, 'super-admin']

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const perm = await prisma.permission.upsert({
      where: { key: PERM },
      update: {},
      create: { key: PERM, module: 'ipro', description: 'IPRO ayarları düzenleme — duruş eşikleri, tezgah istisnaları, mola takvimi, vardiya/tatil (/ipro/ayarlar)' },
      select: { id: true },
    })

    const rol = await prisma.role.upsert({
      where: { slug: ROL_SLUG },
      update: { name: ROL_AD },
      create: { slug: ROL_SLUG, name: ROL_AD, description: 'IPRO /ipro/ayarlar düzenleme yetkisi' },
      select: { id: true },
    })

    const roller = await prisma.role.findMany({ where: { slug: { in: HEDEF_ROLLER } }, select: { id: true, slug: true } })
    const eksik = HEDEF_ROLLER.filter((s) => !roller.find((r) => r.slug === s))
    if (eksik.length) console.warn('⚠️ Bulunamayan rol (atlanır):', eksik.join(', '))

    const res = await prisma.rolePermission.createMany({
      data: roller.map((r) => ({ roleId: r.id, permissionId: perm.id })),
      skipDuplicates: true,
    })
    console.log(`✅ izin=${PERM} rol=${rol.id} · mapping eklenen=${res.count} (hedef: ${roller.map((r) => r.slug).join(', ')})`)
  } finally {
    await prisma.$disconnect(); await pool.end()
  }
}
main().catch((e) => { console.error('⛔', e instanceof Error ? e.message : e); process.exitCode = 1 })
