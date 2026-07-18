/**
 * IFS depo/stok/taşıma projeksiyon keşfi — SALT OKUMA (GET). EL-3a.
 *
 * Usage:
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/discover-depo-projections.ts
 *
 * SADECE: service document GET, entity $top sorgusu, $metadata GET.
 * HİÇBİR POST/aksiyon/taşıma ÇAĞRILMAZ — taşıma action'ları yalnız metadata'dan
 * imza olarak tespit edilir. Auth/token deseni discover-projections.ts ile aynı.
 */
import 'dotenv/config'

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
const INT_ROOT = env('IFS_INT_BASE_URL').replace(/[A-Za-z]+\.svc\/?$/, '')
const MAIN_ROOT = INT_ROOT.replace('/int/', '/main/')

let cachedToken: { token: string; expiresAt: number } | null = null
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token
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
  if (!res.ok) throw new Error(`token HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('access_token yok')
  cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 300) * 1000 }
  return j.access_token
}

async function ifsGet(url: string, accept = 'application/json'): Promise<{ status: number; body: unknown; text: string }> {
  const token = await getAccessToken()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: accept },
      cache: 'no-store',
    })
  } catch (e) {
    return { status: -1, body: `fetch failed: ${e instanceof Error ? e.message : String(e)}`, text: '' }
  }
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değil (XML metadata vb.) */
  }
  return { status: res.status, body, text }
}

const CANDIDATES = [
  'InventoryPartInStockHandling',
  'InventoryPartsInStockHandling',
  'HandlingUnitsHandling',
  'InventoryLocationsHandling',
  'InventoryLocationHandling',
  'WarehouseNavigatorHandling',
  'MoveInventoryPartHandling',
  'InventoryPartInStockLocationHandling',
  'CountingResultsHandling',
]
const GATEWAYS = [
  { name: 'main', root: MAIN_ROOT },
  { name: 'int', root: INT_ROOT },
]

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
function primaryOf(sets: string[]): string[] {
  return sets.filter((s) => !/^(Reference_|Lookup_|FndTempLobs)/.test(s))
}
function snippet(b: unknown, n = 200): string {
  const s = typeof b === 'string' ? b : JSON.stringify(b)
  return (s ?? '').replace(/\s+/g, ' ').slice(0, n)
}

const STOK_INTEREST =
  /PartNo|Description|LocationNo|LotBatchNo|SerialNo|QtyOnhand|QtyAvailable|AvailableQty|Warehouse|Bay|Row|Tier|Bin|HandlingUnit/i

// ─────────────────────────────────────────── BÖLÜM 1 + 2 + 4
async function taraVeStok() {
  const okList: { tag: string; root: string; proj: string; sets: string[] }[] = []
  console.log('═'.repeat(80))
  console.log('BÖLÜM 1 — PROJEKSİYON TARAMA')
  console.log(`main: ${MAIN_ROOT}`)
  console.log('═'.repeat(80))

  for (const proj of CANDIDATES) {
    let matched = false
    for (const gw of GATEWAYS) {
      const r = await ifsGet(`${gw.root}${proj}.svc/`)
      const verdict =
        r.status === 200 ? '200 VAR+YETKİLİ' :
        r.status === 403 ? '403 İZİN YOK' :
        r.status === 404 ? '404 YOK' : `${r.status}`
      // 404'te diğer gateway'i dene; 200/403 ise bu gateway'i kaydet ve dur
      if (r.status === 404) {
        console.log(`\n── ${gw.name}/${proj} → 404 YOK`)
        continue
      }
      console.log(`\n── ${gw.name}/${proj} → ${verdict}`)
      matched = true
      if (r.status === 200) {
        const sets = entitySetsOf(r.body)
        const primary = primaryOf(sets)
        console.log(`   entity set: toplam ${sets.length} | ana: ${primary.join(', ') || '(yok)'}`)
        okList.push({ tag: `${gw.name}/${proj}`, root: gw.root, proj, sets })
      } else {
        console.log(`   body: ${snippet(r.body)}`)
      }
      break
    }
    if (!matched) {
      // her iki gateway de 404
    }
  }

  // Bölüm 1b + 2: 200 dönenlerde ana entity'ye $top sorgusu
  console.log(`\n${'═'.repeat(80)}`)
  console.log('BÖLÜM 1b/2 — STOK/LOKASYON ENTITY SORGULARI')
  console.log('═'.repeat(80))

  const lotDolu: string[] = []

  for (const ok of okList) {
    const primary = primaryOf(ok.sets)
    // stok/lokasyon ile ilgili en olası ana entity
    const pick =
      primary.find((s) => /InStock|InventoryPartInStock|StockLocation/i.test(s)) ??
      primary.find((s) => /Location|Warehouse|HandlingUnit|Bay|Bin/i.test(s)) ??
      primary.find((s) => !/Virtual|Lov|Set$/i.test(s)) ??
      primary[0]
    if (!pick) {
      console.log(`\n[${ok.tag}] uygun entity yok`)
      continue
    }
    console.log(`\n[${ok.tag}] entity: ${pick}`)

    // $top=1 alan adları
    const one = await ifsGet(`${ok.root}${ok.proj}.svc/${pick}?$top=1`)
    console.log(`  $top=1 → HTTP ${one.status}`)
    if (one.status !== 200) {
      console.log(`    ${snippet(one.body, 160)}`)
    } else {
      const rec = ((one.body as { value?: unknown[] })?.value ?? [])[0] as Record<string, unknown> | undefined
      if (!rec) {
        console.log('    (kayıt yok / boş)')
      } else {
        const keys = Object.keys(rec).filter((k) => !k.startsWith('@odata'))
        const interest = keys.filter((k) => STOK_INTEREST.test(k))
        console.log(`    alan sayısı: ${keys.length}`)
        console.log(`    ⚑ İLGİLİ alanlar: ${interest.join(', ') || '(yok)'}`)
      }
    }

    // Bölüm 2: Contract filtreli 10 kayıt (stok tablosu + LocationNo gözlemi)
    const filter = encodeURIComponent(`Contract eq '${CONTRACT}'`)
    const many = await ifsGet(`${ok.root}${ok.proj}.svc/${pick}?$filter=${filter}&$top=10`)
    console.log(`  Contract=${CONTRACT} $top=10 → HTTP ${many.status}`)
    if (many.status === 200) {
      const rows = ((many.body as { value?: unknown[] })?.value ?? []) as Record<string, unknown>[]
      console.log(`    dönen kayıt: ${rows.length}`)
      const g = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) if (r[k] != null && r[k] !== '') return String(r[k])
        return ''
      }
      rows.slice(0, 10).forEach((r, i) => {
        const loc = g(r, 'LocationNo', 'Location', 'InventoryLocationNo')
        const lot = g(r, 'LotBatchNo', 'LotNo')
        const struct = ['WarehouseId', 'BayNo', 'BayId', 'RowNo', 'RowId', 'TierNo', 'BinNo']
          .map((k) => (r[k] != null && r[k] !== '' ? `${k}=${r[k]}` : null))
          .filter(Boolean)
          .join(' ')
        console.log(
          `    [${i}] PartNo=${g(r, 'PartNo')} Loc=${loc} Lot=${lot} ` +
            `Qty=${g(r, 'QtyOnhand', 'QuantityOnhand', 'QtyAvailable', 'AvailableQty')} ` +
            `Desc=${g(r, 'PartDescription', 'Description').slice(0, 24)}${struct ? ' | ' + struct : ''}`,
        )
        if (lot) lotDolu.push(`${ok.tag}: ${g(r, 'PartNo')} lot=${lot}`)
      })
    } else {
      console.log(`    ${snippet(many.body, 160)}`)
    }
  }

  // Bölüm 4
  console.log(`\n${'═'.repeat(80)}`)
  console.log('BÖLÜM 4 — LOT DURUMU')
  console.log('═'.repeat(80))
  if (lotDolu.length) {
    console.log(`LotBatchNo dolu kayıt VAR (${lotDolu.length}):`)
    lotDolu.slice(0, 10).forEach((l) => console.log('  ' + l))
  } else {
    console.log('LotBatchNo dolu kayıt bulunamadı (bu sorgu setinde).')
  }

  return okList
}

// ─────────────────────────────────────────── BÖLÜM 3 — metadata action taraması
async function metadataActions(okList: { tag: string; root: string; proj: string }[]) {
  console.log(`\n${'═'.repeat(80)}`)
  console.log('BÖLÜM 3 — TAŞIMA ACTION TESPİTİ (SADECE METADATA, ÇAĞRILMADI)')
  console.log('═'.repeat(80))

  // 200 dönen stok projeksiyonları + ShopFloorService
  const targets = [
    ...okList.map((o) => ({ tag: o.tag, url: `${o.root}${o.proj}.svc/$metadata` })),
    { tag: 'int/ShopFloorService', url: `${INT_ROOT}ShopFloorService.svc/$metadata` },
    { tag: 'main/ShopFloorService', url: `${MAIN_ROOT}ShopFloorService.svc/$metadata` },
  ]
  const ACTION_RE = /<(?:Action|Function)\s+Name="([^"]*(?:Move|Transfer|ChangeLocation|MovePart|Relocat)[^"]*)"[\s\S]*?<\/(?:Action|Function)>/gi
  const PARAM_RE = /<Parameter\s+Name="([^"]+)"[^>]*?Type="([^"]+)"/g

  for (const t of targets) {
    const r = await ifsGet(t.url, 'application/xml')
    if (r.status !== 200) {
      console.log(`\n[${t.tag}] $metadata → HTTP ${r.status} (atlandı)`)
      continue
    }
    const xml = r.text
    const found: string[] = []
    let m: RegExpExecArray | null
    ACTION_RE.lastIndex = 0
    while ((m = ACTION_RE.exec(xml)) !== null) {
      const block = m[0]
      const name = m[1]
      const params: string[] = []
      let p: RegExpExecArray | null
      PARAM_RE.lastIndex = 0
      while ((p = PARAM_RE.exec(block)) !== null) {
        params.push(`${p[1]}:${p[2].replace('Edm.', '')}`)
      }
      found.push(`${name}(${params.join(', ')})`)
    }
    console.log(`\n[${t.tag}] $metadata → 200 (len ${xml.length}) | Move/Transfer action: ${found.length}`)
    found.forEach((f) => console.log('   • ' + f))
  }
}

async function main() {
  const okList = await taraVeStok()
  await metadataActions(okList)
  console.log('\n✅ Keşif tamam (salt okuma, hiçbir aksiyon çağrılmadı).')
}

main().catch((e) => {
  console.error('\n❌ Üst-seviye hata:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
