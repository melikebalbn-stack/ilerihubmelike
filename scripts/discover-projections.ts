/**
 * IFS test ortamı — iş emri/operasyon ve parça master projeksiyonlarını keşfeden
 * SALT OKUMA (GET) script. Hiçbir POST/aksiyon yok.
 *
 * Usage:
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-projections.ts
 *
 * NOT (discover-shopfloor-data.ts ile aynı): src/lib/ifs/* `server-only` içerdiği
 * için tsx'te import edilemez; auth/token akışı burada birebir replike edilir.
 * IFS test sunucusu RapidSSL ara-CA kullanır → NODE_EXTRA_CA_CERTS gerekir.
 */
import 'dotenv/config'

// ───────────────────────────── env / config
function env(k: string, required = true): string {
  const v = process.env[k]
  if (required && (!v || !v.trim())) throw new Error(`IFS env eksik: ${k}`)
  return v ?? ''
}

const TOKEN_URL = env('IFS_TOKEN_URL')
const CLIENT_ID = env('IFS_CLIENT_ID')
const CLIENT_SECRET = env('IFS_CLIENT_SECRET')
const SCOPE = env('IFS_SCOPE', false)
const CONTRACT = process.env.IFS_CONTRACT?.trim() || 'ILER2'

// IFS_INT_BASE_URL: .../int/ifsapplications/projection/v1/ShopFloorService.svc
// → projeksiyon kökü (.../int/.../v1/) ve /main/ eşdeğeri türetilir.
const INT_ROOT = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '')
const MAIN_ROOT = INT_ROOT.replace('/int/', '/main/')

// ───────────────────────────── token (client_credentials)
let cachedToken: { token: string; expiresAt: number } | null = null
async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })
  if (SCOPE) body.set('scope', SCOPE)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`IFS token alınamadı (HTTP ${res.status}): ${t.slice(0, 500)}`)
  }
  const j = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('access_token yok')
  cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 300) * 1000 }
  return j.access_token
}

// ───────────────────────────── GET helper (status + body)
async function ifsGet(url: string): Promise<{ status: number; body: unknown }> {
  const token = await getAccessToken()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (e) {
    return { status: -1, body: `fetch failed: ${e instanceof Error ? e.message : String(e)}` }
  }
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değil (ör. XML/HTML) — ham metin kalır */
  }
  return { status: res.status, body }
}

// ───────────────────────────── yardımcılar
const CANDIDATES = [
  'ShopOrderOperationsHandling',
  'ShopOrderOperationHandling',
  'ShopOrdersHandling',
  'ShopOrderHandling',
  'ManufacturingOperationsHandling',
  'InventoryPartsHandling',
  'InventoryPartHandling',
  'PartCatalogHandling',
  'PartsHandling',
]
const GATEWAYS: { name: string; root: string }[] = [
  { name: 'main', root: MAIN_ROOT },
  { name: 'int', root: INT_ROOT },
]

// İlgi çekici alanlar (ShopOrder / InventoryPart)
const FIELD_INTEREST = [
  'OrderNo', 'OperationNo', 'PartNo', 'Description', 'PartDescription',
  'WorkCenter', 'WorkCenterNo', 'Contract',
]
const isDateField = (k: string) => /date|time|start|finish|due|deliver/i.test(k)
const looksInteresting = (name: string) => /order|operation|part|inventory/i.test(name)

// Reference_/Lookup_ = LOV/referans alt-entity'leri (çoğu 403). Asıl veri seti
// bunlar DIŞINDA, projeksiyonun ana entity'sidir (ör. ShopOrderOperations, ShopOrds,
// InventoryPartSet, PartCatalogSet). Ona öncelik ver.
function pickEntitySet(sets: string[], cand: string): string | undefined {
  const primary = sets.filter((s) => !/^(Reference_|Lookup_|FndTempLobs)/.test(s))
  const prefs = /InventoryPart|PartCatalog|Parts/i.test(cand)
    ? [/^inventorypart(set)?$/i, /inventorypart/i, /partcatalog/i, /part/i]
    : [/shoporderoperations?(set)?$/i, /operation/i, /^shopords?$/i, /shopord/i, /order/i]
  for (const re of prefs) {
    const m = primary.find((s) => re.test(s))
    if (m) return m
  }
  return primary.find(looksInteresting) ?? primary[0] ?? sets[0]
}

function entitySetsOf(body: unknown): string[] {
  const val = (body as { value?: unknown })?.value
  if (!Array.isArray(val)) return []
  return val
    .filter((e) => e && typeof e === 'object')
    .filter((e) => {
      const kind = (e as { kind?: string }).kind
      return kind === undefined || kind === 'EntitySet'
    })
    .map((e) => String((e as { name?: string }).name ?? ''))
    .filter(Boolean)
}

function firstRecord(body: unknown): Record<string, unknown> | null {
  const val = (body as { value?: unknown })?.value
  if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
    return val[0] as Record<string, unknown>
  }
  if (body && typeof body === 'object' && !Array.isArray(body) && !('value' in (body as object))) {
    return body as Record<string, unknown>
  }
  return null
}

