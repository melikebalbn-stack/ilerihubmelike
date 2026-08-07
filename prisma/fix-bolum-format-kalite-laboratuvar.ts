import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Türkçe büyük harf: "i" -> "İ" (noktalı), "ı" -> "I" (noktasız) doğru dönüşür.
function trUpper(s: string): string {
  return s.toLocaleUpperCase('tr-TR').trim()
}

async function main() {
  const sections = await prisma.calibrationProductionSection.findMany({
    select: { id: true, name: true, departmentId: true },
  })

  // 1) "Kalite Laboratuvar[ı]" hiçbir varyantla yoksa, Kalite departmanına bağlı ekle.
  const hasKaliteLab = sections.some((s) => trUpper(s.name).includes('KALİTE LABORATUVAR'))
  if (!hasKaliteLab) {
    const kalite = await prisma.department.findUnique({ where: { name: 'Kalite' } })
    if (!kalite) {
      console.log('! "Kalite" departmanı bulunamadı — KALİTE LABORATUVAR eklenemedi, elle kontrol edin.')
    } else {
      const maxSortOrder = await prisma.calibrationProductionSection.aggregate({ _max: { sortOrder: true } })
      await prisma.calibrationProductionSection.create({
        data: {
          name: 'KALİTE LABORATUVAR',
          departmentId: kalite.id,
          sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
        },
      })
      console.log('+ Eklendi: KALİTE LABORATUVAR -> Kalite')
      sections.push({ id: 'new', name: 'KALİTE LABORATUVAR', departmentId: kalite.id })
    }
  } else {
    console.log('= "Kalite Laboratuvar" zaten bir varyantla mevcut, eklenmedi.')
  }

  // 2) Format normalizasyonu: tüm isimler Türkçe büyük harfe çevrilir — AMA iki farklı
  // kayıt aynı büyük-harf hedefine denk geliyorsa (gerçek duplicate riski), o grup
  // ATLANIR ve rapora yazılır; elle çözülmeden otomatik değiştirilmez.
  const fresh = await prisma.calibrationProductionSection.findMany({
    select: { id: true, name: true },
  })

  const groups = new Map<string, { id: string; name: string }[]>()
  for (const s of fresh) {
    const target = trUpper(s.name)
    if (!groups.has(target)) groups.set(target, [])
    groups.get(target)!.push(s)
  }

  const toUpdate: { id: string; from: string; to: string }[] = []
  const collisions: { target: string; members: string[] }[] = []

  for (const [target, members] of groups) {
    if (members.length > 1) {
      collisions.push({ target, members: members.map((m) => m.name) })
      continue
    }
    const s = members[0]
    if (s.name !== target) {
      toUpdate.push({ id: s.id, from: s.name, to: target })
    }
  }

  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map((u) => prisma.calibrationProductionSection.update({ where: { id: u.id }, data: { name: u.to } }))
    )
  }

  console.log(`\n=== Format normalizasyonu ===`)
  if (toUpdate.length === 0) {
    console.log('Değiştirilecek isim yok — hepsi zaten büyük harf formatında.')
  } else {
    for (const u of toUpdate) console.log(`  ~ "${u.from}" -> "${u.to}"`)
  }

  if (collisions.length > 0) {
    console.log(`\n⚠️  ELLE ÇÖZÜM GEREKİYOR (aynı büyük-harf hedefine denk gelen kayıtlar, OTOMATİK DEĞİŞTİRİLMEDİ):`)
    for (const c of collisions) {
      console.log(`  - "${c.target}" hedefine denk gelenler: ${c.members.map((m) => `"${m}"`).join(', ')}`)
    }
    console.log('  Bunlardan hangisinin doğru/güncel kayıt olduğuna karar verip diğerini elle silin/birleştirin.')
  }

  const total = await prisma.calibrationProductionSection.count()
  console.log(`\nToplam bölüm: ${total}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
