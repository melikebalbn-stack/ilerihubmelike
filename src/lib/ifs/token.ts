import 'server-only'
import { getIfsConfig } from './config'

/**
 * IFS Cloud OAuth2 access token yönetimi (Keycloak client_credentials).
 * SERVER-ONLY.
 *
 * - Token in-memory cache'lenir; bitimine ~60s kala yenilenir.
 * - Eşzamanlı çağrılarda tek in-flight promise paylaşılır (token fırtınası olmaz).
 */

interface CachedToken {
  token: string
  /** epoch ms — token'ın geçerlilik sonu. */
  expiresAt: number
}

/** Süre dolmadan ~60s önce yenile. */
const EXPIRY_SKEW_MS = 60_000
/** expires_in cevabı yoksa varsayılan ömür (sn). */
const DEFAULT_TTL_SEC = 300

let tokenCache: CachedToken | null = null
let inFlight: Promise<string> | null = null

interface TokenResponse {
  access_token?: string
  expires_in?: number
  token_type?: string
}

async function fetchToken(): Promise<string> {
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

  const json = (await res.json()) as TokenResponse
  if (!json.access_token) {
    throw new Error('IFS token cevabında access_token bulunamadı')
  }

  const ttlSec = typeof json.expires_in === 'number' ? json.expires_in : DEFAULT_TTL_SEC
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + ttlSec * 1000,
  }
  return json.access_token
}

/**
 * Geçerli bir IFS access token döndürür (cache'ten veya yenileyerek).
 */
export async function getIfsAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt - EXPIRY_SKEW_MS > now) {
    return tokenCache.token
  }

  // Zaten devam eden bir yenileme varsa ona katıl (tek in-flight).
  if (inFlight) return inFlight

  inFlight = fetchToken().finally(() => {
    inFlight = null
  })
  return inFlight
}
