/**
 * EL-5e — Kontrollü rezerve→çıkış testi. İş emri 147 / komponent 8001 / toplam 2 adet.
 * İKİ yazma: ShopMaterialAlloc_Reserve + IssueMaterial. Başka yazma YOK.
 * Her adımda 2xx değilse tam gövde yazılır ve DURULUR (otomatik varyant yok).
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/test-issue-material.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => { const v = process.env[k]; if (req && (!v || !v.trim())) throw new Error(`eksik: ${k}`); return v ?? '' }
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET'), SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const MAIN = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
const SO = `${MAIN}ShopOrderHandling.svc/`
const IPS = `${MAIN}InventoryPartInStockHandling.svc/`

const ORDER = { OrderNo: '147', ReleaseNo: '*', SequenceNo: '*' }
const LINE = 1
const soKey = `OrderNo='${ORDER.OrderNo}',ReleaseNo='${ORDER.ReleaseNo}',SequenceNo='${ORDER.SequenceNo}'`
const allocKey = `OrderNo='${ORDER.OrderNo}',ReleaseNo='${ORDER.ReleaseNo}',SequenceNo='${ORDER.SequenceNo}',LineItemNo=${LINE}`

let tok: { t: string; e: number } | null = null
async function token() {
  if (tok && tok.e - 60_000 > Date.now()) return tok.t
  const b = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
  if (SCOPE) b.set('scope', SCOPE)
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: b })
  const j = (await r.json()) as { access_token?: string; expires_in?: number }
  tok = { t: j.access_token!, e: Date.now() + (j.expires_in ?? 300) * 1000 }
  return tok.t
}
async function getJson(u: string) {
  const r = await fetch(MAIN + u, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } })
  const t = await r.text(); let j: unknown = null; try { j = t ? JSON.parse(t) : null } catch { /* */ }
  return { status: r.status, rows: (((j as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[]), one: j as Record<string, unknown> }
}
async function post(u: string, body: unknown, ifMatch?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'wait=99999' }
  if (ifMatch) headers['If-Match'] = ifMatch
  const r = await fetch(MAIN + u, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: r.status, statusText: r.statusText, text: await r.text() }
}
/** Entity'nin güncel ETag'ini GET ile çeker (bound yazma öncesi taze). */
async function etagOf(u: string): Promise<string | null> {
  const r = await fetch(MAIN + u, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } })
  const et = r.headers.get('etag')
  if (et) return et
  const j = await r.json().catch(() => null)
  return (j && (j as Record<string, unknown>)['@odata.etag']) as string | null
}

async function matLine() {
  const m = await getJson(`ShopOrderHandling.svc/ShopOrds(${encodeURI(soKey)})/MaterialArray?$top=50`)
  return m.rows.find((x) => String(x.PartNo) === '8001')
}
async function stok8001() {
  const f = encodeURIComponent(`Contract eq '${CONTRACT}' and PartNo eq '8001'`)
  const r = await getJson(`InventoryPartInStockHandling.svc/InventoryPartInStockSet?$filter=${f}&$select=LocationNo,LotBatchNo,QtyOnhand,QtyReserved&$top=20`)
  return r.rows
}
function printMat(l: Record<string, unknown> | undefined, tag: string) {
  if (!l) { console.log(`  ${tag}: (satır yok)`); return }
  console.log(`  ${tag}: QtyRequired=${l.QtyRequired} QtyAssigned=${l.QtyAssigned} QtyIssued=${l.QtyIssued} QtyRemainToIssue=${l.QtyRemainToIssue}`)
}
function printStok(rows: Record<string, unknown>[], tag: string) {
  console.log(`  ${tag}:`)
  rows.filter((r) => ['61', '64'].includes(String(r.LocationNo))).forEach((r) => console.log(`    Loc=${r.LocationNo} onhand=${r.QtyOnhand} reserved=${r.QtyReserved}`))
}

async function main() {
  console.log('═'.repeat(80)); console.log('EL-5e — 147/8001 Reserve→Issue (2 adet)'); console.log('═'.repeat(80))

  // AŞAMA 1 — ÖNCE
  console.log('\n[AŞAMA 1] ÖNCE:')
  const l0 = await matLine(); printMat(l0, 'MaterialArray 8001')
  const s0 = await stok8001(); printStok(s0, 'InventoryPartInStock 8001')

  // AŞAMA 2 — Reserve
  console.log('\n[AŞAMA 2] Reserve (ShopMaterialAlloc_Reserve, gövde {}):')
  const allocEntity = `ShopOrderHandling.svc/ShopOrds(${encodeURI(soKey)})/MaterialArray(${encodeURI(allocKey)})`
  const etag = await etagOf(allocEntity)
  console.log('  taze ETag:', etag)
  const rUrl = `${allocEntity}/IfsApp.ShopOrderHandling.ShopMaterialAlloc_Reserve`
  console.log('  POST', rUrl.replace('ShopOrderHandling.svc', 'SO'), '(If-Match: <ETag>)')
  const rr = await post(rUrl, {}, etag ?? '*')
  console.log(`  → HTTP ${rr.status} ${rr.statusText}`)
  if (rr.text) console.log('  ', rr.text.slice(0, 300))
  if (rr.status < 200 || rr.status >= 300) { console.log('\n❌ Reserve başarısız. DUR.'); return }

  console.log('\n  Reserve SONRASI:')
  const l1 = await matLine(); printMat(l1, 'MaterialArray 8001')
  const s1 = await stok8001(); printStok(s1, 'InventoryPartInStock 8001')
  const rezArtan = s1.filter((r) => {
    const b = s0.find((x) => String(x.LocationNo) === String(r.LocationNo))
    return Number(r.QtyReserved) > Number(b?.QtyReserved ?? 0)
  }).map((r) => `${r.LocationNo} (+${Number(r.QtyReserved) - Number(s0.find((x) => String(x.LocationNo) === String(r.LocationNo))?.QtyReserved ?? 0)})`)
  console.log(`  → IFS'in rezerve için seçtiği lokasyon(lar): ${rezArtan.join(', ') || '(QtyReserved değişimi görülmedi)'}`)

  // AŞAMA 3 — Issue
  console.log('\n[AŞAMA 3] IssueMaterial (Selection = keyref;  IssueOnlyReserved=1):')
  const selection = `LINE_ITEM_NO=${LINE}^ORDER_NO=${ORDER.OrderNo}^RELEASE_NO=${ORDER.ReleaseNo}^SEQUENCE_NO=${ORDER.SequenceNo}^;`
  console.log('  Selection =', JSON.stringify(selection))
  const iUrl = `ShopOrderHandling.svc/IssueMaterial`
  const ir = await post(iUrl, { Selection: selection, IssueOnlyReserved: 1 })
  console.log(`  → HTTP ${ir.status} ${ir.statusText}`)
  if (ir.text) console.log('  ', ir.text.slice(0, 400))
  if (ir.status < 200 || ir.status >= 300) { console.log('\n❌ Issue başarısız. DUR. (Selection formatı doğrulanmalı — otomatik varyant YOK)'); return }

  console.log('\n  Issue SONRASI:')
  const l2 = await matLine(); printMat(l2, 'MaterialArray 8001')
  const s2 = await stok8001(); printStok(s2, 'InventoryPartInStock 8001')
  console.log('\n✅ Test tamam.')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
