/**
 * (d) Duruşlar — üç kaynak:
 *
 *   DURUŞ_TİPLERİ.xlsx  → IproDurusTipi (2 satır)
 *      VERİ HATASI: "MALZEME SEÇME" satırında Kod = "#65d054" (renk kodu kaymış).
 *      Kod '#' ile başlıyorsa kod='MLZSEC' yaz, renk bilgisini at, KONSOLA UYARI bas.
 *
 *   DURUŞLAR_.xlsx      → IproDurusSebebi (115 satır, 'true'/'false' string parse)
 *      tipId: 'Tip Kodu' ↔ IproDurusTipi.kod (eşleşmezse null — nullable).
 *
 *   DowntimeWorkCenterMatchListReport → IproDurusTezgah (~16.802 satır)
 *      'Sık Kullanılan Mı'='EVET' → sikKullanilan=true. (durus,tezgah) çiftine göre dedupe
 *      (sik = herhangi biri EVET). Batch createMany + skipDuplicates — tek tek insert YOK.
 *      Duruş sebebi 115 listesinde olmayan referanslar atlanır ve raporlanır.
 *      (Downtime'daki tüm tezgah kodları zaten 203'ün içinde — tezgah eksiği write modunda doğrulanır.)
 *
 * DRY-RUN tablo-bağımsız: geçitler Excel'den; ipro tablolarına yalnız yazma modunda erişilir.
 */
import {
  runCli, findFile, readRows, isEvet, asBool, clean, asInt,
  createManyBatched, banner, summary, assertUniqueKeys,
  applyDuplicateOverrides, DUPLICATE_CODE_OVERRIDES, type Prisma,
} from './_lib'

