/**
 * ShopOrderOperationsHandling grant doğrulaması — SALT OKUMA (GET).
 *
 * Usage:
 *   NODE_EXTRA_CA_CERTS=/home/rokunet/certs/rapidssl-tls-rsa-ca-g1.pem \
 *     npx tsx scripts/verify-shoporder-grant.ts
 *
 * Auth/token deseni discover-projections.ts ile aynı (server-only import edilemez).
 * IFS test sunucusu RapidSSL ara-CA → NODE_EXTRA_CA_CERTS gerekir.
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
const MAIN_ROOT = env('IFS_INT_BASE_URL')
  .replace(/[A-Za-z]+\.svc\/?$/, '')
  .replace('/int/', '/main/')
const SVC = `${MAIN_ROOT}ShopOrderOperationsHandling.svc/ShopOrderOperations`

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

async function ifsGet(url: string): Promise<{ status: number; body: unknown }> {
  const token = await getAccessToken()
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değil */
  }
  return { status: res.status, body }
}

const FILTER = encodeURIComponent(`Contract eq '${CONTRACT}'`)

function rows(body: unknown): Record<string, unknown>[] {
  const v = (body as { value?: unknown })?.value
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}
function pad(s: unknown, n: number): string {
  let t = String(s ?? '')
  if (t.length > n) t = t.slice(0, n - 1) + '…'
  return t.padEnd(n)
}

async function main() {
  console.log('═'.repeat(80))
  console.log('ShopOrderOperationsHandling GRANT DOĞRULAMA (SALT OKUMA)')
  console.log(`entity : ${SVC}`)
  console.log(`contract: ${CONTRACT}`)
  console.log('═'.repeat(80))

  // 1) $top=5
  const url5 = `${SVC}?$filter=${FILTER}&$top=5`
  const r5 = await ifsGet(url5)
  console.log(`\n[1] GET ?$filter=Contract eq '${CONTRACT}'&$top=5 → HTTP ${r5.status}`)

  if (r5.status !== 200) {
    console.log('❌ 200 DEĞİL — IFS hata gövdesi (aynen):')
    console.log(typeof r5.body === 'string' ? r5.body : JSON.stringify(r5.body, null, 2))
    console.log('\nGrant hâlâ yok. Duruyorum.')
    return
  }

  // 2) 5 kayıt tablosu
  const cols: { key: string; w: number }[] = [
    { key: 'OrderNo', w: 9 },
    { key: 'OperationNo', w: 6 },
    { key: 'OperationDescription', w: 20 },
    { key: 'PartNo', w: 12 },
    { key: 'PartDescription', w: 22 },
    { key: 'WorkCenterNo', w: 10 },
    { key: 'RevisedQtyDue', w: 8 },
    { key: 'QtyComplete', w: 8 },
    { key: 'QtyScrapped', w: 8 },
    { key: 'RemainingQty', w: 8 },
    { key: 'RevisedDueDate', w: 22 },
    { key: 'OperStatusCode', w: 14 },
    { key: 'OperStatusCodeValue', w: 16 },
  ]
  const recs = rows(r5.body)
  console.log(`\n[2] İlk ${recs.length} kayıt:`)
  const header = cols.map((c) => pad(c.key, c.w)).join(' ')
  console.log(header)
  console.log('─'.repeat(header.length))
  for (const rec of recs) {
    console.log(cols.map((c) => pad(rec[c.key], c.w)).join(' '))
  }

  // 3) $top=50 → status dağılımı
  const r50 = await ifsGet(`${SVC}?$filter=${FILTER}&$top=50`)
  console.log(`\n[3] Status dağılımı (?$top=50 → HTTP ${r50.status}, ${rows(r50.body).length} kayıt):`)
  if (r50.status === 200) {
    const dist = new Map<string, number>()
    for (const rec of rows(r50.body)) {
      const key = `${rec.OperStatusCode ?? '?'} / ${rec.OperStatusCodeValue ?? '?'}`
      dist.set(key, (dist.get(key) ?? 0) + 1)
    }
    for (const [k, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${pad(k, 40)} : ${n}`)
    }

    // 4) benzersiz iş merkezleri
    const wcDist = new Map<string, number>()
    for (const rec of rows(r50.body)) {
      const wc = String(rec.WorkCenterNo ?? '(boş)')
      wcDist.set(wc, (wcDist.get(wc) ?? 0) + 1)
    }
    console.log(`\n[4] Benzersiz WorkCenterNo (${wcDist.size} adet):`)
    for (const [k, n] of [...wcDist.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${pad(k, 16)} : ${n} kayıt`)
    }
  } else {
    console.log('   (200 değil — dağılım çıkarılamadı)')
    console.log(typeof r50.body === 'string' ? r50.body : JSON.stringify(r50.body))
  }

  console.log('\n✅ Doğrulama tamam (salt okuma).')
}

main().catch((e) => {
  console.error('\n❌ Üst-seviye hata:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
