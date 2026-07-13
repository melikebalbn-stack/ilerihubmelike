/**
 * (e) Hurdalar — iki kaynak:
 *
 *   HURDALAR.xlsx           → IproHurdaSebebi (39 satır, 'true'/'false' parse)
 *   hurda_is_merkezi_*.xlsx → IproHurdaTezgah
 *      'İş Merkezleri' virgülle ayrılmış tezgah kodu listesi → split + dedupe
 *      (liste içinde tekrar eden kod var, örn. PK01 iki kez → tekilleştir).
 *      IproTezgah'ta olmayan kodlar atlanır ve raporlanır (write modunda). Batch createMany.
 *
 * DRY-RUN tablo-bağımsız: sebep geçidi (39) Excel'den; tezgah çözümü/yazma yalnız write modunda.
 */
import {
  runCli, findFile, readRows, asBool, clean, splitCodes,
  createManyBatched, banner, summary, assertUniqueKeys,
  applyDuplicateOverrides, DUPLICATE_CODE_OVERRIDES, type Prisma,
} from './_lib'

export async function importHurda(prisma: Prisma, dryRun: boolean) {
  banner('(e) IproHurdaSebebi + IproHurdaTezgah', dryRun)

  // ── 1) HURDALAR → IproHurdaSebebi (Excel + geçit) ──
  const sebepFile = findFile(/^HURDALAR\.xlsx$/i)
  const sebepRecords = readRows(sebepFile)
    .filter((r) => clean(r['Kod']) !== null)
    .map((r) => ({
      kod: String(clean(r['Kod'])),
      ad: String(clean(r['Ad']) ?? ''),
      erpKodu: clean(r['Erp Kodu']),
      grupKodu: clean(r['Grup Kodu']),
      grubu: clean(r['Grubu']),
      uretimHurdaRework: asBool(r['Üretim Hurda/Rework']),
      rework: asBool(r['Rework']),
      hurda: asBool(r['Hurda']),
      bilesenHurdaRework: asBool(r['Bileşen Hurda/Rework']),
      oeeEtkiler: asBool(r["OEE'yi Etkiler"]),
      yorumZorunlu: asBool(r['Yorum Zorunlu']),
      sinyalsizGiris: asBool(r['Sinyalsiz Hurda Girişi']),
      aktif: asBool(r['Aktif']),
    }))
  applyDuplicateOverrides(sebepRecords, DUPLICATE_CODE_OVERRIDES.hurdaSebebi, 'hurdaSebebi')
  assertUniqueKeys(sebepRecords, (r) => r.kod, 'IproHurdaSebebi.kod', (r) => `${r.kod}: ${r.ad}`)
  if (sebepRecords.length !== 39) throw new Error(`Beklenen 39 hurda sebebi, bulunan ${sebepRecords.length}`)

  // ── 2) hurda_is_merkezi → ham (hurda,tezgah) çiftleri (Excel) ──
  const linkFile = findFile(/hurda[_ ]is[_ ]merkezi/i)
  const sebepKodSet = new Set(sebepRecords.map((s) => s.kod))
  const rawPairs: { hurdaKod: string; tezgahKod: string }[] = []
  let skippedSebep = 0
  for (const r of readRows(linkFile).filter((r) => clean(r['Kod']) !== null)) {
    const hurdaKod = String(clean(r['Kod']))
    if (!sebepKodSet.has(hurdaKod)) { skippedSebep++; continue }
    for (const tezgahKod of splitCodes(r['İş Merkezleri'])) rawPairs.push({ hurdaKod, tezgahKod })
  }

  // ── YAZMA (yalnız write modu): tezgah çözümü + filtre + batch ──
  let written = 0
  const missingTezgah = new Set<string>()
  if (!dryRun) {
    // sebep upsert (önce), sonra id map
    for (const s of sebepRecords) {
      const { kod, ...rest } = s
      await prisma.iproHurdaSebebi.upsert({ where: { kod }, create: { kod, ...rest }, update: rest })
    }
    const tezgahIdByKod = new Map(
      (await prisma.iproTezgah.findMany({ select: { id: true, kod: true } })).map((t) => [t.kod, t.id] as const),
    )
    const sebepIdByKod = new Map(
      (await prisma.iproHurdaSebebi.findMany({ select: { id: true, kod: true } })).map((s) => [s.kod, s.id] as const),
    )
    const data: { hurdaSebebiId: string; tezgahId: string }[] = []
    for (const p of rawPairs) {
      const tezgahId = tezgahIdByKod.get(p.tezgahKod)
      const hurdaSebebiId = sebepIdByKod.get(p.hurdaKod)
      if (!tezgahId) { missingTezgah.add(p.tezgahKod); continue }
      if (!hurdaSebebiId) continue
      data.push({ hurdaSebebiId, tezgahId })
    }
    written = await createManyBatched(prisma.iproHurdaTezgah, data)
  }

  summary([
    ['sebep kaynak dosya', sebepFile.split('/').pop()],
    ['eşleme kaynak dosya', linkFile.split('/').pop()],
    ['hurda sebebi', `${sebepRecords.length} (beklenen 39)`],
    ['ham (sebep,tezgah) çift (dedupe/satır)', rawPairs.length],
    ['atlanan (sebep 39 dışı)', skippedSebep],
    ['atlanan tezgah kodu (tekil)', dryRun ? '(write modunda)' : `${missingTezgah.size}${missingTezgah.size ? ' → ' + [...missingTezgah].join(', ') : ''}`],
    ['hurda-tezgah yazılan', dryRun ? '0 (dry-run)' : written],
  ])
  return { sebep: sebepRecords.length, rawPairs: rawPairs.length }
}

runCli('import-hurda', importHurda)
