/**
 * Planlı Görevler — TaskCategory seed.
 *
 * 10 kategori NAME bazlı IDEMPOTENT eklenir: varsa ATLANIR, güncelleme YAPILMAZ.
 * Mevcut üç kategoriye (Sertifikasyon, Yıllık Bakım, Denetim) dokunulmaz.
 *
 * sortOrder tablodaki en büyük değerden devam eder — mevcut sıralama bozulmaz,
 * yeni kayıtlar sona eklenir. "Genel" listenin en sonundadır (serbest/ad-hoc).
 *
 * VARSAYILAN DRY-RUN: `--apply` verilmedikçe HİÇBİR yazma yapmaz.
 *
 * Usage:
 *   npx tsx scripts/seed-task-categories.ts           # dry-run
 *   npx tsx scripts/seed-task-categories.ts --apply   # gerçekten yaz
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

/** Sıra ÖNEMLİ: sortOrder bu diziye göre verilir, "Genel" en sonda. */
const KATEGORILER: { name: string; color: string }[] = [
  { name: 'İSG · Periyodik Teknik Kontrol', color: '#E0453A' },
  { name: 'İSG · Eğitim ve Tatbikat', color: '#F97316' },
  { name: 'Sağlık Gözetimi', color: '#EC4899' },
  { name: 'Ortam Ölçümleri', color: '#A855F7' },
  { name: 'BGYS / Bilgi Güvenliği', color: '#1A5AA0' },
  { name: 'Yönetim Sistemi', color: '#12B5CB' },
  { name: 'Güvenlik Belgeleri', color: '#64748B' },
  { name: 'Lisans ve Sözleşme Yenileme', color: '#8B5CF6' },
  { name: 'Çevre', color: '#16A34A' },
  { name: 'Genel', color: '#94A3B8' },
]

async function main() {
  console.log(`\n═══ TaskCategory seed ${APPLY ? '(APPLY)' : '(DRY-RUN — yazma yok)'} ═══\n`)

  const mevcutlar = await prisma.taskCategory.findMany({
    select: { name: true, sortOrder: true, color: true },
    orderBy: { sortOrder: 'asc' },
  })
  const adlar = new Set(mevcutlar.map((k) => k.name))
  let siradaki = mevcutlar.reduce((m, k) => Math.max(m, k.sortOrder), 0)

  console.log(`  Tabloda ${mevcutlar.length} kategori var, en büyük sortOrder = ${siradaki}`)
  mevcutlar.forEach((k) => console.log(`    (mevcut) ${String(k.sortOrder).padStart(2)} · ${k.name}`))
  console.log('')

  let eklenen = 0
  let atlanan = 0

  for (const k of KATEGORILER) {
    if (adlar.has(k.name)) {
      console.log(`  ATLANDI   ${k.name}  — zaten var, DOKUNULMADI`)
      atlanan++
      continue
    }
    siradaki += 1
    console.log(`  EKLENECEK ${String(siradaki).padStart(2)} · ${k.name}  ${k.color}`)
    if (APPLY) {
      await prisma.taskCategory.create({
        data: { name: k.name, color: k.color, sortOrder: siradaki, isActive: true },
      })
    }
    eklenen++
  }

  console.log(`\n  ÖZET: ${eklenen} eklen${APPLY ? 'di' : 'ecek'} · ${atlanan} atlandı`)
  if (!APPLY) console.log('  (dry-run — hiçbir şey yazılmadı; yazmak için --apply)')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
