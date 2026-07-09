/**
 * EL-6a GÖREV 1 — Sapma yolu keşfi: belirli lot/lokasyona MANUEL rezervasyon.
 * SALT metadata/GET. Aksiyon YOK.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-manual-reserve.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => { const v = process.env[k]; if (req && (!v || !v.trim())) throw new Error(`eksik: ${k}`); return v ?? '' }
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET'), SCOPE = env('IFS_SCOPE', false)
const MAIN = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')

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
  return { status: r.status, text: await r.text() }
}
function allActions(xml: string) {
  const out: { name: string; bound: boolean; bindType: string; params: string[]; ret: string }[] = []
  for (const m of xml.matchAll(/<(Action|Function)\b([^>]*?)>([\s\S]*?)<\/\1>/g)) {
    const attrs = m[2], inner = m[3]
    const name = /Name="([^"]+)"/.exec(attrs)?.[1] ?? '?'
    const bound = /IsBound="true"/i.test(attrs)
    const params: string[] = []; let bindType = ''; let first = true
    for (const p of inner.matchAll(/<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)) {
      const short = p[2].replace('Edm.', '').replace(/^Collection\(|\)$/g, '').split('.').pop()!
      if (bound && first) { bindType = short; first = false; continue }
      first = false
      params.push(`${p[1]}:${p[2].replace('Edm.', '')}`)
    }
    const ret = /<ReturnType\s+Type="([^"]+)"/.exec(inner)?.[1]?.split('.').pop() ?? 'void'
    out.push({ name, bound, bindType, params, ret })
  }
  return out
}
function typeProps(xml: string, name: string) {
  const b = new RegExp(`<EntityType\\s+Name="${name}"[^>]*>([\\s\\S]*?)</EntityType>`).exec(xml)
  if (!b) return null
  const keys = [...(/<Key>([\s\S]*?)<\/Key>/.exec(b[1])?.[1] ?? '').matchAll(/<PropertyRef\s+Name="([^"]+)"/g)].map((m) => m[1])
  const props = [...b[1].matchAll(/<Property\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)].map((m) => `${m[1]}:${m[2].replace('Edm.', '')}`)
  const navs = [...b[1].matchAll(/<NavigationProperty\s+Name="([^"]+)"\s+Type="([^"]+)"/g)].map((m) => `${m[1]}→${m[2].replace(/^Collection\(|\)$/g, '').split('.').pop()}`)
  return { keys, props, navs }
}

async function main() {
  // 1) ShopOrderHandling: manuel rezervasyon (LocationNo/LotBatchNo alan) action'ları
  console.log('═'.repeat(80)); console.log('1) ShopOrderHandling — rezervasyon action'.replace(/'/g, '') + ' (Reserve + LocationNo/LotBatchNo)'); console.log('═'.repeat(80))
  const so = (await get(`${MAIN}ShopOrderHandling.svc/$metadata`, 'application/xml')).text
  const acts = allActions(so)
  const reserveActs = acts.filter((a) => /Reserv|Assign/i.test(a.name))
  reserveActs.forEach((a) => {
    const manual = /Location|LotBatch|SerialNo|HandlingUnit/i.test(a.params.join(','))
    console.log(`  ${manual ? '★ MANUEL' : '•'} ${a.bound ? `[${a.bindType}] ` : ''}${a.name}(${a.params.join(', ')}) → ${a.ret}`)
  })

  // 2) ShopMaterialAssign + ReservedLotBatch entity yapısı
  for (const t of ['ShopMaterialAssign', 'ReservedLotBatch']) {
    console.log(`\n${'─'.repeat(80)}\n[${t}] yapısı (ShopOrderHandling)`)
    const p = typeProps(so, t)
    if (!p) { console.log('  (EntityType yok)'); continue }
    console.log('  anahtar:', p.keys.join(', '))
    console.log('  alanlar:', p.props.filter((x) => /Part|Location|Lot|Serial|Qty|Order|Line|Handling|Reserv/i.test(x)).join(', '))
    console.log('  nav:', p.navs.join(', ') || '(yok)')
    const ba = acts.filter((a) => a.bound && new RegExp(t, 'i').test(a.bindType))
    if (ba.length) { console.log(`  bound action:`); ba.forEach((a) => console.log(`    • ${a.name}(${a.params.join(', ')})`)) }
  }

  // 3) Aday manuel-rezervasyon projeksiyonları
  console.log(`\n${'═'.repeat(80)}`); console.log('3) Aday manuel rezervasyon projeksiyonları (/main/)'); console.log('═'.repeat(80))
  const CANDS = ['ManualReservationHandling', 'InventoryPartReservationHandling', 'ReserveInventoryPartHandling', 'ShopOrderReservationHandling', 'ReserveMaterialHandling', 'PartReservationHandling']
  for (const proj of CANDS) {
    const sd = await get(`${MAIN}${proj}.svc/`)
    if (sd.status !== 200) { console.log(`  ${proj} → ${sd.status === 404 ? '404' : sd.status}`); continue }
    const md = (await get(`${MAIN}${proj}.svc/$metadata`, 'application/xml')).text
    const ra = allActions(md).filter((a) => /Reserv/i.test(a.name) && /Location|LotBatch|Qty/i.test(a.params.join(',')))
    console.log(`  ${proj} → 200 | manuel-rezerve action: ${ra.length}`)
    ra.forEach((a) => console.log(`     ★ ${a.bound ? `[${a.bindType}] ` : ''}${a.name}(${a.params.join(', ')})`))
  }
  console.log('\n✅ Tamam (salt metadata/GET).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
