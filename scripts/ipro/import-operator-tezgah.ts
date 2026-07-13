/**
 * (f) Personel_İş_Merkezi_Eşleme.xlsx → IproOperatorTezgah
 *
 * Yalnız 'Kullanıcı Tipi Adı' = 'Blue Collar' satırları (≈521).
 *
 * SİCİL EŞLEŞTİRME = NUMERIC-CORE, FİLTRELİ (DB 'ILR-00644' ↔ MAS '0644'):
 *   - MAS sicili SADECE /^\d+$/ ise işlenir; alfanumerik (PK1, MASxxx, DENEME,
 *     server.user, MasAutoService…) = "sistem hesabı" → atlanır ve raporlanır.
 *   - core = baştaki sıfırlar atılmış rakam dizisi. MAS '0644' → '644'.
 *   - DB: Personnel.sicilNo'dan rakamlar çekilir + baştaki sıfırlar atılır.
 *     'ILR-00644' → '644'. (SADECE bellek-içi; DB'ye sicil türevi YAZILMAZ.)
 *   - ÇAKIŞMA GEÇİDİ: DB core'ları arasında çakışma varsa DUR + listele.
 *
 * KALICILIK: IproOperatorTezgah.personnelId = Personnel.id (gerçek DB id'si).
 *   Sicilin hiçbir türevi (core/padded/normalized) veritabanına YAZILMAZ.
 *
 * PASİF PERSONEL: Personnel.aktif === false ise EŞLEŞSE BİLE atlanır (bayat MAS listesi;
 *   ayrılmış personel operatör ekranında ölü isim üretir).
 *
 * 'İş Merkezleri' virgüllü liste → split + dedupe → IproTezgah (write modunda çözülür).
 * kaynak = 'MAS_IMPORT'. Batch createMany + skipDuplicates (idempotent).
 *
 * DRY-RUN: Personnel OKUR (mevcut tablo). IproTezgah'a yalnız write modunda erişilir.
 */
import {
  runCli, findFile, readRows, clean, splitCodes,
  createManyBatched, banner, summary, type Prisma,
} from './_lib'

/** Rakamları çek, baştaki sıfırları at. 'ILR-00644'→'644', '0644'→'644', ''→'0'. */
function numericCore(s: string): string {
  const digits = s.replace(/\D/g, '')
  return digits.replace(/^0+/, '') || '0'
}

