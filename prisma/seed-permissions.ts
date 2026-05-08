import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { PERMISSION_KEYS, PERMISSION_DESCRIPTIONS } from '../src/lib/auth/permissions'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔐 Permission seed başlıyor...')

  let created = 0
  let updated = 0

  for (const key of Object.values(PERMISSION_KEYS)) {
    const module = key.split('.')[0]
    const description = PERMISSION_DESCRIPTIONS[key] ?? key

    const existing = await prisma.permission.findUnique({ where: { key } })

    if (existing) {
      await prisma.permission.update({
        where: { key },
        data: { module, description, isSystem: true },
      })
      updated++
    } else {
      await prisma.permission.create({
        data: { key, module, description, isSystem: true },
      })
      created++
    }
  }

  // Sistemde tanımlı olmayan eski permission'ları (kodda silinmişler) raporla
  const allInDb = await prisma.permission.findMany({ select: { key: true, isSystem: true } })
  const definedKeys = new Set<string>(Object.values(PERMISSION_KEYS) as string[])
  const orphaned = allInDb.filter(p => p.isSystem && !definedKeys.has(p.key))

  console.log(`✅ Oluşturuldu: ${created}, güncellendi: ${updated}`)
  if (orphaned.length > 0) {
    console.warn(`⚠️ DB'de var ama kodda yok (manuel temizlik gerekebilir):`, orphaned.map(o => o.key))
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