function snippet(body: unknown, n = 200): string {
  const s = typeof body === 'string' ? body : JSON.stringify(body)
  return (s ?? '').replace(/\s+/g, ' ').slice(0, n)
}

function printRecordFields(rec: Record<string, unknown>) {
  const keys = Object.keys(rec).filter((k) => !k.startsWith('@odata'))
  console.log(`   alan sayısı: ${keys.length}`)
  for (const k of keys) {
    let v = rec[k]
    if (v && typeof v === 'object') v = JSON.stringify(v)
    let sv = String(v ?? '')
    if (sv.length > 60) sv = sv.slice(0, 59) + '…'
    console.log(`     ${k.padEnd(28)} = ${sv}`)
  }
  // İlgi alanları işareti
  const present = FIELD_INTEREST.filter((f) => f in rec)
  const dates = keys.filter(isDateField)
  console.log(`   ⚑ İlgi alanları: ${present.join(', ') || '(yok)'}`)
  console.log(`   ⚑ Tarih alanları: ${dates.join(', ') || '(yok)'}`)
}

// ───────────────────────────── main
async function main() {
  console.log('═'.repeat(78))
  console.log('IFS PROJEKSİYON KEŞFİ (SALT OKUMA)')
  console.log(`int  kök: ${INT_ROOT}`)
  console.log(`main kök: ${MAIN_ROOT}`)
  console.log(`contract: ${CONTRACT}`)
  console.log('═'.repeat(78))

  const found403: string[] = []
  const found200: string[] = []

  for (const cand of CANDIDATES) {
    for (const gw of GATEWAYS) {
      const svcUrl = `${gw.root}${cand}.svc/`
      const { status, body } = await ifsGet(svcUrl)
      const tag = `${gw.name}/${cand}`
      const verdict =
        status === 200 ? '200 VAR+YETKİLİ' :
        status === 403 ? '403 VAR ama İZİN YOK' :
        status === 404 ? '404 YOK' :
        status === 401 ? '401 AUTH' :
        `${status}`
      console.log(`\n── ${tag} → ${verdict}`)
      if (status === 403) found403.push(tag)
      if (status !== 200) {
        if (status !== 404 && status !== -1) console.log(`   body: ${snippet(body)}`)
        if (status === -1) console.log(`   ${snippet(body)}`)
        continue
      }
      found200.push(tag)

      // a) entity set'ler
      const sets = entitySetsOf(body)
      // Uzun Reference_ listesini kısalt: sadece ana (non-Reference) setleri göster.
      const primarySets = sets.filter((s) => !/^(Reference_|Lookup_|FndTempLobs)/.test(s))
      console.log(`   entity set toplam: ${sets.length} (ana/non-Reference: ${primarySets.length})`)
      console.log(`   ana setler: ${primarySets.join(', ') || '(yok)'}`)
      const pick = pickEntitySet(sets, cand)
      if (!pick) {
        console.log('   ⚠ uygun entity set bulunamadı')
        continue
      }

      // b) $top=1 → tüm alanlar
      console.log(`   → örnek kayıt: ${pick}?$top=1`)
      const top1 = await ifsGet(`${gw.root}${cand}.svc/${pick}?$top=1`)
      console.log(`     status: ${top1.status}`)
      if (top1.status === 200) {
        const rec = firstRecord(top1.body)
        if (rec) printRecordFields(rec)
        else console.log(`     kayıt yok / boş. body: ${snippet(top1.body, 160)}`)
      } else {
        console.log(`     body: ${snippet(top1.body, 200)}`)
      }

      // d) parça-tipi: Contract filtreli 3 örnek
      if (/InventoryPart|PartCatalog|Parts/i.test(cand)) {
        const filter = encodeURIComponent(`Contract eq '${CONTRACT}'`)
        const url = `${gw.root}${cand}.svc/${pick}?$filter=${filter}&$top=3`
        console.log(`   → parça (Contract=${CONTRACT}) örnekleri: ${pick}?$filter=Contract eq '${CONTRACT}'&$top=3`)
        const pf = await ifsGet(url)
        console.log(`     status: ${pf.status}`)
        const val = (pf.body as { value?: unknown })?.value
        if (pf.status === 200 && Array.isArray(val)) {
          console.log(`     dönen kayıt: ${val.length}`)
          val.slice(0, 3).forEach((r, i) => {
            const rr = r as Record<string, unknown>
            const desc = rr.Description ?? rr.PartDescription ?? rr.PartDescr ?? ''
            console.log(`       [${i}] PartNo=${rr.PartNo ?? rr.PartId ?? '?'} · Desc=${String(desc).slice(0, 50)}`)
          })
        } else {
          console.log(`     body: ${snippet(pf.body, 200)}`)
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(78)}`)
  console.log('ÖZET')
  console.log('═'.repeat(78))
  console.log(`200 (var+yetkili): ${found200.join(', ') || '(yok)'}`)
  console.log(`403 (izin gerekli): ${found403.join(', ') || '(yok)'}`)
  console.log('\n✅ Keşif tamam (salt okuma).')
}

main().catch((e) => {
  console.error('\n❌ Üst-seviye hata:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
