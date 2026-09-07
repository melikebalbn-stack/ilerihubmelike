/**
 * Talep KALICI SİLME yetkisi — rol + atama seed'i.
 *
 * `helpdesk.ticket.delete` iznini AYRI bir role ("Talep Silme") bağlar ve o rolü
 * yalnız tek kullanıcıya atar.
 *
 * NEDEN AYRI ROL: izin mevcut rollerden birine (super-admin, it-admin…)
 * bağlansaydı o rolü taşıyan HERKES silebilirdi — prod'da 8 super-admin var.
 * Silme geri alınamaz; "süper yönetici olmak" tek başına yetmemeli, izin
 * açıkça verilmiş olmalı. Yeni rol bu ayrımı taşıyan en küçük yapı.
 *
 * ÖNKOŞUL: permission satırı DB'de olmalı. Bu script'ten ÖNCE:
 *   npx tsx --env-file=.env prisma/seed-permissions.ts
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-ticket-delete-role-mapping.ts
 *
 * Idempotent: rol/bağ/atama varsa dokunmaz, yoksa oluşturur. Tekrar
 * çalıştırmak güvenli.
 *
 * SONRADAN YETKİ VERME: başka birine vermek için bu script'i değiştirmeye
 * gerek yok — Yetkilendirme panelinden (/settings/roller) "Talep Silme" rolü
 * atanır. Rolün taşıdığı tek izin budur.
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const PERMISSION_KEY = 'helpdesk.ticket.delete'
const ROLE_SLUG = 'ticket-silme'
const ROLE_NAME = 'Talep Silme'
const ROLE_DESC =
  'IT talebini kalıcı olarak silme. Tek izinli rol — silme geri alınamadığı için ' +
  'super-admin/it-admin ile birlikte verilmez, ayrıca atanır.'

/** Başlangıçta rolü alacak kullanıcı(lar). Sonradan panelden yönetilir. */
const BASLANGIC_KULLANICILARI = ['melih.dilben@ilerigroup.com']

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    console.log('🔐 Talep silme yetkisi seed başlıyor...')

    // 1) Permission — seed-permissions.ts tarafından oluşturulmuş olmalı.
    const permission = await prisma.permission.findUnique({
      where: { key: PERMISSION_KEY },
      select: { id: true },
    })
    if (!permission) {
      console.error(
        `❌ Permission DB'de yok: ${PERMISSION_KEY}\n` +
          '   Önce çalıştır: npx tsx --env-file=.env prisma/seed-permissions.ts',
      )
      process.exit(1)
    }

    // 2) Rol — yoksa oluştur.
    let role = await prisma.role.findUnique({ where: { slug: ROLE_SLUG }, select: { id: true } })
    if (!role) {
      role = await prisma.role.create({
        data: {
          slug: ROLE_SLUG,
          name: ROLE_NAME,
          description: ROLE_DESC,
          isSystem: false,
          isProtected: false,
        },
        select: { id: true },
      })
      console.log(`✅ Rol oluşturuldu: ${ROLE_SLUG}`)
    } else {
      console.log(`↷ Rol zaten var: ${ROLE_SLUG}`)
    }

    // 3) İzin → rol bağı.
    const bag = await prisma.rolePermission.createMany({
      data: [{ roleId: role.id, permissionId: permission.id }],
      skipDuplicates: true,
    })
    console.log(bag.count > 0 ? `✅ İzin role bağlandı` : '↷ İzin zaten bağlı')

    // 4) Rol → kullanıcı ataması.
    for (const eposta of BASLANGIC_KULLANICILARI) {
      const user = await prisma.user.findUnique({
        where: { email: eposta },
        select: { id: true, isActive: true },
      })
      if (!user) {
        console.warn(`⚠ Kullanıcı bulunamadı, atlanıyor: ${eposta}`)
        continue
      }
      if (!user.isActive) {
        console.warn(`⚠ Kullanıcı pasif, atlanıyor: ${eposta}`)
        continue
      }
      const atama = await prisma.userRole.createMany({
        data: [{ userId: user.id, roleId: role.id, source: 'manual' }],
        skipDuplicates: true,
      })
      console.log(atama.count > 0 ? `✅ Rol atandı: ${eposta}` : `↷ Rol zaten atanmış: ${eposta}`)
    }

    // 5) Özet — kimler silebilir.
    const sahipler = await prisma.userRole.findMany({
      where: { roleId: role.id },
      select: { user: { select: { email: true, isActive: true } } },
    })
    console.log(
      `\n📋 '${PERMISSION_KEY}' iznini taşıyanlar (bu rol üzerinden): ` +
        (sahipler.length === 0
          ? '(kimse)'
          : sahipler.map((s) => s.user.email + (s.user.isActive ? '' : ' [pasif]')).join(', ')),
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
