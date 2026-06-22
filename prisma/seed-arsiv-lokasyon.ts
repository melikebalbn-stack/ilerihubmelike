/**
 * ILERIHub Arşiv Modülü — Lokasyon Seed
 *
 * Tek fiziksel arşiv odası. Raf/göz bölümlemesi yok.
 * Composite unique (depoNo, rafKodu, siraNo) zorunlu olduğu için
 * placeholder değerler kullanıldı: ANA / GENEL / 1.
 *
 * Çalıştırma:
 *   cd /home/rokunet/projects/ilerihub
 *   npx tsx --env-file=.env prisma/seed-arsiv-lokasyon.ts
 *
 * Idempotent: birden fazla kez çalıştırılabilir. mevcutDoluluk runtime
 * tarafından yönetildiği için update'te dokunulmaz.
 */

import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🗂️  Arşiv lokasyon seed başlıyor...')

  const lokasyon = await prisma.arsivLokasyon.upsert({
    where: {
      // @@unique([depoNo, rafKodu, siraNo], map: "uq_arsiv_lokasyon_adres")
      depoNo_rafKodu_siraNo: {
        depoNo: 'ANA',
        rafKodu: 'GENEL',
        siraNo: 1,
      },
    },
    update: {
      // mevcutDoluluk BİLİNÇLİ olarak DIŞARIDA — runtime sayacı korunur.
      kapasite: 1000,
      aciklama: 'Ana arşiv odası — tek lokasyon, raf/göz bölümlemesi yok',
      aktifMi: true,
    },
    create: {
      depoNo: 'ANA',
      rafKodu: 'GENEL',
      siraNo: 1,
      kapasite: 1000,
      mevcutDoluluk: 0,
      aciklama: 'Ana arşiv odası — tek lokasyon, raf/göz bölümlemesi yok',
      aktifMi: true,
    },
  })

  console.log('✅ Lokasyon hazır:')
  console.log(`   ID:       ${lokasyon.id}`)
  console.log(`   Adres:    ${lokasyon.depoNo} / ${lokasyon.rafKodu} / ${lokasyon.siraNo}`)
  console.log(`   Kapasite: ${lokasyon.mevcutDoluluk} / ${lokasyon.kapasite}`)
  console.log(`   Aktif:    ${lokasyon.aktifMi}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
