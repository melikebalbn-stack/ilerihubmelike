/**
 * PR-Y4a: LDAP grup CN → Role slug eşleme tablosunu seed eder.
 *
 * Mevcut ilk eşleşme yalnızca `ilerigroup` → `kullanici`. Y4-PRE keşfinde
 * 34 user'ın bu grupta olduğu görüldü; tümü zaten manuel olarak
 * `kullanici` slug'ına bağlı (source='manual'). Bu seed source='azure_ad'
 * paralel kayıtları ekler — yetki genişlemesi YOK, sadece origin tracking.
 *
 * Diğer mapping'ler (#KaliteFull → kalite-yoneticisi vb.) Y4b yönetim UI
 * üzerinden Melih tarafından eklenecek (yetki genişlemesi riski olduğu için
 * tek tek kalibre edilir).
 */
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface MappingDef {
  groupCN: string
  roleSlug: string
  description: string
}

const INITIAL_MAPPINGS: MappingDef[] = [
  {
    groupCN: 'ilerigroup',
    roleSlug: 'kullanici',
    description:
      'Genel AD grubu — tüm çalışanların temel kullanıcı yetkisi (origin tracking)',
  },
]

async function main() {
  console.log('🔗 LDAP grup → Role mapping seed başlıyor...')

  for (const def of INITIAL_MAPPINGS) {
    const role = await prisma.role.findUnique({
      where: { slug: def.roleSlug },
      select: { id: true, name: true },
    })
    if (!role) {
      console.warn(`  ⚠️  Role slug bulunamadı: ${def.roleSlug} (atlandı)`)
      continue
    }

    const existing = await prisma.ldapGroupRoleMap.findUnique({
      where: { groupCN: def.groupCN },
      select: { id: true, roleId: true, isActive: true },
    })

    if (existing) {
      // Idempotent: aynı grupCN için kayıt varsa role'ü ve isActive'i güncelle
      await prisma.ldapGroupRoleMap.update({
        where: { groupCN: def.groupCN },
        data: {
          roleId: role.id,
          isActive: true,
          description: def.description,
        },
      })
      console.log(`  ✓ ${def.groupCN.padEnd(20)} → ${role.name} (güncellendi)`)
    } else {
      await prisma.ldapGroupRoleMap.create({
        data: {
          groupCN: def.groupCN,
          roleId: role.id,
          isActive: true,
          description: def.description,
        },
      })
      console.log(`  ✓ ${def.groupCN.padEnd(20)} → ${role.name} (yeni)`)
    }
  }

  console.log('✅ Mapping seed tamamlandı.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
