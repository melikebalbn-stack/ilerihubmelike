/**
 * IproTezgah IFS backfill — IPRO_IFS_Master.xlsx / IPRO_ESLEME sheet.
 *
 * Her IproTezgah.kod için:
 *   ifsWorkCenterNo ← WorkCenterNo
 *   ifsResourceId   ← ifsResourceId   (çoğu kod=kod; 30 override farklı)
 *
 * Idempotent (update). Yazma YALNIZ --apply ile; varsayılan/--dry-run önizleme.
 * Master glob ile bulunur (dosya adı sabit yazılmaz).
 *
 * GEÇİTLER (--apply öncesi tutmalı):
 *   - master satır = 203
 *   - eşleşmeyen kod = yok (master kodu DB IproTezgah'ta yoksa)
 *   - ters-yön = yok (bir ifsResourceId birden çok WorkCenterNo'ya bağlıysa; resource tek WC'ye ait olmalı)
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env scripts/ipro/import-ifs-master.ts            # önizleme (dry-run)
 *   npx tsx --env-file=.env scripts/ipro/import-ifs-master.ts --apply    # yaz
 */
import * as XLSX from 'xlsx'
import { runCli, findFile, clean, banner, summary, type Prisma } from './_lib'

function readSheet(file: string, sheet: string): Record<string, any>[] {
  const wb = XLSX.readFile(file)
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`"${sheet}" sheet'i yok (${file})`)
  return XLSX.utils
    .sheet_to_json<Record<string, any>>(ws, { defval: null })
    .filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''))
}

export async function importIfsMaster(prisma: Prisma) {
  const apply = process.argv.includes('--apply')
  const dryRun = !apply
  banner('IproTezgah IFS backfill — IPRO_ESLEME', dryRun)

  const file = findFile(/IPRO.?IFS.?Master.*\.xlsx$/i)
  const recs = readSheet(file, 'IPRO_ESLEME')
    .map((r) => ({
      kod: clean(r['IproTezgah.kod']),
      wc: clean(r['WorkCenterNo']),
      rid: clean(r['ifsResourceId']),
      override: String(clean(r['Override?']) ?? '') === 'EVET',
    }))
    .filter((r): r is { kod: string; wc: string | null; rid: string | null; override: boolean } => r.kod !== null)

  const overrideCount = recs.filter((r) => r.override).length

  // eşleşmeyen: master kodu DB IproTezgah'ta yok mu?
  const dbKods = new Set((await prisma.iproTezgah.findMany({ select: { kod: true } })).map((t) => t.kod))
  const eslesmeyen = recs.filter((r) => !dbKods.has(r.kod)).map((r) => r.kod)

  // ters-yön: aynı ifsResourceId birden çok WorkCenterNo'ya mı bağlı?
  const ridToWc = new Map<string, Set<string>>()
  for (const r of recs) {
    if (!r.rid) continue
    if (!ridToWc.has(r.rid)) ridToWc.set(r.rid, new Set())
    ridToWc.get(r.rid)!.add(r.wc ?? '∅')
  }
  const tersYon = [...ridToWc.entries()].filter(([, wcs]) => wcs.size > 1)

  summary([
    ['kaynak', file.split('/').pop()],
    ['master satır', `${recs.length} (beklenen 203)`],
    ['override (EVET)', `${overrideCount} (beklenen 30)`],
    ['eşleşmeyen kod', eslesmeyen.length === 0 ? 'yok ✅' : `${eslesmeyen.length}: ${eslesmeyen.join(', ')}`],
    ['ters-yön uyarı', tersYon.length === 0 ? 'yok ✅' : `${tersYon.length} çakışma`],
  ])
  for (const [rid, wcs] of tersYon) console.log(`     ⚠️ ${rid} → ${[...wcs].join(', ')}`)

  // --apply koruması: geçitler tutmadan yazma yok
  if (apply) {
    if (recs.length !== 203) throw new Error(`master satır ${recs.length} ≠ 203`)
    if (eslesmeyen.length) throw new Error(`${eslesmeyen.length} eşleşmeyen kod: ${eslesmeyen.join(', ')}`)
    if (tersYon.length) throw new Error(`${tersYon.length} ters-yön çakışması`)
    let written = 0
    for (const r of recs) {
      await prisma.iproTezgah.update({ where: { kod: r.kod }, data: { ifsWorkCenterNo: r.wc, ifsResourceId: r.rid } })
      written++
    }
    console.log(`\n  ✓ ${written} tezgah güncellendi (ifsWorkCenterNo + ifsResourceId)`)
  } else {
    console.log(`\n  [DRY-RUN] yazma yok. Geçitler tuttuysa --apply ile yaz.`)
  }

  return { satir: recs.length, override: overrideCount, eslesmeyen: eslesmeyen.length, tersYon: tersYon.length }
}

runCli('import-ifs-master', importIfsMaster)