export async function importDurus(prisma: Prisma, dryRun: boolean) {
  banner('(d) IproDurusTipi + IproDurusSebebi + IproDurusTezgah', dryRun)

  // ── 1) DURUŞ TİPLERİ ── ('T[İI]PLER' yalnız bu dosyada; DURUŞLAR ile karışmaz)
  const tipiFile = findFile(/T[İI]PLER/i)
  const tipiRecords = readRows(tipiFile)
    .filter((r) => clean(r['Adı']) !== null)
    .map((r) => {
      let kod = String(clean(r['Kod']) ?? '')
      if (kod.startsWith('#')) {
        console.warn(`  ⚠️  DURUŞ TİPİ veri hatası: Kod="${kod}" ("${clean(r['Adı'])}") → 'MLZSEC' (renk kodu kaymış)`)
        kod = 'MLZSEC'
      }
      return { kod, ad: String(clean(r['Adı'])), teepOrder: asInt(r['TeepOrder']), aktif: isEvet(r['Aktif']) }
    })
  assertUniqueKeys(tipiRecords, (r) => r.kod, 'IproDurusTipi.kod', (r) => `${r.kod}: ${r.ad}`)
  if (tipiRecords.length !== 2) throw new Error(`Beklenen 2 duruş tipi, bulunan ${tipiRecords.length}`)

  // ── 2) DURUŞLAR → IproDurusSebebi ──
  const sebepFile = findFile(/^DURU\S*LAR\s*\.xlsx$/i)
  const sebepRecords = readRows(sebepFile)
    .filter((r) => clean(r['Kod']) !== null)
    .map((r) => ({
      kod: String(clean(r['Kod'])),
      ad: String(clean(r['Ad']) ?? ''),
      erpKodu: clean(r['Erp Kodu']),
      tipKod: clean(r['Tip Kodu']), // id'ye yazma modunda çözülür
      bitisTipi: String(clean(r['Bitiş Tipi']) ?? ''),
      renkKodu: clean(r['Renk Kodu']),
      temelSebep: clean(r['Temel Sebep Kodu']),
      planli: asBool(r['Planlı']),
      uretimDisi: asBool(r['Üretim Dışı']),
      setupDurusu: asBool(r['Setup Duruşu']),
      plcKilitle: asBool(r['PLC Kilitle']),
      askiyaAl: asBool(r['Askıya Al']),
      makineKaynakli: asBool(r['Makine Kaynaklı']),
      operatorKaynakli: asBool(r['Operatör Kaynaklı']),
      yetkiliOnayGerekli: asBool(r['Yetkili Sicili Onayı Gerekli']),
      durusAktifkenIsBitirilemez: asBool(r['Duruş Aktifken İş Bitirilemez']),
      uretimdeGosterilsin: asBool(r['Üretimde de gösterilsin mi?']),
      aktif: asBool(r['Aktif']),
    }))
  applyDuplicateOverrides(sebepRecords, DUPLICATE_CODE_OVERRIDES.durusSebebi, 'durusSebebi')
  assertUniqueKeys(sebepRecords, (r) => r.kod, 'IproDurusSebebi.kod', (r) => `${r.kod}: ${r.ad}`)
  if (sebepRecords.length !== 115) throw new Error(`Beklenen 115 duruş sebebi, bulunan ${sebepRecords.length}`)

  // ── 3) Downtime → (durus,tezgah) çiftleri (Excel; DB'siz sayım) ──
  const dtFile = findFile(/Downtime.*MatchList/i)
  const dtRows = readRows(dtFile)
  const sebepKodSet = new Set(sebepRecords.map((s) => s.kod))

  const pairMap = new Map<string, { durusKod: string; tezgahKod: string; sik: boolean }>()
  let missingDurus = 0
  for (const r of dtRows) {
    const durusKod = clean(r['Duruş Kodu'])
    const tezgahKod = clean(r['İş Merkezi Kodu'])
    if (durusKod === null || tezgahKod === null) continue
    if (!sebepKodSet.has(durusKod)) { missingDurus++; continue }
    const key = `${durusKod}::${tezgahKod}`
    const sik = isEvet(r['Sık Kullanılan Mı'])
    const prev = pairMap.get(key)
    if (prev) prev.sik = prev.sik || sik
    else pairMap.set(key, { durusKod, tezgahKod, sik })
  }

  // ── YAZMA (yalnız write modu) ──
  let tipMatched = 0
  let dtWritten = 0
  let missingTezgahWrite = 0
  if (!dryRun) {
    // tipi
    for (const t of tipiRecords) {
      await prisma.iproDurusTipi.upsert({
        where: { kod: t.kod },
        create: t,
        update: { ad: t.ad, teepOrder: t.teepOrder, aktif: t.aktif },
      })
    }
    const tipiIdByKod = new Map(
      (await prisma.iproDurusTipi.findMany({ select: { id: true, kod: true } })).map((t) => [t.kod, t.id] as const),
    )
    // sebep
    for (const s of sebepRecords) {
      const { kod, tipKod, ...rest } = s
      const tipId = tipKod ? tipiIdByKod.get(tipKod) ?? null : null
      if (tipId) tipMatched++
      await prisma.iproDurusSebebi.upsert({ where: { kod }, create: { kod, tipId, ...rest }, update: { tipId, ...rest } })
    }
    // durus-tezgah (batch)
    const tezgahIdByKod = new Map(
      (await prisma.iproTezgah.findMany({ select: { id: true, kod: true } })).map((t) => [t.kod, t.id] as const),
    )
    const sebepIdByKod = new Map(
      (await prisma.iproDurusSebebi.findMany({ select: { id: true, kod: true } })).map((s) => [s.kod, s.id] as const),
    )
    const data: { durusSebebiId: string; tezgahId: string; sikKullanilan: boolean }[] = []
    for (const p of pairMap.values()) {
      const durusSebebiId = sebepIdByKod.get(p.durusKod)
      const tezgahId = tezgahIdByKod.get(p.tezgahKod)
      if (!durusSebebiId || !tezgahId) { missingTezgahWrite++; continue }
      data.push({ durusSebebiId, tezgahId, sikKullanilan: p.sik })
    }
    dtWritten = await createManyBatched(prisma.iproDurusTezgah, data)
  }

  summary([
    ['duruş tipi', `${tipiRecords.length} (beklenen 2)`],
    ['duruş sebebi', `${sebepRecords.length} (beklenen 115)`],
    ['  tipId eşleşen sebep', dryRun ? '(write modunda)' : `${tipMatched}/${sebepRecords.length}`],
    ['downtime ham satır', dtRows.length],
    ['distinct (duruş,tezgah) çift', pairMap.size],
    ['  atlanan (duruş sebebi 115 dışı)', missingDurus],
    ['  atlanan (tezgah/id çözülemedi)', dryRun ? '(write modunda)' : missingTezgahWrite],
    ['durus-tezgah yazılan', dryRun ? '0 (dry-run)' : dtWritten],
  ])
  return { tipi: tipiRecords.length, sebep: sebepRecords.length, durusTezgah: pairMap.size }
}

runCli('import-durus', importDurus)
