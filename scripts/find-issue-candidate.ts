/**
 * EL-5d ön keşif — test edilebilir iş emri arama. SALT OKUMA (GET). Aksiyon YOK.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/find-issue-candidate.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => { const v = process.env[k]; if (req && (!v || !v.trim())) throw new Error(`eksik: ${k}`); return v ?? '' }
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET'), SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const MAIN = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
const SO = `${MAIN}ShopOrderHandling.svc/`
const IPS = `${MAIN}InventoryPartInStockHandling.svc/`

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
async function getJson(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } })
  const t = await r.text()
  let b: unknown = null
  try { b = t ? JSON.parse(t) : null } catch { /* */ }
  return { status: r.status, rows: (((b as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[]) }
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// Parça toplam onhand cache
const stokCache = new Map<string, number>()
async function toplamOnhand(pn: string): Promise<number> {
  if (stokCache.has(pn)) return stokCache.get(pn)!
  const f = encodeURIComponent(`Contract eq '${CONTRACT}' and PartNo eq '${pn}'`)
  const r = await getJson(`${IPS}InventoryPartInStockSet?$filter=${f}&$select=PartNo,QtyOnhand&$top=100`)
  const total = r.status === 200 ? r.rows.reduce((s, x) => s + num(x.QtyOnhand), 0) : -1
  stokCache.set(pn, total)
  return total
}

async function main() {
  // 1) Released iş emirleri
  const f = encodeURIComponent(`Contract eq '${CONTRACT}' and Objstate eq 'Released'`)
  let so = await getJson(`${SO}ShopOrds?$filter=${f}&$select=OrderNo,ReleaseNo,SequenceNo,PartNo,RevisedQtyDue&$top=30`)
  if (so.status !== 200) {
    // Objstate filtresi tutmazsa filtresiz çek, JS'te ele
    so = await getJson(`${SO}ShopOrds?$filter=${encodeURIComponent(`Contract eq '${CONTRACT}'`)}&$select=OrderNo,ReleaseNo,SequenceNo,PartNo,RevisedQtyDue,Objstate&$top=30`)
  }
  console.log(`Released iş emri sorgusu HTTP ${so.status} → ${so.rows.length} kayıt\n`)

  interface Aday { orderNo: string; urun: string; qtyDue: number; komp: string; kompAd: string; kalan: number; stok: number }
  const adaylar: Aday[] = []
  const rows: string[] = []

  for (const o of so.rows) {
    const orderNo = String(o.OrderNo)
    const key = `OrderNo='${orderNo}',ReleaseNo='${o.ReleaseNo}',SequenceNo='${o.SequenceNo}'`
    const mat = await getJson(`${SO}ShopOrds(${encodeURI(key)})/MaterialArray?$select=LineItemNo,PartNo,PartDescription,QtyRequired,QtyIssued,QtyRemainToIssue&$top=50`)
    if (mat.status !== 200) { rows.push(`${orderNo} | ${o.PartNo} | MaterialArray HTTP ${mat.status}`); continue }
    const acikKomp = mat.rows.filter((m) => num(m.QtyRemainToIssue) > 0)
    if (!acikKomp.length) { rows.push(`${orderNo} | ${o.PartNo} (qty ${o.RevisedQtyDue}) | açık komponent yok`); continue }
    for (const m of acikKomp) {
      const pn = String(m.PartNo)
      const stok = await toplamOnhand(pn)
      const aday: Aday = { orderNo, urun: String(o.PartNo), qtyDue: num(o.RevisedQtyDue), komp: pn, kompAd: String(m.PartDescription ?? ''), kalan: num(m.QtyRemainToIssue), stok }
      adaylar.push(aday)
      rows.push(`${orderNo} | ürün ${o.PartNo} | komp ${pn} (${aday.kompAd.slice(0, 18)}) | kalan ${aday.kalan} | STOK ${stok < 0 ? 'sorgu-hata' : stok}${stok > 0 ? ' ✓' : ''}`)
    }
  }

  console.log('═'.repeat(90))
  console.log('İŞ EMRİ → KOMPONENT → STOK')
  console.log('═'.repeat(90))
  rows.forEach((r) => console.log('  ' + r))

  // 4) stoklu adaylar
  const stoklu = adaylar.filter((a) => a.stok > 0)
  console.log(`\n${'═'.repeat(90)}`)
  console.log(`STOKTA KOMPONENTİ OLAN İŞ EMİRLERİ: ${stoklu.length}`)
  console.log('═'.repeat(90))
  if (!stoklu.length) {
    console.log('  (yok — hiçbir açık komponentin ILER2 stoğu yok)')
  } else {
    // iş emri başına komponent sayısı
    const kompSay = new Map<string, number>()
    adaylar.forEach((a) => kompSay.set(a.orderNo, (kompSay.get(a.orderNo) ?? 0) + 1))
    // en iyi aday: tek komponentli + küçük kalan + stok yeterli
    const sirali = stoklu
      .map((a) => ({ ...a, tekKomp: (kompSay.get(a.orderNo) ?? 9) === 1, yeterli: a.stok >= a.kalan }))
      .sort((a, b) => Number(b.tekKomp) - Number(a.tekKomp) || Number(b.yeterli) - Number(a.yeterli) || a.kalan - b.kalan)
    sirali.forEach((a, i) =>
      console.log(`  ${i === 0 ? '★ EN UYGUN' : '  '} İş emri ${a.orderNo} → komp ${a.komp} kalan ${a.kalan} / stok ${a.stok}${a.tekKomp ? ' (tek komponent)' : ''}${a.yeterli ? ' (stok yeterli)' : ' (stok<kalan)'}`),
    )
  }
  console.log('\n✅ Tamam (salt okuma).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
