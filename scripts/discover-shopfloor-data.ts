/**
 * IFS TEST ortamı shop-floor veri keşfi — SALT OKUMA.
 *
 * Usage:
 *   npx tsx scripts/discover-shopfloor-data.ts
 *   (env .env'den dotenv ile yüklenir)
 *
 * SADECE read çağrıları: GetPlannedOperations, GetOperationSummary.
 * Hiçbir yazma aksiyonu (ReportQuantity*, StartOperation, ReceiveOrder) çağrılmaz.
 *
 * NOT: src/lib/ifs/* modülleri `import 'server-only'` içerdiği için düz node (tsx)
 * bağlamında doğrudan import edilemez. Bu script, shop-floor.ts'teki okuma desenini
 * (config → token(client_credentials) → ifsGetFunction → 6-parametreli OData imzası)
 * BİREBİR replike eder; shop-floor.ts DEĞİŞTİRİLMEZ.
 */
import 'dotenv/config'

// ───────────────────────────────────────────── config (config.ts deseni)
interface IfsConfig {
  baseUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
  contract: string
}

function getIfsConfig(): IfsConfig {
  const req = (k: string): string => {
    const v = process.env[k]
    if (!v || !v.trim()) throw new Error(`IFS env eksik: ${k}`)
    return v
  }
  return {
    baseUrl: req('IFS_INT_BASE_URL').replace(/\/+$/, ''),
    tokenUrl: req('IFS_TOKEN_URL'),
    clientId: req('IFS_CLIENT_ID'),
    clientSecret: req('IFS_CLIENT_SECRET'),
    scope: process.env.IFS_SCOPE,
    contract: process.env.IFS_CONTRACT?.trim() || 'ILER2',
  }
}

// ───────────────────────────────────────────── token (token.ts deseni)
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token
  const cfg = getIfsConfig()
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (cfg.scope) body.set('scope', cfg.scope)
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`IFS token alınamadı (HTTP ${res.status}): ${text.slice(0, 500)}`)
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error('IFS token cevabında access_token yok')
  const ttl = typeof json.expires_in === 'number' ? json.expires_in : 300
  cachedToken = { token: json.access_token, expiresAt: Date.now() + ttl * 1000 }
  return json.access_token
}

