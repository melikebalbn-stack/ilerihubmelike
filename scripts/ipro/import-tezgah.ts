/**
 * (c) IproTezgah — kimlik: kod = IFS ResourceId = MAS iş merkezi kodu
 *
 * Kaynak (UNION):
 *   DowntimeWorkCenterMatchListReport  → 200 distinct iş merkezi (ad + grup)
 *   İş_Merkezi_PLC_Ayarları            → +3 ek (KH14, KH15, KH27): PLC sayacı var
 *                                         ama hiçbir duruşa bağlı değil. masGrup null.
 *   = 203 tezgah
 *
 * ifsWorkCenterNo şimdilik null (IFS senkronunda dolacak).
 * GEÇİT: tam 203 tezgah beklenir, yoksa DUR.
 */
import { runCli, findFile, readRows, clean, banner, summary, assertUniqueKeys, type Prisma } from './_lib'

type TezgahRow = { kod: string; ad: string; masGrupKodu: string | null; masGrupAdi: string | null }

export async function importTezgah(prisma: Prisma, dryRun: boolean) {
  banner('(c) IproTezgah — Downtime ∪ İş Merkezi PLC Ayarları', dryRun)

  const dtFile = findFile(/Downtime.*MatchList/i)
  const paFile = findFile(/Merkezi[ _]PLC[ _]Ayarlar/i)

  const map = new Map<string, TezgahRow>()

  // 1) Downtime raporundan (en zengin): kod -> ad + grup (ilk dolu kayıt)
  for (const r of readRows(dtFile)) {
    const kod = clean(r['İş Merkezi Kodu'])
    if (kod === null) continue
    if (!map.has(kod)) {
      map.set(kod, {
        kod,
        ad: clean(r['İş Merkezi']) ?? kod,
        masGrupKodu: clean(r['İş Merkezi Grubu Kodu']),
        masGrupAdi: clean(r['İş Merkezi Grubu']),
      })
    }
  }
  const fromDowntime = map.size

  // 2) İş Merkezi PLC Ayarları'ndan Downtime'da OLMAYAN ek tezgahlar (masGrup null)
  const extras: string[] = []
  for (const r of readRows(paFile)) {
    const kod = clean(r['İş merkezi kodu'])
    if (kod === null) continue
    if (!map.has(kod)) {
      map.set(kod, { kod, ad: clean(r['İş merkezi']) ?? kod, masGrupKodu: null, masGrupAdi: null })
      extras.push(kod)
    }
  }

  const records = [...map.values()]
  // Union Map zaten kod'a göre tekil; yine de @unique güvencesi (defensive).
  assertUniqueKeys(records, (r) => r.kod, 'IproTezgah.kod', (r) => `${r.kod}: ${r.ad}`)
  if (records.length !== 203) {
    throw new Error(`Beklenen 203 tezgah, bulunan ${records.length} (Downtime=${fromDowntime}, ek=${extras.length}) — kaynak değişmiş olabilir`)
  }

  let written = 0
  if (!dryRun) {
    for (const t of records) {
      await prisma.iproTezgah.upsert({
        where: { kod: t.kod },
        create: {
          kod: t.kod,
          ad: t.ad,
          ifsWorkCenterNo: null,
          masGrupKodu: t.masGrupKodu,
          masGrupAdi: t.masGrupAdi,
          aktif: true,
        },
        update: { ad: t.ad, masGrupKodu: t.masGrupKodu, masGrupAdi: t.masGrupAdi },
      })
      written++
    }
  }

  summary([
    ['Downtime kaynak dosya', dtFile.split('/').pop()],
    ['PLC Ayarları kaynak dosya', paFile.split('/').pop()],
    ['Downtime distinct tezgah', fromDowntime],
    ['ek (PLC Ayarları, masGrup=null)', `${extras.length} → ${extras.join(', ')}`],
    ['beklenen toplam', 203],
    ['bulunan toplam', records.length],
    ['yazılan', dryRun ? '0 (dry-run)' : written],
  ])
  return { expected: 203, actual: records.length, extras }
}

runCli('import-tezgah', importTezgah)
