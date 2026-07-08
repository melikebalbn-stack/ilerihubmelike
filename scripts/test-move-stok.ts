/**
 * EL-3c — moveStok KONTROLLÜ GERÇEK TEST (Aurena-doğrulanmış gövde).
 *
 * ⚠️ IFS TEST ortamında TEK (1) gerçek taşıma: PartNo 8034, lot '1', 40 → 61, 1 adet.
 * Başka yazma yok. Düz POST başarısızsa SADECE o durumda $batch (multipart) denenir.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/test-move-stok.ts
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
async function stokOf(locationNo: string): Promise<Record<string, unknown>[]> {
  const f = encodeURIComponent(`Contract eq '${CONTRACT}' and LocationNo eq '${esc(locationNo)}'`)
  const r = await fetch(`${MAIN}MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${f}&$top=200`, { headers: { Authorization: `Bearer ${TOK}`, Accept: 'application/json' } })
  return (((await r.json()) as { value?: unknown[] }).value ?? []) as Record<string, unknown>[]
}
function tablo(baslik: string, rows: Record<string, unknown>[]) {
  console.log(`\n── ${baslik} (${rows.length} kayıt) ──`)
  const cols = ['PartNo', 'LotBatchNo', 'SerialNo', 'ConfigurationId', 'EngChgLevel', 'WaivDevRejNo', 'ActivitySeq', 'HandlingUnitId', 'QtyOnhand', 'AvailableQtyToMove']
  console.log('  ' + cols.join(' | '))
  for (const r of rows) console.log('  ' + cols.map((c) => String(r[c] ?? '·')).join(' | '))
}

async function plainPost(body: unknown) {
  const r = await fetch(`${MAIN}MoveInventoryPart.svc/CreateInventoryPartInStockDelivery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'wait=99999' },
    body: JSON.stringify(body),
  })
  return { status: r.status, statusText: r.statusText, text: await r.text() }
}

async function batchPost(body: unknown) {
  const B = 'batch_el3c', C = 'cs_el3c'
  const lines = [
    `--${B}`,
    `Content-Type: multipart/mixed; boundary=${C}`,
    '',
    `--${C}`,
    'Content-Type: application/http',
    'Content-Transfer-Encoding: binary',
    'Content-ID: 1',
    '',
    'POST CreateInventoryPartInStockDelivery HTTP/1.1',
    'Content-Type: application/json',
    'Accept: application/json',
    '',
    JSON.stringify(body),
    `--${C}--`,
    `--${B}--`,
    '',
  ]
  const r = await fetch(`${MAIN}MoveInventoryPart.svc/$batch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': `multipart/mixed; boundary=${B}`, Accept: 'application/json' },
    body: lines.join('\r\n'),
  })
  return { status: r.status, statusText: r.statusText, text: await r.text() }
}

async function main() {
  TOK = await token()
  console.log('═'.repeat(80))
  console.log('EL-3c AŞAMA 1 — Create boş hedefe: 1 adet 8034 (lot 1), 40 → boş raf')
  console.log('═'.repeat(80))

  // Boş hedef seç: 64, 8034/lot1 varsa 67
  let HEDEF = ''
  for (const cand of ['64', '67']) {
    const rows = await stokOf(cand)
    const has = rows.some((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
    console.log(`  hedef aday ${cand}: 8034/lot1 ${has ? 'VAR' : 'YOK'}`)
    if (!has) { HEDEF = cand; break }
  }
  if (!HEDEF) { console.log('\n❌ Boş hedef (64/67) bulunamadı. Dur.'); return }
  console.log(`  → seçilen HEDEF: ${HEDEF}`)

  const once40 = await stokOf('40')
  const once61 = await stokOf(HEDEF)
  tablo('ÖNCE — LocationNo=40 (kaynak)', once40)
  tablo(`ÖNCE — LocationNo=${HEDEF} (hedef)`, once61)

  const src = once40.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  if (!src) { console.log('\n❌ Kaynak kayıt yok (40/8034/lot 1). Dur.'); return }
  const body = {
    Contract: src.Contract,
    PartNo: src.PartNo,
    ConfigurationId: src.ConfigurationId,
    LocationNo: HEDEF, // HEDEF
    LotBatchNo: src.LotBatchNo,
    SerialNo: src.SerialNo,
    EngChgLevel: src.EngChgLevel,
    WaivDevRejNo: src.WaivDevRejNo,
    ActivitySeq: Number(src.ActivitySeq),
    HandlingUnitId: Number(src.HandlingUnitId),
    Destination: 'MoveToInventory',
    QuantityMoved: 1,
    ParentLocationNo: src.LocationNo, // KAYNAK
    ParentContract: src.Contract,
    ParentWaivDevRejNo: src.WaivDevRejNo,
    ConsumeStock: 'N',
  }
  console.log('\nPOST gövdesi:', JSON.stringify(body))

  console.log('\n── Düz POST ──')
  const p = await plainPost(body)
  console.log(`HTTP ${p.status} ${p.statusText}`)
  console.log(p.text)

  const ok = p.status >= 200 && p.status < 300
  if (!ok) {
    console.log('\n❌ Başarısız (2xx değil). Otomatik varyant/batch DENENMİYOR — dur.')
    return
  }

  console.log('\n✅ Başarılı görünüyor — SONRA durumu:')
  const sonra40 = await stokOf('40')
  const sonra61 = await stokOf(HEDEF)
  tablo('SONRA — LocationNo=40 (kaynak)', sonra40)
  tablo(`SONRA — LocationNo=${HEDEF} (hedef)`, sonra61)

  const s40 = sonra40.find((r) => String(r.PartNo) === '8034' && String(r.LotBatchNo) === '1')
  const b61 = once61.filter((r) => String(r.PartNo) === '8034')
  const a61 = sonra61.filter((r) => String(r.PartNo) === '8034')
  console.log('\n── FARK ──')
  console.log(`  40/8034/lot1 AvailableQtyToMove: ${src.AvailableQtyToMove} → ${s40?.AvailableQtyToMove ?? '(yok)'} (QtyOnhand: ${src.QtyOnhand} → ${s40?.QtyOnhand ?? '(yok)'})`)
  console.log(`  ${HEDEF}/8034 satır: ${b61.length} → ${a61.length}`)
  a61.forEach((r) => console.log(`    ${HEDEF}/8034 lot=${r.LotBatchNo} Avail=${r.AvailableQtyToMove} QtyOnhand=${r.QtyOnhand}`))
  console.log(`  >> ${HEDEF} davranışı: ` + (a61.length > b61.length ? 'YENİ SATIR' : 'MEVCUT satıra eklendi / değişmedi'))
}
main().catch((e) => { console.error('❌ Üst hata:', e instanceof Error ? e.message : e); process.exit(1) })
