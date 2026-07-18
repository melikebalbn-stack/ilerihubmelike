/**
 * MoveInventoryPart projeksiyon haritası — SALT GET/metadata. EL-3a final.
 * HİÇBİR action çağrılmaz.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-moveinventorypart.ts
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

// metadata yardımcıları
function entityTypeForSet(xml: string, setName: string): string | null {
  const m = new RegExp(`<EntitySet\\s+Name="${setName}"\\s+EntityType="([^"]+)"`).exec(xml)
  return m ? m[1].split('.').pop()! : null
}
function typeBlock(xml: string, typeName: string): string | null {
  const m = new RegExp(`<EntityType\\s+Name="${typeName}"[^>]*>([\\s\\S]*?)</EntityType>`).exec(xml)
  return m ? m[1] : null
}
function keysOf(block: string): string[] {
  const k = /<Key>([\s\S]*?)<\/Key>/.exec(block)
  if (!k) return []
  return [...k[1].matchAll(/<PropertyRef\s+Name="([^"]+)"/g)].map((x) => x[1])
}
function propsOf(block: string): string[] {
  return [...block.matchAll(/<Property\s+Name="([^"]+)"[^>]*?Type="([^"]+)"([^>]*)>/g)].map((x) => {
    const nullable = /Nullable="false"/.test(x[3]) ? ' !' : ''
    return `${x[1]}:${x[2].replace('Edm.', '')}${nullable}`
  })
}
function actions(xml: string) {
  const out: { type: string; name: string; bound: boolean; params: string[] }[] = []
  for (const m of xml.matchAll(/<(Action|Function)\b([^>]*?)>([\s\S]*?)<\/\1>/g)) {
    const attrs = m[2], inner = m[3]
    const name = /Name="([^"]+)"/.exec(attrs)?.[1] ?? '?'
    const bound = /IsBound="true"/i.test(attrs)
    const params: string[] = []
    let first = true
    for (const p of inner.matchAll(/<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)) {
      if (bound && first) { first = false; continue }
      first = false
      params.push(`${p[1]}:${p[2].replace('Edm.', '')}`)
    }
    out.push({ type: m[1], name, bound, params })
  }
  return out
}

async function main() {
  // 1) service document — main, 404'te int
  let root = MAIN_ROOT, gw = 'main'
  let sd = await get(`${MAIN_ROOT}MoveInventoryPart.svc/`)
  if (sd.status === 404) {
    sd = await get(`${INT_ROOT}MoveInventoryPart.svc/`)
    root = INT_ROOT; gw = 'int'
  }
  console.log('═'.repeat(80))
  console.log(`1) ${gw}/MoveInventoryPart.svc/ → HTTP ${sd.status}`)
  console.log('═'.repeat(80))
  if (sd.status !== 200) {
    console.log('  body:', (typeof sd.body === 'string' ? sd.body : JSON.stringify(sd.body)).slice(0, 300))
    console.log('  → MoveInventoryPart bulunamadı. Bitti.')
    return
  }
  const sets = (((sd.body as { value?: unknown[] })?.value ?? []) as { name?: string; kind?: string }[])
    .filter((e) => !e.kind || e.kind === 'EntitySet').map((e) => e.name).filter(Boolean)
  const primary = sets.filter((s) => !/^(Reference_|Lookup_|FndTempLobs)/.test(String(s)))
  console.log(`  entity set: toplam ${sets.length}`)
  console.log(`  ana setler: ${primary.join(', ')}`)

  // 2) metadata
  const md = await get(`${root}MoveInventoryPart.svc/$metadata`, 'application/xml')
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`2) $metadata → HTTP ${md.status} (len ${md.text.length})`)
  console.log('═'.repeat(80))
  if (md.status === 200) {
    const xml = md.text
    // a) InventoryPartInStockSet anahtarları
    const ipsType = entityTypeForSet(xml, 'InventoryPartInStockSet') ?? 'InventoryPartInStock'
    const ipsBlock = typeBlock(xml, ipsType)
    console.log(`\n a) InventoryPartInStockSet (EntityType: ${ipsType}) anahtar alanları:`)
    console.log('    ' + (ipsBlock ? keysOf(ipsBlock).join(', ') : '(EntityType bulunamadı)'))

    // b) NewPartLocArray tüm alanları
    const nplBlock = typeBlock(xml, 'NewPartLocArray')
    console.log('\n b) NewPartLocArray alanları:')
    if (nplBlock) {
      console.log('    anahtar: ' + keysOf(nplBlock).join(', '))
      propsOf(nplBlock).forEach((p) => console.log('      ' + p))
    } else {
      // NewPartLocArray yoksa taşıma satırı olabilecek diğer array/virtual type'ları listele
      const cands = [...xml.matchAll(/<EntityType\s+Name="([^"]*(?:PartLoc|MoveInventoryPart|NewPart|MovePart)[^"]*)"/gi)].map((x) => x[1])
      console.log('    (NewPartLocArray yok) benzer type adayları: ' + ([...new Set(cands)].join(', ') || '(yok)'))
    }

    // c) tüm action'lar
    const acts = actions(xml)
    const hot = acts.filter((a) => /Move|Execute|Perform|Transfer/i.test(a.name))
    console.log(`\n c) action/function: toplam ${acts.length} | Move/Execute/Perform/Transfer: ${hot.length}`)
    hot.forEach((a) => console.log(`    • ${a.name}(${a.params.join(', ')})${a.bound ? ' [bound]' : ''}`))
    console.log('    (tüm action adları): ' + acts.map((a) => a.name).join(', '))
  }

  // 3) veri testi
  console.log(`\n${'═'.repeat(80)}`)
  console.log('3) VERİ TESTİ — InventoryPartInStockSet Contract=ILER2 top 5')
  console.log('═'.repeat(80))
  const F = encodeURIComponent(`Contract eq '${CONTRACT}'`)
  const d = await get(`${root}MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${F}&$top=5`)
  console.log(`  HTTP ${d.status}`)
  if (d.status === 200) {
    const rows = (((d.body as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[])
    const g = (r: Record<string, unknown>, ...ks: string[]) => { for (const k of ks) if (r[k] != null && r[k] !== '') return String(r[k]); return '·' }
    console.log('  kayıt:', rows.length)
    rows.forEach((r, i) => console.log(
      `  [${i}] PartNo=${g(r, 'PartNo')} Loc=${g(r, 'LocationNo')} Lot=${g(r, 'LotBatchNo')} ` +
      `QtyOnhand=${g(r, 'QtyOnhand')} AvailToMove=${g(r, 'AvailableQtytoMove', 'AvailableQtyToMove', 'AvailableQty')} HU=${g(r, 'HandlingUnitId')}`,
    ))
  } else {
    console.log('  ', (typeof d.body === 'string' ? d.body : JSON.stringify(d.body)).slice(0, 200))
  }
  console.log('\n✅ Tamam (salt okuma, action çağrılmadı).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
