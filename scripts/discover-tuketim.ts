/**
 * IFS tüketim/malzeme çıkışı keşfi — SALT OKUMA (GET/metadata). EL-5a.
 * HİÇBİR action çağrılmaz, yazma yok.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-tuketim.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => {
  const v = process.env[k]
  if (req && (!v || !v.trim())) throw new Error(`IFS env eksik: ${k}`)
  return v ?? ''
}
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET')
const SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const INT_ROOT = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '')
const MAIN_ROOT = INT_ROOT.replace('/int/', '/main/')

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
function setsOf(body: unknown): string[] {
  const v = (body as { value?: unknown })?.value
  if (!Array.isArray(v)) return []
  return v.filter((e) => e && typeof e === 'object').filter((e) => { const k = (e as { kind?: string }).kind; return k === undefined || k === 'EntitySet' })
    .map((e) => String((e as { name?: string }).name ?? '')).filter(Boolean)
}
const primary = (s: string[]) => s.filter((x) => !/^(Reference_|Lookup_|FndTempLobs)/.test(x))
function actionsMatching(xml: string, re: RegExp) {
  const out: { name: string; bound: boolean; params: string[] }[] = []
  for (const m of xml.matchAll(/<(Action|Function)\b([^>]*?)>([\s\S]*?)<\/\1>/g)) {
    const name = /Name="([^"]+)"/.exec(m[2])?.[1] ?? '?'
    if (!re.test(name)) continue
    const bound = /IsBound="true"/i.test(m[2])
    const params: string[] = []
    let first = true
    for (const p of m[3].matchAll(/<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)) {
      if (bound && first) { first = false; continue }
      first = false
      params.push(`${p[1]}:${p[2].replace('Edm.', '')}`)
    }
    out.push({ name, bound, params })
  }
  return out
}
const ISSUE_MARK = /OrderNo|ReleaseNo|SequenceNo/i
const ISSUE_MARK2 = /PartNo|Qty|Quantity|LocationNo|LotBatch/i

async function bolum1() {
  console.log('═'.repeat(80)); console.log('BÖLÜM 1 — ÇIKIŞ PROJEKSİYONLARI'); console.log('═'.repeat(80))
  const CANDS = ['IssueInventoryPart', 'IssueInventoryParts', 'ShopOrderIssue', 'ShopOrderMaterialIssue', 'UnissueInventoryPart', 'ManufacturingIssue', 'ShopOrderPickListHandling', 'ReportShopOrderOperationHandling']
  for (const proj of CANDS) {
    let root = MAIN_ROOT, gw = 'main'
    let sd = await get(`${MAIN_ROOT}${proj}.svc/`)
    if (sd.status === 404) { sd = await get(`${INT_ROOT}${proj}.svc/`); root = INT_ROOT; gw = 'int' }
    if (sd.status !== 200) { console.log(`\n── ${proj} → ${sd.status === 404 ? '404 YOK' : sd.status}`); continue }
    console.log(`\n── ${gw}/${proj} → 200 | ana: ${primary(setsOf(sd.body)).join(', ') || '(yok)'}`)
    const md = await get(`${root}${proj}.svc/$metadata`, 'application/xml')
    if (md.status !== 200) { console.log(`   $metadata HTTP ${md.status}`); continue }
    const acts = actionsMatching(md.text, /Issue|Unissue|Report/i)
    console.log(`   Issue/Unissue/Report action: ${acts.length}`)
    for (const a of acts) {
      const isIssue = ISSUE_MARK.test(a.params.join(',')) && ISSUE_MARK2.test(a.params.join(','))
      console.log(`   ${isIssue ? '★' : '•'} ${a.name}(${a.params.join(', ')})${a.bound ? ' [bound]' : ''}`)
    }
  }
}

async function bolum2() {
  console.log(`\n${'═'.repeat(80)}`); console.log('BÖLÜM 2 — FIFO ALTYAPISI'); console.log('═'.repeat(80))
  // a) ReceiptDate
  const F = encodeURIComponent(`Contract eq '${CONTRACT}'`)
  const r = await get(`${MAIN_ROOT}InventoryPartInStockHandling.svc/InventoryPartInStockSet?$filter=${F}&$top=15`)
  console.log(`\na) InventoryPartInStockSet ilk 15 (HTTP ${r.status}):`)
  const dates: string[] = []
  if (r.status === 200) {
    const rows = (((r.body as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[])
    console.log('  PartNo | LocationNo | LotBatchNo | ReceiptDate | ExpirationDate')
    for (const x of rows) {
      const rd = String(x.ReceiptDate ?? '·')
      dates.push(rd)
      console.log(`  ${x.PartNo} | ${x.LocationNo} | ${x.LotBatchNo} | ${rd} | ${x.ExpirationDate ?? '·'}`)
    }
    const uniq = [...new Set(dates.map((d) => d.slice(0, 10)))].filter((d) => d && d !== '·')
    console.log(`  → benzersiz ReceiptDate (gün): ${uniq.length} → ${uniq.join(', ')}`)
    console.log(`  → HÜKÜM: ${uniq.length <= 1 ? 'TÜMÜ AYNI GÜN (toplu yükleme — FIFO ayrımı yok)' : 'FARKLI tarihler (FIFO anlamlı)'}`)
  } else {
    console.log('  ', (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)).slice(0, 160))
  }

  // b) Site rezervasyon ayarı
  console.log('\nb) Site rezervasyon ayarı:')
  for (const proj of ['SitesHandling', 'SiteHandling', 'CompanySitesHandling']) {
    const sd = await get(`${MAIN_ROOT}${proj}.svc/`)
    if (sd.status !== 200) { console.log(`  ${proj} → ${sd.status}`); continue }
    const md = await get(`${MAIN_ROOT}${proj}.svc/$metadata`, 'application/xml')
    const props = [...md.text.matchAll(/<Property\s+Name="([^"]*(?:Reservation|Reserve|Automatic)[^"]*)"/gi)].map((m) => m[1])
    console.log(`  ${proj} → 200 | rezervasyon alanları: ${[...new Set(props)].join(', ') || '(yok)'}`)
  }
  console.log("  NOT: Bulunamazsa Aurena'dan elle: Site/Warehouse Management/Automatic Reservation.")
}

async function bolum3() {
  console.log(`\n${'═'.repeat(80)}`); console.log('BÖLÜM 3 — SHOP ORDER MALZEME LİSTESİ'); console.log('═'.repeat(80))
  for (const proj of ['ShopOrderHandling', 'ShopOrdersHandling']) {
    const md = await get(`${MAIN_ROOT}${proj}.svc/$metadata`, 'application/xml')
    if (md.status !== 200) { console.log(`\n[${proj}] $metadata HTTP ${md.status}`); continue }
    const types = [...new Set([...md.text.matchAll(/<EntityType\s+Name="([^"]*(?:Material|Component|MaterialAlloc|Alloc)[^"]*)"/gi)].map((m) => m[1]))]
    console.log(`\n[${proj}] material/component EntityType'lar: ${types.join(', ') || '(yok)'}`)
    // ilk material type'ın alanlarını çıkar
    const pick = types.find((t) => /Material/i.test(t)) ?? types[0]
    if (pick) {
      const blk = new RegExp(`<EntityType\\s+Name="${pick}"[^>]*>([\\s\\S]*?)</EntityType>`).exec(md.text)
      if (blk) {
        const keys = [...(/<Key>([\s\S]*?)<\/Key>/.exec(blk[1])?.[1] ?? '').matchAll(/<PropertyRef\s+Name="([^"]+)"/g)].map((m) => m[1])
        const props = [...blk[1].matchAll(/<Property\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)].map((m) => m[1]).filter((n) => /Part|Qty|Quantity|Order|Location|Lot|Line|Description/i.test(n))
        console.log(`  ${pick} anahtar: ${keys.join(', ')}`)
        console.log(`  ilgili alanlar: ${props.join(', ')}`)
      }
    }
  }
}

async function main() {
  await bolum1(); await bolum2(); await bolum3()
  console.log('\n✅ Keşif tamam (salt okuma, action çağrılmadı).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
