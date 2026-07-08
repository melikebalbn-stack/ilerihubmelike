/**
 * IFS part-level taşıma action keşfi — SALT metadata/service-doc GET. EL-3a ek.
 * HİÇBİR veri yazma / action ÇAĞRILMAZ; sadece imzalar çıkarılır.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-move-actions.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => {
  const v = process.env[k]
  if (req && (!v || !v.trim())) throw new Error(`IFS env eksik: ${k}`)
  return v ?? ''
}
const TOKEN_URL = env('IFS_TOKEN_URL')
const CLIENT_ID = env('IFS_CLIENT_ID')
const CLIENT_SECRET = env('IFS_CLIENT_SECRET')
const SCOPE = env('IFS_SCOPE', false)
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
  const t = await token()
  const r = await fetch(url, { headers: { Authorization: `Bearer ${t}`, Accept: accept } })
  const text = await r.text()
  let body: unknown = text
  try { body = text ? JSON.parse(text) : null } catch { /* xml */ }
  return { status: r.status, body, text }
}

const MOVE_RE = /Move|Transfer|Reclassif|ChangeLocation|Relocat|Reloc/i

interface ActSig { type: string; name: string; bound: boolean; bindType: string; params: string[] }

function extractActions(xml: string): ActSig[] {
  const out: ActSig[] = []
  const re = /<(Action|Function)\b([^>]*?)>([\s\S]*?)<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const type = m[1]
    const attrs = m[2]
    const inner = m[3]
    const name = /Name="([^"]+)"/.exec(attrs)?.[1] ?? '?'
    const bound = /IsBound="true"/i.test(attrs)
    const params: string[] = []
    let bindType = ''
    const pre = /<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g
    let p: RegExpExecArray | null
    let first = true
    while ((p = pre.exec(inner)) !== null) {
      const pname = p[1]
      const ptype = p[2].replace('Edm.', '')
      if (bound && first) { bindType = ptype; first = false; continue } // binding param
      first = false
      params.push(`${pname}:${ptype}`)
    }
    out.push({ type, name, bound, bindType, params })
  }
  return out
}

function printMoveActions(tag: string, xml: string) {
  const acts = extractActions(xml)
  const moves = acts.filter((a) => MOVE_RE.test(a.name))
  console.log(`\n[${tag}] toplam action/function: ${acts.length} | Move/Transfer/Reclassify/ChangeLocation: ${moves.length}`)
  for (const a of moves) {
    const bindStr = a.bound ? ` [bound: ${a.bindType.replace(/^Collection\(|\)$/g, '').split('.').pop()}]` : ' [unbound]'
    console.log(`   • ${a.name}(${a.params.join(', ')})${bindStr}`)
  }
}

const NEW_CANDIDATES = [
  'MoveInventoryPartsHandling',
  'MovePartsHandling',
  'InventoryPartMoveHandling',
  'MoveInventoryHandling',
  'InventoryTransactionsHandling',
  'TransferInventoryPartHandling',
  'WarehouseTasksHandling',
  'InventoryPartInStockUivHandling',
]
const GRANTED = [
  'InventoryPartInStockHandling',
  'HandlingUnitsHandling',
  'InventoryLocationsHandling',
  'WarehouseNavigatorHandling',
]

async function main() {
  console.log('═'.repeat(80))
  console.log('1) YENİ ADAY PROJEKSİYONLAR (/main/)')
  console.log('═'.repeat(80))
  for (const proj of NEW_CANDIDATES) {
    const sd = await get(`${MAIN_ROOT}${proj}.svc/`)
    if (sd.status !== 200) {
      console.log(`\n── ${proj} → ${sd.status === 404 ? '404 YOK' : sd.status}`)
      continue
    }
    const sets = (((sd.body as { value?: unknown[] })?.value ?? []) as { name?: string; kind?: string }[])
      .filter((e) => !e.kind || e.kind === 'EntitySet')
      .map((e) => e.name)
      .filter((n): n is string => !!n && !/^(Reference_|Lookup_|FndTempLobs)/.test(n))
    console.log(`\n── ${proj} → 200 VAR | ana entity: ${sets.join(', ') || '(yok)'}`)
    const md = await get(`${MAIN_ROOT}${proj}.svc/$metadata`, 'application/xml')
    if (md.status === 200) printMoveActions(proj, md.text)
    else console.log(`   $metadata → HTTP ${md.status}`)
  }

  console.log(`\n${'═'.repeat(80)}`)
  console.log('2) GRANT\'Lİ 4 PROJEKSİYON — DERİN ACTION TARAMASI (bound + unbound)')
  console.log('═'.repeat(80))
  for (const proj of GRANTED) {
    const md = await get(`${MAIN_ROOT}${proj}.svc/$metadata`, 'application/xml')
    if (md.status !== 200) { console.log(`\n[${proj}] $metadata → HTTP ${md.status}`); continue }
    printMoveActions(proj, md.text)
    // Ayrıca TÜM action adlarını (kaçmasın diye) kompakt dök
    const all = extractActions(md.text).map((a) => a.name)
    console.log(`   (tüm action adları: ${all.join(', ')})`)
  }

  console.log('\n✅ Tamam (salt metadata, hiçbir action çağrılmadı).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
