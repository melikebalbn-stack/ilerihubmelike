import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Prod Department tablosu (Melih onaylı liste) - sandbox test verisi
const DEPARTMENTS = [
  { name: 'Asansör', code: 'ASANSOR', sortOrder: 1 },
  { name: 'Sistem Geliştirme', code: 'IT', sortOrder: 2 },
  { name: 'İnsan Varlıkları', code: 'IK', sortOrder: 3 },
  { name: 'Kalite', code: 'KALITE', sortOrder: 4 },
  { name: 'Muhasebe', code: 'MUHASEBE', sortOrder: 5 },
  { name: 'Mühendislik', code: 'MUHENDISLIK', sortOrder: 6 },
  { name: 'Satınalma', code: 'SATINALMA', sortOrder: 7 },
  { name: 'Satış Pazarlama', code: 'SATIS', sortOrder: 8 },
  { name: 'Üretim', code: 'URETIM', sortOrder: 9 },
  { name: 'Üretim Planlama', code: 'URETIM_PLANLAMA', sortOrder: 10 },
  { name: 'Yönetim', code: 'YONETIM', sortOrder: 11 },
]

// Kalibrasyon "Bölüm" listesi - departmana göre. Depo, "Departman" listesinde
// yok; Depo departmanı tanımlanana kadar bu bölümler eklenmiyor (bkz. rapor).
const SECTIONS: { name: string; departmentName: string }[] = [
  { name: 'GİRİŞ KALİTE', departmentName: 'Kalite' },
  { name: 'PROSES KALİTE', departmentName: 'Kalite' },
  { name: 'FİNAL KALİTE', departmentName: 'Kalite' },
  { name: 'CMM', departmentName: 'Kalite' },
  { name: 'KALİTE LABORATUVAR', departmentName: 'Kalite' },
  { name: 'KALİTE DUVAR', departmentName: 'Kalite' },
  { name: 'KARANTİNA', departmentName: 'Kalite' },
  { name: 'KALİTE OFİS', departmentName: 'Kalite' },
  { name: 'MONTAJ', departmentName: 'Üretim' },
  { name: 'PAKETLEME', departmentName: 'Üretim' },
  { name: 'KAYNAKHANE', departmentName: 'Üretim' },
  { name: 'PUNTA', departmentName: 'Üretim' },
  { name: 'PRESHANA', departmentName: 'Üretim' },
  { name: 'ABKANT', departmentName: 'Üretim' },
  { name: 'MATKAP', departmentName: 'Üretim' },
  { name: 'CNC', departmentName: 'Üretim' },
  { name: 'TESTERE', departmentName: 'Üretim' },
  { name: 'BORU BÜKÜM', departmentName: 'Üretim' },
  { name: 'LAZER', departmentName: 'Üretim' },
  { name: 'ENJEKSİYON', departmentName: 'Üretim' },
  { name: 'BAKIMHANE', departmentName: 'Üretim' },
  // Kalıphane, ayrı bir Department kaydı değil (prod Department listesinde yok) —
  // ana yapı bozulmadan Mühendislik'in bir Bölümü olarak eklendi.
  { name: 'KALIPHANE', departmentName: 'Mühendislik' },
]

async function main() {
  console.log('Departmanlar ekleniyor (sandbox test verisi)...')
  for (const d of DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { code: d.code } })
    if (!existing) {
      await prisma.department.create({ data: d })
      console.log(`  + Eklendi: ${d.name}`)
    } else {
      console.log(`  = Zaten var: ${d.name}`)
    }
  }

  console.log('\nILERI-1 lokasyonu ekleniyor...')
  const existingLoc = await prisma.calibrationLocation.findUnique({ where: { name: 'ILERI-1' } })
  if (!existingLoc) {
    await prisma.calibrationLocation.create({ data: { name: 'ILERI-1', code: 'ILERI-1', sortOrder: 1 } })
    console.log('  + ILERI-1 eklendi')
  } else {
    console.log('  = ILERI-1 zaten var')
  }

  console.log('\nBölümler ekleniyor...')
  let sortOrder = 1
  for (const s of SECTIONS) {
    const dept = await prisma.department.findUnique({ where: { name: s.departmentName } })
    if (!dept) {
      console.log(`  ! Departman bulunamadı, atlandı: ${s.departmentName} (${s.name})`)
      continue
    }
    const existing = await prisma.calibrationProductionSection.findUnique({ where: { name: s.name } })
    if (existing) {
      await prisma.calibrationProductionSection.update({ where: { name: s.name }, data: { departmentId: dept.id } })
      console.log(`  = Güncellendi: ${s.name} -> ${s.departmentName}`)
    } else {
      await prisma.calibrationProductionSection.create({
        data: { name: s.name, departmentId: dept.id, sortOrder: sortOrder++ },
      })
      console.log(`  + Eklendi: ${s.name} -> ${s.departmentName}`)
    }
  }

  const allDepts = await prisma.department.findMany({ orderBy: { sortOrder: 'asc' } })
  const allSections = await prisma.calibrationProductionSection.findMany({ include: { department: true } })
  console.log(`\nToplam departman: ${allDepts.length}, toplam bölüm: ${allSections.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
