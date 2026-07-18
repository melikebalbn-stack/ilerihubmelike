/**
 * (a) PLC_Listesi.xlsx -> IproPlc
 *
 * rack/slot CANLI S7 testiyle doğrulandı, hardcode:
 *   PANO-1 = 0/1, PANO-2 = 0/1, PANO-3 = 0/0
 * Bilinmeyen PANO kodu gelirse DUR.
 *
 * GEÇİT: tam 3 PLC beklenir.
 */
import { runCli, findFile, readRows, isEvet, clean, banner, summary, assertUniqueKeys, type Prisma } from './_lib'

// kod -> [rack, slot] (canlı S7 probe ile doğrulandı)
const RACK_SLOT: Record<string, [number, number]> = {
  'PANO-1': [0, 1],
  'PANO-2': [0, 1],
  'PANO-3': [0, 0],
}

export async function importPlc(prisma: Prisma, dryRun: boolean) {
  banner('(a) IproPlc — PLC Listesi', dryRun)
  const file = findFile(/^PLC[ _]Listesi\.xlsx$/i)
  const rows = readRows(file)

  const records = rows
    .filter((r) => clean(r['Kod']) !== null)
    .map((r) => {
      const kod = String(clean(r['Kod']))
      const rs = RACK_SLOT[kod]
      if (!rs) throw new Error(`Bilinmeyen PLC kodu "${kod}" — rack/slot hardcode haritasında yok`)
      return {
        kod,
        ad: String(clean(r['Adı']) ?? kod),
        ip: String(clean(r['IP Adresi']) ?? ''),
        rack: rs[0],
        slot: rs[1],
        aktif: isEvet(r['Aktif']),
      }
    })

  assertUniqueKeys(records, (r) => r.kod, 'IproPlc.kod', (r) => `${r.kod}: ${r.ad} (${r.ip})`)
  if (records.length !== 3) {
    throw new Error(`Beklenen 3 PLC, bulunan ${records.length} — kaynak veriyi kontrol et`)
  }

  let written = 0
  if (!dryRun) {
    for (const p of records) {
      await prisma.iproPlc.upsert({
        where: { kod: p.kod },
        create: p,
        update: { ad: p.ad, ip: p.ip, rack: p.rack, slot: p.slot, aktif: p.aktif },
      })
      written++
    }
  }

  for (const p of records) console.log(`     ${p.kod.padEnd(8)} ${p.ip.padEnd(16)} rack=${p.rack} slot=${p.slot} ${p.aktif ? '' : '(pasif)'}`)
  summary([
    ['kaynak dosya', file.split('/').pop()],
    ['beklenen PLC', 3],
    ['bulunan PLC', records.length],
    ['yazılan', dryRun ? '0 (dry-run)' : written],
  ])
  return { expected: 3, actual: records.length }
}

runCli('import-plc', importPlc)
