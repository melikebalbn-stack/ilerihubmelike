/**
 * EL-3c Adım 1 — bound Update doğrulama: 1 adet 8034 (lot 1), 40 → 61 (dolu hedef).
 * IFS TEST'te TEK gerçek taşıma. Hata olursa tam yanıt + DUR (varyant yok).
 *   NODE_EXTRA_CA_CERTS=... npx tsx scripts/test-move-update.ts
 */
import 'dotenv/config'

const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const MAIN = process.env.IFS_INT_BASE_URL!.replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
const esc = (v: string) => v.replace(/'/g, "''")
let TOK = ''
async function token() {
  const b = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.IFS_CLIENT_ID!, client_secret: process.env.IFS_CLIENT_SECRET! })
  if (process.env.IFS_SCOPE) b.set('scope', process.env.IFS_SCOPE)
  const r = await fetch(process.env.IFS_TOKEN_URL!, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: b })
  return (await r.json()).access_token as string
}
async function stokOf(loc: string): Promise<Record<string, unknown>[]> {
  const f = encodeURIComponent(`Contract eq '${CONTRACT}' and LocationNo eq '${esc(loc)}'`)
  const r = await fetch(`${MAIN}MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${f}&$top=200`, { headers: { Authorization: `Bearer ${TOK}`, Accept: 'application/json' } })
  return (((await r.json()) as { value?: unknown[] }).value ?? []) as Record<string, unknown>[]
}
function tablo(t: string, rows: Record<string, unknown>[]) {
  console.log(`\n── ${t} (${rows.length}) ──`)
  const cols = ['PartNo', 'LotBatchNo', 'SerialNo', 'ConfigurationId', 'EngChgLevel', 'WaivDevRejNo', 'ActivitySeq', 'HandlingUnitId', 'QtyOnhand', 'AvailableQtyToMove']
  console.log('  ' + cols.join(' | '))
  rows.forEach((r) => console.log('  ' + cols.map((c) => String(r[c] ?? '·')).join(' | ')))
}

async function main() {
  TOK = await token()
  console.log('═'.repeat(80))
  console.log('EL-3c Adım 1 — bound Update: 1 adet 8034 (lot 1), 40 → 61 (dolu)')
  console.log('═'.repeat(80))

  const once40 = await stokOf('40')
  const once61 = await stokOf('61')
  tablo('ÖNCE — 40 (kaynak)', once40)
  tablo('ÖNCE — 61 (hedef, dolu)', once61)

  const src = once40.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  const dest = once61.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  if (!src) { console.log('\n❌ 40\'ta 8034/lot1 yok. Dur.'); return }
  if (!dest) { console.log('\n❌ 61\'de 8034/lot1 yok — Update için mevcut satır beklenirdi. Dur.'); return }

  // Named key predicate (sıra önemsiz). Kaynak: InventoryPartInStock; hedef: NewPartLocArray üyesi.
  const kv = (r: Record<string, unknown>) => [
    `Contract='${esc(String(r.Contract))}'`,
    `PartNo='${esc(String(r.PartNo))}'`,
    `ConfigurationId='${esc(String(r.ConfigurationId))}'`,
    `LocationNo='${esc(String(r.LocationNo))}'`,
    `LotBatchNo='${esc(String(r.LotBatchNo))}'`,
    `SerialNo='${esc(String(r.SerialNo))}'`,
    `EngChgLevel='${esc(String(r.EngChgLevel))}'`,
    `WaivDevRejNo='${esc(String(r.WaivDevRejNo))}'`,
    `ActivitySeq=${Number(r.ActivitySeq)}`,
    `HandlingUnitId=${Number(r.HandlingUnitId)}`,
  ].join(',')
  const action = 'IfsApp.MoveInventoryPart.InventoryPartInStockDelivery_UpdateInventoryPartInStockDelivery'
  const url =
    `${MAIN}MoveInventoryPart.svc/InventoryPartInStockSet(${encodeURI(kv(src))})` +
    `/NewPartLocArray(${encodeURI(kv(dest))})/${action}`
  const body = {
    ParentLocationNo: '40',
    ParentContract: 'ILER2',
    ParentWaivDevRejNo: '*',
    Destination: 'MoveToInventory',
    QuantityMoved: 1,
    ConsumeStock: 'N',
  }
  console.log('\nPOST', url.replace(MAIN, '.../'))
  console.log('Body:', JSON.stringify(body))

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'wait=99999' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`\nHTTP ${res.status} ${res.statusText}`)
  console.log(text || '(boş gövde)')

  if (!(res.status >= 200 && res.status < 300)) {
    console.log('\n❌ Başarısız. Otomatik varyant YOK — dur.')
    return
  }

  console.log('\n✅ SONRA:')
  const s40 = await stokOf('40')
  const s61 = await stokOf('61')
  tablo('SONRA — 40', s40)
  tablo('SONRA — 61', s61)
  const a40 = s40.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  const a61 = s61.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  console.log('\n── FARK ──')
  console.log(`  40/8034/lot1 Avail: ${dest ? once40.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')?.AvailableQtyToMove : '?'} → ${a40?.AvailableQtyToMove}`)
  console.log(`  61/8034/lot1 QtyOnhand: ${dest.QtyOnhand} → ${a61?.QtyOnhand} (satır sayısı korunmalı: ${once61.filter((r) => String(r.PartNo) === '8034').length} → ${s61.filter((r) => String(r.PartNo) === '8034').length})`)
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
