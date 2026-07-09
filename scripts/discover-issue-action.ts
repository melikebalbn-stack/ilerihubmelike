/**
 * EL-5b — İş emri malzeme çıkış action'ı tespiti. SALT metadata/GET, aksiyon YOK.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-issue-action.ts
 */
import 'dotenv/config'

const env = (k: string, req = true) => { const v = process.env[k]; if (req && (!v || !v.trim())) throw new Error(`eksik: ${k}`); return v ?? '' }
const TOKEN_URL = env('IFS_TOKEN_URL'), CLIENT_ID = env('IFS_CLIENT_ID'), CLIENT_SECRET = env('IFS_CLIENT_SECRET'), SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
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

/** Tüm action/function'ları çıkar (bound binding tipiyle). */
function allActions(xml: string) {
  const out: { kind: string; name: string; bound: boolean; bindType: string; params: string[]; ret: string }[] = []
  for (const m of xml.matchAll(/<(Action|Function)\b([^>]*?)>([\s\S]*?)<\/\1>/g)) {
    const attrs = m[2], inner = m[3]
    const name = /Name="([^"]+)"/.exec(attrs)?.[1] ?? '?'
    const bound = /IsBound="true"/i.test(attrs)
    const params: string[] = []
    let bindType = ''
    let first = true
    for (const p of inner.matchAll(/<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)) {
      const short = p[2].replace('Edm.', '').replace(/^Collection\(|\)$/g, '').split('.').pop()!
      if (bound && first) { bindType = short; first = false; continue }
      first = false
      params.push(`${p[1]}:${p[2].replace('Edm.', '')}`)
    }
    const ret = /<ReturnType\s+Type="([^"]+)"/.exec(inner)?.[1]?.split('.').pop() ?? 'void'
    out.push({ kind: m[1], name, bound, bindType, params, ret })
  }
  return out
}

async function scanProj(proj: string) {
  console.log('\n' + '═'.repeat(80))
  console.log(`PROJEKSİYON: ${proj}`)
  console.log('═'.repeat(80))
  const md = await get(`${MAIN}${proj}.svc/$metadata`, 'application/xml')
  if (md.status !== 200) { console.log(`$metadata HTTP ${md.status}`); return }
  const xml = md.text
  const acts = allActions(xml)

  // 1a) ShopMaterialAlloc'a bound TÜM action'lar
  const boundToMat = acts.filter((a) => a.bound && /ShopMaterialAlloc/i.test(a.bindType))
  console.log(`\n[1a] ShopMaterialAlloc'a bound action (${boundToMat.length}):`)
  boundToMat.forEach((a) => console.log(`   • ${a.name}(${a.params.join(', ')}) → ${a.ret}`))

  // 1b) bindType'ında Material/Component geçen tüm bound action'lar (sürpriz binding)
  const boundMatLike = acts.filter((a) => a.bound && /Material|Component|Alloc|PickList|Issue/i.test(a.bindType) && !/ShopMaterialAlloc/i.test(a.bindType))
  if (boundMatLike.length) {
    console.log(`\n[1b] diğer malzeme-benzeri entity'lere bound (${boundMatLike.length}):`)
    boundMatLike.forEach((a) => console.log(`   • [${a.bindType}] ${a.name}(${a.params.join(', ')}) → ${a.ret}`))
  }

  // 1c) unbound Issue/Material/Backflush/Withdraw/Manual
  const unboundIssue = acts.filter((a) => !a.bound && /Issue|Backflush|Withdraw|ManualIssue|MaterialIssue|Consum/i.test(a.name))
  console.log(`\n[1c] unbound Issue/Material/Backflush action (${unboundIssue.length}):`)
  unboundIssue.forEach((a) => console.log(`   • ${a.name}(${a.params.join(', ')}) → ${a.ret}`))

  // 1d) ShopMaterialAlloc navigation property'leri (NewPartLoc benzeri alt-koleksiyon?)
  const matBlock = /<EntityType\s+Name="ShopMaterialAlloc"[^>]*>([\s\S]*?)<\/EntityType>/.exec(xml)
  if (matBlock) {
    const navs = [...matBlock[1].matchAll(/<NavigationProperty\s+Name="([^"]+)"\s+Type="([^"]+)"/g)].map((m) => `${m[1]} → ${m[2].replace(/^Collection\(|\)$/g, '').split('.').pop()}`)
    console.log(`\n[1d] ShopMaterialAlloc navigation (${navs.length}): ${navs.join(' | ') || '(yok)'}`)
  }

  // 2) EntitySet / action adlarında IssueShopOrder / ManualIssue benzeri
  const hot = [...xml.matchAll(/<(?:EntitySet|Action|Function|EntityType)\s+Name="([^"]*(?:Issue|ManualIssue|Withdraw|Backflush|Consumption|Consum)[^"]*)"/gi)].map((m) => m[1])
  console.log(`\n[2] Issue/ManualIssue/Withdraw/Backflush adlı EntitySet/Type/Action: ${[...new Set(hot)].join(', ') || '(yok)'}`)
}

async function main() {
  await scanProj('ShopOrderHandling')
  await scanProj('ShopOrdersHandling')

  // 3) Veri erişim denemesi — ShopMaterialAlloc $top=1
  console.log('\n' + '═'.repeat(80))
  console.log('[3] VERİ ERİŞİMİ — ShopMaterialAllocSet $top=1 (grant kanıtı)')
  console.log('═'.repeat(80))
  for (const proj of ['ShopOrderHandling', 'ShopOrdersHandling']) {
    // olası set adları
    for (const setName of ['ShopMaterialAllocSet', 'ShopMaterialAlloc']) {
      const r = await get(`${MAIN}${proj}.svc/${setName}?$filter=${encodeURIComponent(`Contract eq '${CONTRACT}'`)}&$top=1`)
      if (r.status === 404) continue
      console.log(`  ${proj}/${setName} → HTTP ${r.status}${r.status !== 200 ? ' | ' + r.text.replace(/\s+/g, ' ').slice(0, 140) : ' (VERİ OK)'}`)
    }
  }
  console.log('\n✅ Tamam (salt metadata/GET, aksiyon çağrılmadı).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