export async function importOperatorTezgah(prisma: Prisma, dryRun: boolean) {
  banner('(f) IproOperatorTezgah — Personel ↔ İş Merkezi (numeric-core)', dryRun)

  const file = findFile(/Personel.*Merkezi.*E[şs]leme/i)
  const rows = readRows(file)
  const blueCollar = rows.filter((r) => String(clean(r['Kullanıcı Tipi Adı']) ?? '') === 'Blue Collar')
  if (blueCollar.length !== 521) {
    console.warn(`  ⚠️  Blue Collar beklenen 521, bulunan ${blueCollar.length} (DUR değil — devam)`)
  }

  // ── DB Personnel (mevcut tablo; dry-run'da da okunur) ──
  const personnel = await prisma.personnel.findMany({
    where: { sicilNo: { not: null } },
    select: { id: true, sicilNo: true, aktif: true },
  })

  // core → kayıt(lar); ÇAKIŞMA GEÇİDİ
  const dbByCore = new Map<string, { id: string; aktif: boolean; sicilNo: string }[]>()
  for (const p of personnel) {
    const c = numericCore(p.sicilNo!)
    if (!dbByCore.has(c)) dbByCore.set(c, [])
    dbByCore.get(c)!.push({ id: p.id, aktif: p.aktif, sicilNo: p.sicilNo! })
  }
  const collisions = [...dbByCore.entries()].filter(([, v]) => v.length > 1)
  if (collisions.length > 0) {
    const detay = collisions.slice(0, 20).map(([c, v]) => `core ${c} ← ${v.map((x) => x.sicilNo).join(', ')}`)
    throw new Error(`DB sicil core ÇAKIŞMASI (${collisions.length}) — eşleştirme güvensiz:\n     ${detay.join('\n     ')}`)
  }
  const dbCore = new Map([...dbByCore.entries()].map(([c, v]) => [c, v[0]] as const))

  // ── Kategorize et ──
  const systemAccounts: string[] = []   // (b) alfanumerik
  const notFound: string[] = []         // (c) DB'de yok
  const inactive: string[] = []         // (d) bulundu ama aktif:false
  const matchedActive = new Map<string, string>() // sicil → personnelId (e)

  for (const r of blueCollar) {
    const sicil = clean(r['Sicil No'])
    if (sicil === null) continue
    if (!/^\d+$/.test(sicil)) { systemAccounts.push(sicil); continue }
    const rec = dbCore.get(numericCore(sicil))
    if (!rec) { notFound.push(sicil); continue }
    if (rec.aktif === false) { inactive.push(`${sicil}→${rec.sicilNo}`); continue }
    matchedActive.set(sicil, rec.id)
  }

  // ── (personel, tezgahKod) ham çiftleri (yalnız eşleşen-aktif) ──
  const pairs: { personnelId: string; tezgahKod: string }[] = []
  const seen = new Set<string>()
  let rawTezgahRefs = 0
  for (const r of blueCollar) {
    const sicil = clean(r['Sicil No'])
    if (sicil === null) continue
    const personnelId = matchedActive.get(sicil)
    if (!personnelId) continue
    for (const tezgahKod of splitCodes(r['İş Merkezleri'])) {
      rawTezgahRefs++
      const key = `${personnelId}::${tezgahKod}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ personnelId, tezgahKod })
    }
  }

  // ── YAZMA (yalnız write modu): tezgah çözümü + filtre + batch ──
  let written = 0
  let resolvedPairs = 0
  const missingTezgah = new Set<string>()
  if (!dryRun) {
    const tezgahIdByKod = new Map(
      (await prisma.iproTezgah.findMany({ select: { id: true, kod: true } })).map((t) => [t.kod, t.id] as const),
    )
    const data: { personnelId: string; tezgahId: string; kaynak: string; aktif: boolean }[] = []
    for (const p of pairs) {
      const tezgahId = tezgahIdByKod.get(p.tezgahKod)
      if (!tezgahId) { missingTezgah.add(p.tezgahKod); continue }
      data.push({ personnelId: p.personnelId, tezgahId, kaynak: 'MAS_IMPORT', aktif: true })
    }
    resolvedPairs = data.length
    written = await createManyBatched(prisma.iproOperatorTezgah, data)
  }

  // ── Rapor (ayrı ayrı, tek sayıda toplamadan) ──
  summary([
    ['kaynak dosya', file.split('/').pop()],
    ['a) toplam Blue Collar satırı', `${blueCollar.length} (beklenen 521)`],
    ['b) sistem hesabı (alfanumerik) → atlandı', systemAccounts.length],
    ['c) DB\'de bulunamadı → atlandı', notFound.length],
    ['d) bulundu ama aktif:false → atlandı', inactive.length],
    ['e) EŞLEŞTİ ve aktif → yazılacak (kişi)', matchedActive.size],
    ['f) IproOperatorTezgah satırı', dryRun ? `${pairs.length} (ham çift; write\'ta tezgah çözülür)` : `${written} (çözülen ${resolvedPairs})`],
    ['   ham tezgah referansı', rawTezgahRefs],
    ['   atlanan tezgah kodu (tekil)', dryRun ? '(write modunda)' : `${missingTezgah.size}${missingTezgah.size ? ' → ' + [...missingTezgah].join(', ') : ''}`],
    ['DB core çakışması', `${collisions.length} (0 olmalı ✅)`],
  ])
  const list = (label: string, arr: string[], n = 40) => {
    if (!arr.length) return
    console.log(`  ── ${label} (${arr.length}) ──`)
    console.log('     ' + arr.slice(0, n).join(', ') + (arr.length > n ? ` … (+${arr.length - n})` : ''))
  }
  list('b) sistem hesapları', systemAccounts)
  list('c) DB\'de bulunamayan siciller', notFound)
  list('d) aktif:false (ayrılmış) atlananlar', inactive)

  return {
    blueCollar: blueCollar.length,
    systemAccounts: systemAccounts.length,
    notFound: notFound.length,
    inactive: inactive.length,
    matchedActive: matchedActive.size,
    rows: pairs.length,
  }
}

runCli('import-operator-tezgah', importOperatorTezgah)