// ───────────────────────────────────────────── client (client.ts deseni)
class IfsHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`IFS HTTP ${status}`)
    this.name = 'IfsHttpError'
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function ifsGetFunction<T = unknown>(funcCall: string): Promise<T> {
  const cfg = getIfsConfig()
  const token = await getAccessToken()
  const res = await fetch(`${cfg.baseUrl}/${funcCall}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const body = await parseBody(res)
  if (!res.ok) throw new IfsHttpError(res.status, body)
  return body as T
}

// ───────────────────────────────────────────── shop-floor read wrappers (shop-floor.ts deseni)
function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

async function getPlannedOperations(args: {
  contract: string
  selection: 'EXECUTABLE' | 'RELEASED'
  workCenter?: string | null
  resource?: string | null
  laborClass?: string | null
  partNo?: string | null
}): Promise<string[]> {
  const lit = (v: string | null | undefined) => (v != null ? odataString(v) : 'null')
  const params = [
    `Contract=${odataString(args.contract)}`,
    `Selection=${odataString(args.selection)}`,
    `WorkCenter=${lit(args.workCenter)}`,
    `Resource=${lit(args.resource)}`,
    `LaborClass=${lit(args.laborClass)}`,
    `PartNo=${lit(args.partNo)}`,
  ]
  const res = await ifsGetFunction<{ value?: unknown }>(`GetPlannedOperations(${params.join(',')})`)
  return Array.isArray(res?.value) ? res.value.map((v) => String(v)) : []
}

async function getOperationSummary(args: {
  contract: string
  operationId?: number
  orderNo?: string
  releaseNo?: string
  sequenceNo?: string
  operationNo?: number
}): Promise<Record<string, unknown>> {
  const params = [
    `Contract=${odataString(args.contract)}`,
    `OperationId=${args.operationId != null ? args.operationId : 'null'}`,
    `OrderNo=${args.orderNo != null ? odataString(args.orderNo) : 'null'}`,
    `ReleaseNo=${odataString(args.releaseNo ?? '*')}`,
    `SequenceNo=${odataString(args.sequenceNo ?? '*')}`,
    `OperationNo=${args.operationNo != null ? args.operationNo : 'null'}`,
  ]
  return ifsGetFunction<Record<string, unknown>>(`GetOperationSummary(${params.join(',')})`)
}

// ───────────────────────────────────────────── yardımcılar
function fmtErr(e: unknown): string {
  if (e instanceof IfsHttpError) {
    return `IfsHttpError HTTP ${e.status} — body: ${JSON.stringify(e.body)}`
  }
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
}

/** Summary cevabında kayıt objesini bul (üstte mi, value içinde mi). */
function pickRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const v = raw?.value
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v[0] as Record<string, unknown>
  return raw
}

function g(rec: Record<string, unknown>, key: string): string {
  const val = rec[key]
  if (val == null) return ''
  return String(val)
}

function pad(s: string, n: number): string {
  const t = s.length > n ? s.slice(0, n - 1) + '…' : s
  return t.padEnd(n)
}

// ───────────────────────────────────────────── main
async function main() {
  const cfg = getIfsConfig()
  console.log('═'.repeat(70))
  console.log('IFS SHOP-FLOOR VERİ KEŞFİ (SALT OKUMA)')
  console.log(`baseUrl : ${cfg.baseUrl}`)
  console.log(`contract: ${cfg.contract}`)
  console.log('═'.repeat(70))

  const combos: { label: string; args: Parameters<typeof getPlannedOperations>[0] }[] = [
    { label: 'a) workCenter=—, selection=EXECUTABLE', args: { contract: cfg.contract, selection: 'EXECUTABLE' } },
    { label: 'b) workCenter=—, selection=RELEASED', args: { contract: cfg.contract, selection: 'RELEASED' } },
    { label: 'c) workCenter=WMM01, selection=EXECUTABLE', args: { contract: cfg.contract, selection: 'EXECUTABLE', workCenter: 'WMM01' } },
  ]

  const allIds = new Set<string>()

  for (const c of combos) {
    console.log(`\n── ${c.label} ──`)
    try {
      const ids = await getPlannedOperations(c.args)
      console.log(`   dönen ID sayısı: ${ids.length}`)
      console.log(`   ilk 10 ID: ${ids.slice(0, 10).join(', ') || '(yok)'}`)
      ids.forEach((id) => allIds.add(id))
    } catch (e) {
      console.log(`   ❌ HATA (yutulmadı): ${fmtErr(e)}`)
    }
  }

  const idList = Array.from(allIds).slice(0, 20)
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`BENZERSİZ ID: ${allIds.size} adet (summary için ilk ${idList.length} çekilecek)`)
  console.log('═'.repeat(70))

  if (idList.length === 0) {
    console.log('Hiç operationId dönmedi — summary çekilecek kayıt yok.')
    return
  }

  // Tablo başlığı
  const header =
    pad('operationId', 12) +
    pad('orderNo', 12) +
    pad('opNo', 6) +
    pad('description', 26) +
    pad('status', 14) +
    pad('partNo', 12) +
    pad('planQty', 9) +
    pad('execQty', 9) +
    pad('remQty', 9) +
    pad('compQty', 9) +
    pad('scrapQty', 9)
  console.log('\n' + header)
  console.log('─'.repeat(header.length))

  let firstRaw: { id: string; raw: Record<string, unknown> } | null = null

  for (const id of idList) {
    try {
      const raw = await getOperationSummary({ contract: cfg.contract, operationId: Number(id) })
      const rec = pickRecord(raw)
      if (!firstRaw) firstRaw = { id, raw }
      console.log(
        pad(id, 12) +
          pad(g(rec, 'OrderNo'), 12) +
          pad(g(rec, 'OperationNo'), 6) +
          pad(g(rec, 'Description'), 26) +
          pad(g(rec, 'Status'), 14) +
          pad(g(rec, 'PartNo'), 12) +
          pad(g(rec, 'PlannedQty'), 9) +
          pad(g(rec, 'ExecutableQty'), 9) +
          pad(g(rec, 'RemainingQty'), 9) +
          pad(g(rec, 'QtyCompleted'), 9) +
          pad(g(rec, 'QtyScrapped'), 9),
      )
    } catch (e) {
      console.log(pad(id, 12) + `❌ ${fmtErr(e)}`)
    }
  }

  // Bilinen alanlar dışında ne geliyor? — bir örnek kaydın TAM ham JSON'ı
  console.log(`\n${'═'.repeat(70)}`)
  console.log('ÖRNEK KAYIT — TAM HAM JSON (bilinmeyen/map’lenmeyen alanları görmek için)')
  console.log('═'.repeat(70))
  if (firstRaw) {
    console.log(`operationId=${firstRaw.id} ham cevap:`)
    console.log(JSON.stringify(firstRaw.raw, null, 2))

    const rec = pickRecord(firstRaw.raw)
    const known = new Set([
      'OrderNo', 'OperationNo', 'Description', 'Status', 'PartNo',
      'PlannedQty', 'ExecutableQty', 'RemainingQty', 'QtyCompleted', 'QtyScrapped',
    ])
    const extra = Object.keys(rec).filter((k) => !known.has(k) && !k.startsWith('@odata'))
    console.log(`\nBilinen alanlar DIŞINDA gelen anahtarlar (${extra.length}): ${extra.join(', ') || '(yok)'}`)
  } else {
    console.log('Hiçbir summary başarıyla çekilemedi — ham JSON yok.')
  }

  console.log('\n✅ Keşif tamam (salt okuma).')
}

main().catch((e) => {
  console.error('\n❌ Script üst-seviye hata (yutulmadı):', fmtErr(e))
  process.exit(1)
})
