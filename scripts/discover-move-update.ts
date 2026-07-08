/**
 * EL-3c AŞAMA 2 — dolu-hedef (Update) deseni keşfi. SALT OKUMA (GET/metadata). Yazma YOK.
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-move-update.ts
 */
import 'dotenv/config'

const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'
const MAIN = process.env.IFS_INT_BASE_URL!.replace(/[A-Za-z]+\.svc\/?$/, '').replace('/int/', '/main/')
let TOK = ''
async function token() {
  const b = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.IFS_CLIENT_ID!, client_secret: process.env.IFS_CLIENT_SECRET! })
  if (process.env.IFS_SCOPE) b.set('scope', process.env.IFS_SCOPE)
  const r = await fetch(process.env.IFS_TOKEN_URL!, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: b })
  return (await r.json()).access_token as string
}
async function get(url: string, accept = 'application/json') {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOK}`, Accept: accept } })
  return { status: r.status, text: await r.text() }
}

async function main() {
  TOK = await token()
  const md = (await get(`${MAIN}MoveInventoryPart.svc/$metadata`, 'application/xml')).text

  // 1) Update action imzası
  console.log('═'.repeat(80))
  console.log('1) InventoryPartInStockDelivery_UpdateInventoryPartInStockDelivery imzası')
  console.log('═'.repeat(80))
  const actRe = /<(Action|Function)\b([^>]*Name="([^"]*Update[^"]*Delivery[^"]*)"[^>]*)>([\s\S]*?)<\/\1>/g
  let m: RegExpExecArray | null
  let bulundu = false
  while ((m = actRe.exec(md)) !== null) {
    bulundu = true
    const attrs = m[2], name = m[3], inner = m[4]
    const bound = /IsBound="true"/i.test(attrs)
    const params = [...inner.matchAll(/<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)].map((x) => `${x[1]}:${x[2].replace('Edm.', '')}`)
    const ret = /<ReturnType\s+Type="([^"]+)"/.exec(inner)?.[1] ?? '(void)'
    console.log(`  ${m[1]} ${name}`)
    console.log(`  bound: ${bound}${bound ? ` (binding: ${params[0]})` : ''}`)
    console.log(`  parametreler: ${(bound ? params.slice(1) : params).join(', ')}`)
    console.log(`  return: ${ret}`)
  }
  if (!bulundu) console.log('  (Update...Delivery action metadata\'da bulunamadı)')

  // 2) InventoryPartInStockDelivery entity type alanları (taşıma satırı şeması)
  console.log(`\n${'═'.repeat(80)}`)
  console.log('2) InventoryPartInStockDelivery EntityType alanları (taşıma satırı şeması)')
  console.log('═'.repeat(80))
  const tb = /<EntityType\s+Name="InventoryPartInStockDelivery"[^>]*>([\s\S]*?)<\/EntityType>/.exec(md)
  if (tb) {
    const keys = [...(/<Key>([\s\S]*?)<\/Key>/.exec(tb[1])?.[1] ?? '').matchAll(/<PropertyRef\s+Name="([^"]+)"/g)].map((x) => x[1])
    const props = [...tb[1].matchAll(/<Property\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g)].map((x) => `${x[1]}:${x[2].replace('Edm.', '')}`)
    console.log('  anahtar:', keys.join(', ') || '(yok)')
    console.log('  alanlar:')
    props.forEach((p) => console.log('    ' + p))
  } else console.log('  (EntityType bulunamadı)')

  // 3) Kaynak 40/8034 stok kaydının NewPartLocArray navigasyonu
  console.log(`\n${'═'.repeat(80)}`)
  console.log('3) 40/8034 NewPartLocArray (dolu hedef satırları burada mı?)')
  console.log('═'.repeat(80))
  const key = [
    `Contract='ILER2'`, `PartNo='8034'`, `ConfigurationId='*'`, `LocationNo='40'`,
    `LotBatchNo='1'`, `SerialNo='*'`, `EngChgLevel='1'`, `WaivDevRejNo='*'`,
    `ActivitySeq=0`, `HandlingUnitId=0`,
  ].join(',')
  const url = `${MAIN}MoveInventoryPart.svc/InventoryPartInStockSet(${encodeURI(key)})/NewPartLocArray`
  console.log('  GET', url.replace(MAIN, '.../'))
  const r = await get(url)
  console.log(`  HTTP ${r.status}`)
  try {
    const j = JSON.parse(r.text)
    const rows = (j.value ?? []) as Record<string, unknown>[]
    console.log(`  dönen satır: ${rows.length}`)
    rows.forEach((row, i) => {
      const dolu = Object.keys(row).filter((k) => !k.startsWith('@') && row[k] != null && row[k] !== '' && row[k] !== '*')
      console.log(`  [${i}] dolu alanlar: ${dolu.map((k) => `${k}=${row[k]}`).join(', ')}`)
    })
    if (rows[0]) console.log('  [0] TÜM anahtarlar:', Object.keys(rows[0]).filter((k) => !k.startsWith('@')).join(', '))
  } catch {
    console.log('  ham yanıt:', r.text.slice(0, 400))
  }
  console.log('\n✅ Aşama 2 tamam (salt okuma, yazma yok).')
}
main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1) })
