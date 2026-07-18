/**
 * EL-5c — Çıkış zinciri VERİ doğrulaması (ShopOrderHandling grant sonrası).
 * SALT OKUMA (GET/metadata). Issue/Reserve YOK.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-issue-data.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => { const v = process.env[k]; if (req && (!v || !v.trim())) throw new Error(`eksik: ${k}`); return v ?? '' }
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET'), SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const MAIN = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
const SO = `${MAIN}ShopOrderHandling.svc/`

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
async function get(url: string, accept = 'application/json') {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await token()}`, Accept: accept } })
  const text = await r.text()
  let body: unknown = text
  try { body = text ? JSON.parse(text) : null } catch { /* xml */ }
  return { status: r.status, body, text }
}
const rows = (b: unknown) => (((b as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[])
const snip = (b: unknown, n = 180) => (typeof b === 'string' ? b : JSON.stringify(b)).replace(/\s+/g, ' ').slice(0, n)

async function malzemeSatirlari(so: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  // ShopOrd anahtarı Contract İÇERMEZ (OrderNo/ReleaseNo/SequenceNo).
  const key = `OrderNo='${so.OrderNo}',ReleaseNo='${so.ReleaseNo}',SequenceNo='${so.SequenceNo}'`
  const mat = await get(`${SO}ShopOrds(${encodeURI(key)})/MaterialArray?$top=50`)
  console.log(`\n2) ShopOrds(${so.OrderNo})/MaterialArray → HTTP ${mat.status}`)
  if (mat.status !== 200) { console.log('   ', snip(mat.body)); return [] }
  const ms = rows(mat.body)
  console.log(`   malzeme satırı: ${ms.length}`)
  console.log('   LineItemNo | PartNo | PartDescription | QtyRequired | QtyIssued | QtyRemainToIssue | LotBatchOrigin')
  ms.forEach((m) => console.log(`   ${m.LineItemNo} | ${m.PartNo} | ${String(m.PartDescription ?? '').slice(0, 20)} | ${m.QtyRequired} | ${m.QtyIssued} | ${m.QtyRemainToIssue ?? '·'} | ${m.LotBatchOrigin ?? '·'}`))
  return ms
}

async function main() {
  // 1) ShopOrds 150 (boşsa 143)
  console.log('═'.repeat(80)); console.log('1) ShopOrds başlık'); console.log('═'.repeat(80))
  let so: Record<string, unknown> | undefined
  for (const orderNo of ['150', '143']) {
    const q = await get(`${SO}ShopOrds?$filter=${encodeURIComponent(`Contract eq '${CONTRACT}' and OrderNo eq '${orderNo}'`)}&$top=1`)
    console.log(`\nShopOrds(OrderNo=${orderNo}) → HTTP ${q.status}`)
    if (q.status !== 200) { console.log('   ', snip(q.body)); continue }
    const r = rows(q.body)[0]
    if (!r) { console.log('   (kayıt yok)'); continue }
    console.log(`   anahtar: OrderNo=${r.OrderNo} ReleaseNo=${r.ReleaseNo} SequenceNo=${r.SequenceNo}`)
    console.log(`   başlık: PartNo=${r.PartNo} RevisedQtyDue=${r.RevisedQtyDue} durum=${r.Objstate ?? r.ObjState ?? r.RowState ?? '·'}`)
    so = r
    // 2) malzeme satırları — doluysa bu iş emrini kullan
    const ms = await malzemeSatirlari(r)
    if (ms.length) { ;(so as Record<string, unknown>).__mat = ms; break }
  }
  if (!so) { console.log('\n❌ Okunabilir iş emri yok. Dur.'); return }
  const mats = ((so.__mat ?? []) as Record<string, unknown>[])

  // 3) GetIssueOperations
  console.log(`\n${'═'.repeat(80)}`); console.log('3) GetIssueOperations vs MaterialArray'); console.log('═'.repeat(80))
  const gio = `${SO}GetIssueOperations(OrderNo='${so.OrderNo}',ReleaseNo='${so.ReleaseNo}',SequenceNo='${so.SequenceNo}',Selection='')`
  const g = await get(encodeURI(gio))
  console.log(`GetIssueOperations(${so.OrderNo}) → HTTP ${g.status}`)
  if (g.status === 200) {
    const gr = rows(g.body)
    console.log(`   dönen satır: ${gr.length} (MaterialArray: ${mats.length})`)
    gr.slice(0, 10).forEach((m) => console.log(`   Line ${m.LineItemNo} PartNo=${m.PartNo} QtyRemainToIssue=${m.QtyRemainToIssue ?? '·'} reserved=${m.QtyReserved ?? '·'}`))
  } else console.log('   ', snip(g.body, 200))

  // 4) FIFO — bir malzeme parçası için ReceiptDate artan stok
  console.log(`\n${'═'.repeat(80)}`); console.log('4) FIFO önerisi (ReceiptDate artan)'); console.log('═'.repeat(80))
  const pn = mats.map((m) => String(m.PartNo)).find(Boolean) ?? '8034'
  const ips = await get(`${MAIN}InventoryPartInStockHandling.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(`Contract eq '${CONTRACT}' and PartNo eq '${pn}'`)}&$select=PartNo,LocationNo,LotBatchNo,QtyOnhand,QtyReserved,ReceiptDate&$top=50`)
  console.log(`PartNo=${pn} stok → HTTP ${ips.status}`)
  if (ips.status === 200) {
    const st = rows(ips.body).sort((a, b) => String(a.ReceiptDate).localeCompare(String(b.ReceiptDate)))
    console.log('   sıra | LocationNo | Lot | Onhand | ReceiptDate')
    st.slice(0, 8).forEach((r, i) => console.log(`   ${i === 0 ? '★1' : ' ' + (i + 1)} | ${r.LocationNo} | ${r.LotBatchNo} | ${r.QtyOnhand} | ${r.ReceiptDate}`))
    if (st[0]) console.log(`   → FIFO ÖNERİSİ: Loc=${st[0].LocationNo} Lot=${st[0].LotBatchNo} (ReceiptDate ${String(st[0].ReceiptDate).slice(0, 10)})`)
  } else console.log('   ', snip(ips.body, 140))

  // 5) ShopMaterialAlloc → ReservedLotBatch / ShopMaterialAssign nav yolu
  console.log(`\n${'═'.repeat(80)}`); console.log('5) Rezervasyon kırılımı nav yolu'); console.log('═'.repeat(80))
  const md = (await get(`${SO}$metadata`, 'application/xml')).text
  const blk = /<EntityType\s+Name="ShopMaterialAlloc"[^>]*>([\s\S]*?)<\/EntityType>/.exec(md)
  if (blk) {
    const navs = [...blk[1].matchAll(/<NavigationProperty\s+Name="([^"]+)"\s+Type="([^"]+)"/g)]
      .map((m) => ({ name: m[1], type: m[2].replace(/^Collection\(|\)$/g, '').split('.').pop()! }))
      .filter((n) => /Reserv|Assign|LotBatch/i.test(n.name) || /Reserv|Assign|LotBatch/i.test(n.type))
    console.log('   ShopMaterialAlloc rezervasyon nav:')
    navs.forEach((n) => console.log(`     ${n.name} → ${n.type}`))
    const rn = navs.find((n) => /Reserv|LotBatch/i.test(n.name))?.name
    if (rn) console.log(`   → yol: ShopOrds(<key>)/MaterialArray(<allocKey>)/${rn}`)
    if (!navs.length) console.log('     (ShopMaterialAlloc üzerinde rezervasyon nav yok — kırılım InventoryPartInStock.QtyReserved / ReservedLotBatch set üzerinden)')
  }

  console.log('\n✅ Tamam (salt okuma, Issue/Reserve çağrılmadı).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
