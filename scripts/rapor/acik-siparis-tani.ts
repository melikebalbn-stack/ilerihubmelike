/**
 * Açık Sipariş raporu 0 satır dönünce: hangi süzgeç maddesinin satırları kestiğini ÖLÇER.
 *   npx tsx scripts/rapor/acik-siparis-tani.ts ILER2 2026-09-01 2026-10-10
 *
 * Süzgeci parça parça kurup her adımda satır sayısını yazar; ilk sıfırlanan adım
 * suçludur. Hiçbir şey yazmaz, yalnız okur.
 *
 * SUNUCUDA, uygulamanın IFS ortamıyla çalışır:
 *   set -a; . ~/projects/ilerihub/.env; . ~/projects/ilerihub/.env.local; set +a
 *   export NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem
 */
import 'dotenv/config'
import { istek } from '../../src/lib/ifs/personel-sync/ifs-api'

const PROJEKSIYON = 'CustomerOrderHandling'
const ENTITY_SET = 'CustomerOrderLineSet'

const [site, basStr, bitStr] = process.argv.slice(2)
if (!site || !basStr || !bitStr) {
  console.error('Kullanım: npx tsx scripts/rapor/acik-siparis-tani.ts <SITE> <BASLANGIC> <BITIS>')
  console.error('Örnek:    npx tsx scripts/rapor/acik-siparis-tani.ts ILER2 2026-09-01 2026-10-10')
  process.exit(1)
}
const bas = new Date(`${basStr}T00:00:00.000Z`).toISOString()
const bit = new Date(`${bitStr}T23:59:59.000Z`).toISOString()
const S = `'${site.replace(/'/g, "''")}'`

const ADIMLAR: { ad: string; filtre: string }[] = [
  { ad: '1. yalnız site', filtre: `Contract eq ${S}` },
  { ad: '2. + QtyToShip > 0', filtre: `Contract eq ${S} and QtyToShip gt 0` },
  { ad: '3. + PlannedDueDate aralığı', filtre: `Contract eq ${S} and QtyToShip gt 0 and PlannedDueDate ge ${bas} and PlannedDueDate le ${bit}` },
  { ad: '4. + PromisedDeliveryDate aralığı', filtre: `Contract eq ${S} and QtyToShip gt 0 and PromisedDeliveryDate ge ${bas} and PromisedDeliveryDate le ${bit}` },
  { ad: '5. + WantedDeliveryDate aralığı', filtre: `Contract eq ${S} and QtyToShip gt 0 and WantedDeliveryDate ge ${bas} and WantedDeliveryDate le ${bit}` },
  { ad: '6. + PlannedDeliveryDate aralığı', filtre: `Contract eq ${S} and QtyToShip gt 0 and PlannedDeliveryDate ge ${bas} and PlannedDeliveryDate le ${bit}` },
]

const SELECT = [
  'OrderNo', 'LineNo', 'Contract', 'CatalogNo', 'Objstate',
  'RevisedQtyDue', 'QtyShipped', 'QtyToShip',
  'PlannedDueDate', 'PromisedDeliveryDate', 'WantedDeliveryDate', 'PlannedDeliveryDate',
].join(',')

type Sayfa = { value?: Record<string, unknown>[] }

async function say(filtre: string): Promise<{ n: number; ornek?: Record<string, unknown>; hata?: string }> {
  const yol = `${PROJEKSIYON}.svc/${ENTITY_SET}?$select=${SELECT}&$filter=${encodeURIComponent(filtre)}&$top=50`
  try {
    const cevap = await istek<Sayfa>(yol)
    const satirlar = cevap.body.value ?? []
    return { n: satirlar.length, ornek: satirlar[0] }
  } catch (e) {
    const h = e as Error & { cause?: unknown }
    return { n: -1, hata: `${h.message}${h.cause instanceof Error ? ` · ${h.cause.message}` : ''}` }
  }
}

async function main() {
  console.log(`Site=${site}  aralık=${basStr} … ${bitStr}  (her adım $top=50)\n`)
  let ilkOrnek: Record<string, unknown> | undefined
  for (const a of ADIMLAR) {
    const r = await say(a.filtre)
    if (r.n < 0) console.log(`  ${a.ad.padEnd(36)} HATA — ${r.hata}`)
    else console.log(`  ${a.ad.padEnd(36)} ${r.n} satır`)
    if (!ilkOrnek && r.ornek) ilkOrnek = r.ornek
  }

  if (ilkOrnek) {
    console.log('\nÖrnek satır (ilk dolu adımdan) — tarih alanlarının hangisi dolu, ona bakın:')
    for (const [k, v] of Object.entries(ilkOrnek)) console.log(`  ${k.padEnd(24)} ${v === null ? '(boş)' : String(v)}`)
  } else {
    console.log('\nHiçbir adım satır döndürmedi — site adı ya da projeksiyon/entitySet yanlış olabilir.')
  }

  // Durum dağılımı: Syteline stat in ('O','P') karşılığını seçebilmek için.
  const d = await say(`Contract eq ${S} and QtyToShip gt 0`)
  if (d.n > 0) {
    const yol = `${PROJEKSIYON}.svc/${ENTITY_SET}?$select=Objstate&$filter=${encodeURIComponent(`Contract eq ${S} and QtyToShip gt 0`)}&$top=500`
    const cevap = await istek<Sayfa>(yol)
    const sayac = new Map<string, number>()
    for (const s of cevap.body.value ?? []) {
      const k = String(s.Objstate ?? '(boş)')
      sayac.set(k, (sayac.get(k) ?? 0) + 1)
    }
    console.log('\nAçık satırların durum dağılımı (ilk 500):')
    for (const [k, n] of [...sayac].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${n}`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
