/**
 * Servis Yönetimi Yetki Matrisi hedef tablosu (13 anahtar):
 *
 * | Anahtar                | super-admin | admin | hr-yoneticisi | idari-isler |
 * |------------------------|-------------|-------|---------------|--------------|
 * | servis.view            | ✓ | ✓ | ✓ | ✓ |
 * | servis.create          | ✓ | ✓ | ✓ | ✓ |
 * | servis.edit            | ✓ | ✓ | ✓ | ✓ |
 * | servis.history         | ✓ | ✓ | ✓ | ✓ |
 * | servis.tanim.manage    | ✓ | ✓ | ✓ | ✓ |
 * | servis.sorumlu.manage  | ✓ | ✓ | ✓ | ✓ |
 * | servis.passive         | ✓ | ✓ | ✓ | — |
 * | servis.restore         | ✓ | ✓ | ✓ | — |
 * | servis.export          | ✓ | ✓ | ✓ | — |
 * | servis.kvkk.view       | ✓ | — | ✓ | — |
 * | servis.liste.publish   | ✓ | — | ✓ | — |
 * | servis.sikayet.view    | ✓ | — | ✓ | ✓ |
 * | servis.sikayet.manage  | ✓ | — | ✓ | ✓ |
 *
 * MASTER madde 46 — şikâyet anahtarları (Elif onayı, 2026-09-23):
 *   · `idari-isler` İÇERİDE: şikâyetlere aksiyon alan taraf onlar.
 *   · `admin` DIŞARIDA: şikâyet kaydı şikâyetçi kimliğini taşır ve bu veriyi
 *     yalnız İK/İdari İşler görebilir. Aynı dışlama servis.kvkk.view satırında
 *     zaten var — desen tekrarlanıyor, icat edilmiyor.
 *   · servis.kvkk.view satırına DOKUNULMADI. `idari-isler`'i oraya eklemek
 *     onlara acil durum listesindeki TÜM iletişim yüzeyini de açardı; ihtiyaç
 *     yalnız şikâyet ekranı. Dar anahtar, geniş anahtarı genişletmeye yeğdir.
 *
 * GÜNCELLEME (2026-09-23) — `idari-isler` rolü ARTIK seed-roles.ts'te
 * TANIMLI (dal: dev/elif/seed-roles-idari-isler). Bu satırda daha önce
 * "tanımlı değil, sıfırdan kurulan ortamda exit(1) verir" yazıyordu; o dal
 * main'e girdiğinde bu açık kapanır. Rolün yetki listesi oradan da BU
 * dosyadaki 6 servis anahtarıyla birebir aynıdır.
 *
 * DÜZELTME (2026-09-23) — bu dalın commit mesajında `uygunsuzluk.manage`
 * için "seed'de yok, prod'a elle açılmış" deniyor; bu YANLIŞTIR. Anahtar
 * düzgün seed ediliyor: permissions.ts:164'te PERMISSION_KEYS içinde ve
 * seed-permissions.ts:38-41 o koleksiyonun üzerinde dönüyor. Yanlış tespit,
 * yalnız seed-permissions.ts'te literal grep yapılıp dosyanın anahtarları
 * permissions.ts'ten çektiğinin görülmemesinden kaynaklandı. Commit geçmişi
 * BİLEREK değiştirilmedi; düzeltme burada duruyor.
 *
 * NOT (madde 30, Melih'in düzeltmesi): servis.liste.publish'te admin YOK —
 * yayımlanan liste telefon içeriyor ve servis.kvkk.view de yalnız super-admin
 * + hr-yoneticisi'nde. Yayımlayan, yayımladığı veriyi görmeye yetkili olmalı;
 * iki anahtarın rol kümesi bilerek AYNI tutuldu.
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/seed-permissions.ts
 *   npx tsx --env-file=.env prisma/seed-servis-role-mapping.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

const ROLE_MAPPING: Record<string, string[]> = {
  'servis.view': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.create': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.edit': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.history': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.tanim.manage': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.sorumlu.manage': ['super-admin', 'admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.passive': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.restore': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.export': ['super-admin', 'admin', 'hr-yoneticisi'],
  'servis.kvkk.view': ['super-admin', 'hr-yoneticisi'],
  // admin YOK — gerekçe dosya başındaki nota bakınız (telefon içeren listeyi
  // yayımlayan, servis.kvkk.view ile onu görmeye de yetkili olmalı).
  'servis.liste.publish': ['super-admin', 'hr-yoneticisi'],
  // MASTER madde 46 — `admin` BİLEREK yok (şikâyetçi kimliği yalnız
  // İK/İdari İşler'e açık); gerekçe dosya başındaki nota bakın.
  'servis.sikayet.view': ['super-admin', 'hr-yoneticisi', 'idari-isler'],
  'servis.sikayet.manage': ['super-admin', 'hr-yoneticisi', 'idari-isler'],
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    console.log('🔐 Servis permission → role mapping başlıyor...')

    const permissionKeys = Object.keys(ROLE_MAPPING)
    const roleSlugs = [...new Set(Object.values(ROLE_MAPPING).flat())]

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    })
    const permissionByKey = new Map(permissions.map(permission => [permission.key, permission.id]))
    const missingPermissions = permissionKeys.filter(key => !permissionByKey.has(key))
    if (missingPermissions.length > 0) {
      console.error('Permission DB\'de yok (önce seed-permissions çalıştır):', missingPermissions)
      process.exit(1)
    }

    const roles = await prisma.role.findMany({
      where: { slug: { in: roleSlugs } },
      select: { id: true, slug: true },
    })
    const roleBySlug = new Map(roles.map(role => [role.slug, role.id]))
    const missingRoles = roleSlugs.filter(slug => !roleBySlug.has(slug))
    if (missingRoles.length > 0) {
      console.error('Role DB\'de yok (önce ilgili role seed\'ini çalıştır):', missingRoles)
      process.exit(1)
    }

    const rows: { roleId: string; permissionId: string }[] = []
    for (const [permissionKey, targetRoles] of Object.entries(ROLE_MAPPING)) {
      const permissionId = permissionByKey.get(permissionKey)!
      for (const roleSlug of targetRoles) {
        const roleId = roleBySlug.get(roleSlug)!
        rows.push({ roleId, permissionId })
      }
    }

    const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
    console.log(`✅ Eklendi: ${result.count} / ${rows.length} (skipDuplicates ile mevcutlar atlandı)`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
