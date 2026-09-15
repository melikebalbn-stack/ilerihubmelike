/**
 * TEK SEFERLİK düzeltme: MAS kaynaklı IPRO kayıtlarında +3s (İstanbul yerel-yanlış-UTC) kayması olan
 * datetime alanlarını doğru UTC'ye çeker. Düzeltme masTarih() ile yapılır (SABİT -3 DEĞİL, IANA/DST).
 *
 * VARSAYILAN: yalnız RAPOR (etkilenen satır sayısı + örnek before/after), YAZMA YOK.
 * Uygulamak için: `npx tsx scripts/ipro/mas-tz-duzeltme.ts --apply`
 *
 * Yalnız kaynak='MAS' satırlar. Yeni kod (uretim.ts masTarih) deploy edildikten SONRA çalıştır —
 * aksi halde sonraki ayna turu yeniden bozuk yazar. İdempotent DEĞİL: iki kez çalıştırma (−3s daha kayar).
 */
import { prisma } from '../../src/lib/prisma'
import { masTarih } from '../../src/lib/mas/tarih'

const APPLY = process.argv.includes('--apply')

async function main() {
  const loglar = await prisma.iproProductionLog.findMany({
    where: { kaynak: 'MAS' },
    select: { id: true, baslatildiAt: true, bitirildiAt: true },
  })
  const duruslar = await prisma.iproMachineDowntime.findMany({
    where: { kaynak: 'MAS' },
    select: { id: true, baslangic: true, bitis: true },
  })

  const logBas = loglar.filter((l) => l.baslatildiAt).length
  const logBit = loglar.filter((l) => l.bitirildiAt).length
  const durBas = duruslar.filter((d) => d.baslangic).length
  const durBit = duruslar.filter((d) => d.bitis).length

  console.log('=== ETKİLENEN SATIRLAR (kaynak=MAS) ===')
  console.log(`IproProductionLog: ${loglar.length} satır — baslatildiAt ${logBas}, bitirildiAt ${logBit}`)
  console.log(`IproMachineDowntime: ${duruslar.length} satır — baslangic ${durBas}, bitis ${durBit}`)

  console.log('\n=== ÖRNEK before → after (ilk 3 log) ===')
  for (const l of loglar.slice(0, 3)) {
    console.log(
      `log ${l.id}: baslatildiAt ${l.baslatildiAt?.toISOString()} → ${masTarih(l.baslatildiAt)?.toISOString()}` +
        (l.bitirildiAt ? ` | bitirildiAt ${l.bitirildiAt.toISOString()} → ${masTarih(l.bitirildiAt)?.toISOString()}` : ''),
    )
  }
  console.log('=== ÖRNEK before → after (ilk 3 duruş) ===')
  for (const d of duruslar.slice(0, 3)) {
    console.log(
      `durus ${d.id}: baslangic ${d.baslangic?.toISOString()} → ${masTarih(d.baslangic)?.toISOString()}` +
        (d.bitis ? ` | bitis ${d.bitis.toISOString()} → ${masTarih(d.bitis)?.toISOString()}` : ''),
    )
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] --apply verilmedi, YAZMA YAPILMADI.')
    return
  }

  console.log('\n[APPLY] tek transaction ile düzeltiliyor…')
  await prisma.$transaction([
    ...loglar.map((l) =>
      prisma.iproProductionLog.update({
        where: { id: l.id },
        data: { baslatildiAt: masTarih(l.baslatildiAt) ?? undefined, bitirildiAt: masTarih(l.bitirildiAt) },
      }),
    ),
    ...duruslar.map((d) =>
      prisma.iproMachineDowntime.update({
        where: { id: d.id },
        data: { baslangic: masTarih(d.baslangic) ?? d.baslangic, bitis: masTarih(d.bitis) },
      }),
    ),
  ])
  console.log(`[APPLY] tamam: ${loglar.length} log + ${duruslar.length} duruş güncellendi.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
