/**
 * (b) IproPlcPin — iki geçiş. import-plc ve import-tezgah ÖNCE koşmalı (write modunda).
 *
 * PASS 1 — PLC_Ayar_Listesi.xlsx → pin kayıtları (tezgahId YOK)
 *   'Açıklama' = inputPin ("I1.5"). 'Input No' KULLANILMAZ (hep 0, anlamsız).
 *   kod='Kod', sayac/reset/durus = ilgili kolonlar, plc='Plc Kodu'. Boş satır (Kod boş) atlanır.
 *   GEÇİT: 214 pin.
 *
 * PASS 2 — İş_Merkezi_PLC_Ayarları.xlsx → pin↔tezgah bağlama
 *   'Plc Ayarları Kodu'→pin.kod ; 'İş merkezi kodu'→tezgah.kod ; sayacTipi='Sayaç tipi kodu'.
 *   Tezgah:Pin 1:N — KH01 iki pine (212, 9) bağlı; İKİSİ DE yazılır, DEDUPE YOK.
 *   GEÇİT: 101 eşleme / 100 distinct tezgah.
 *
 * DRY-RUN tablo-bağımsız: geçitler Excel'den doğrulanır; ipro tablolarına yalnız yazma modunda erişilir.
 */
import { runCli, findFile, readRows, isEvet, clean, asInt, banner, summary, assertUniqueKeys, type Prisma } from './_lib'

export async function importPlcPin(prisma: Prisma, dryRun: boolean) {
  banner('(b) IproPlcPin — pin kayıtları + tezgah bağlama', dryRun)

  // ── PASS 1: pinler (Excel + geçit) ──
  const pinFile = findFile(/^PLC[ _]Ayar[ _]Listesi\.xlsx$/i)
  const pinRaw = readRows(pinFile)
    .filter((r) => clean(r['Kod']) !== null)
    .map((r) => {
      const sayac = asInt(r['Sayaç Adresi'])
      const reset = asInt(r['Reset Adresi'])
      const durus = asInt(r['Duruş Adresi'])
      if (sayac === null || reset === null || durus === null) {
        throw new Error(`Pin kod=${clean(r['Kod'])}: sayaç/reset/duruş adresi eksik`)
      }
      return {
        kod: asInt(r['Kod'])!,
        plcKod: String(clean(r['Plc Kodu'])),
        inputPin: String(clean(r['Açıklama']) ?? ''),
        sayacAdresi: sayac,
        resetAdresi: reset,
        durusAdresi: durus,
        aktif: isEvet(r['Aktif']),
      }
    })
  assertUniqueKeys(pinRaw, (r) => String(r.kod), 'IproPlcPin.kod', (r) => `kod ${r.kod}: ${r.inputPin} sayac=${r.sayacAdresi} (PLC ${r.plcKod})`)
  if (pinRaw.length !== 214) {
    throw new Error(`Beklenen 214 pin, bulunan ${pinRaw.length} (boş satırlar filtrelendi mi?)`)
  }

  let pinWritten = 0
  if (!dryRun) {
    const plcIdByKod = new Map(
      (await prisma.iproPlc.findMany({ select: { id: true, kod: true } })).map((p) => [p.kod, p.id] as const),
    )
    for (const p of pinRaw) {
      const plcId = plcIdByKod.get(p.plcKod)
      if (!plcId) throw new Error(`Pin kod=${p.kod}: PLC "${p.plcKod}" IproPlc'te yok (önce import-plc)`)
      const data = {
        plcId,
        inputPin: p.inputPin,
        sayacAdresi: p.sayacAdresi,
        resetAdresi: p.resetAdresi,
        durusAdresi: p.durusAdresi,
        aktif: p.aktif,
      }
      await prisma.iproPlcPin.upsert({ where: { kod: p.kod }, create: { kod: p.kod, ...data }, update: data })
      pinWritten++
    }
  }

  // ── PASS 2: pin ↔ tezgah bağlama (Excel + geçit) ──
  const linkFile = findFile(/Merkezi[ _]PLC[ _]Ayarlar/i)
  const linkRaw = readRows(linkFile)
    .filter((r) => clean(r['Plc Ayarları Kodu']) !== null && clean(r['İş merkezi kodu']) !== null)
    .map((r) => ({
      pinKod: asInt(r['Plc Ayarları Kodu'])!,
      tezgahKod: String(clean(r['İş merkezi kodu'])),
      sayacTipi: clean(r['Sayaç tipi kodu']) ?? 'CTCounter',
    }))
  const distinctTezgah = new Set(linkRaw.map((l) => l.tezgahKod)).size
  if (linkRaw.length !== 101 || distinctTezgah !== 100) {
    throw new Error(`Beklenen 101 eşleme / 100 tezgah, bulunan ${linkRaw.length} eşleme / ${distinctTezgah} tezgah`)
  }

  let linkWritten = 0
  if (!dryRun) {
    const pinKods = new Set(pinRaw.map((p) => p.kod))
    const tezgahIdByKod = new Map(
      (await prisma.iproTezgah.findMany({ select: { id: true, kod: true } })).map((t) => [t.kod, t.id] as const),
    )
    for (const l of linkRaw) {
      if (!pinKods.has(l.pinKod)) throw new Error(`Eşleme: pin kod=${l.pinKod} pin listesinde yok`)
      const tezgahId = tezgahIdByKod.get(l.tezgahKod)
      if (!tezgahId) throw new Error(`Eşleme: tezgah "${l.tezgahKod}" IproTezgah'ta yok (önce import-tezgah)`)
      // 1:N — her pin ayrı satır; KH01'in iki pini (212, 9) de bağlanır.
      await prisma.iproPlcPin.update({ where: { kod: l.pinKod }, data: { tezgahId, sayacTipi: l.sayacTipi } })
      linkWritten++
    }
  }

  const kh01 = linkRaw.filter((l) => l.tezgahKod === 'KH01').map((l) => l.pinKod)
  summary([
    ['pin kaynak dosya', pinFile.split('/').pop()],
    ['eşleme kaynak dosya', linkFile.split('/').pop()],
    ['beklenen / bulunan pin', `214 / ${pinRaw.length}`],
    ['pin yazılan', dryRun ? '0 (dry-run)' : pinWritten],
    ['beklenen / bulunan eşleme', `101/100 / ${linkRaw.length}/${distinctTezgah}`],
    ['KH01 pinleri (1:N)', kh01.join(', ')],
    ['eşleme yazılan', dryRun ? '0 (dry-run)' : linkWritten],
  ])
  return { pins: pinRaw.length, links: linkRaw.length, distinctTezgah }
}

runCli('import-plc-pin', importPlcPin)
