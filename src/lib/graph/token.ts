/**
 * Microsoft Graph — uygulama (app-only) access token.
 *
 * ÜÇÜNCÜ KOPYA UYARISI: aynı client_credentials akışı src/lib/azure-ad.ts:21 ve
 * src/lib/microsoft-calendar.ts:75'te de var. İkisi de private, ikisinde de cache
 * YOK ve ikisi de hatayı yutuyor. Onlara bu işte KASITLI olarak dokunulmadı
 * (dizin/takvim akışlarını riske atmamak için) — birleştirme AYRI İŞ.
 * Yeni Graph tüketicileri bu dosyayı kullanmalı.
 *
 * Bu kopyanın iki farkı:
 *   1. CACHE'Lİ — token exp'e 5 dk kala yenilenir. Mail cron'u her turda
 *      onlarca istek atacağı için her seferinde token almak anlamsız.
 *   2. HATAYI YUTMAZ — Azure'un ham yanıtı çağırana ulaşır. Eski kopyalarda
 *      hata console'a yazılıp jenerik "Failed to get access token"a çevriliyor;
 *      izin/politika sorunları böyle görünmez oluyor.
 */

const TOKEN_SCOPE = 'https://graph.microsoft.com/.default'

/** exp'e bu kadar kala token yenilenir (ms). */
const YENILEME_PAYI_MS = 5 * 60 * 1000

interface OnbellekKaydi {
  token: string
  /** Epoch ms — Azure'un expires_in'inden türetilir. */
  gecerlilikSonu: number
}

let onbellek: OnbellekKaydi | null = null

export class GraphTokenHatasi extends Error {
  constructor(
    message: string,
    readonly httpDurum: number | null,
    readonly hamGovde: string | null,
  ) {
    super(message)
    this.name = 'GraphTokenHatasi'
  }
}

/** Test/teşhis için önbelleği boşaltır. Üretim akışında çağrılmaz. */
export function graphTokenOnbellekTemizle(): void {
  onbellek = null
}

/**
 * Geçerli bir app-only token döner. Önbellekte tazesi varsa onu kullanır.
 *
 * @throws GraphTokenHatasi — env eksikse ya da Azure hata dönerse. Ham gövde
 *   hatanın içinde taşınır; çağıran loglayabilir.
 */
export async function graphToken(): Promise<string> {
  const simdi = Date.now()
  if (onbellek && onbellek.gecerlilikSonu > simdi) {
    return onbellek.token
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  const eksik = [
    !tenantId && 'AZURE_AD_TENANT_ID',
    !clientId && 'AZURE_AD_CLIENT_ID',
    !clientSecret && 'AZURE_AD_CLIENT_SECRET',
  ].filter(Boolean)
  if (eksik.length > 0) {
    throw new GraphTokenHatasi(`Azure AD yapılandırması eksik: ${eksik.join(', ')}`, null, null)
  }

  const govde = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    scope: TOKEN_SCOPE,
    grant_type: 'client_credentials',
  })

  const yanit = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: govde.toString(),
  })

  const ham = await yanit.text()
  if (!yanit.ok) {
    throw new GraphTokenHatasi(
      `Graph token alınamadı (HTTP ${yanit.status})`,
      yanit.status,
      ham.slice(0, 1000),
    )
  }

  let cozulmus: { access_token?: string; expires_in?: number }
  try {
    cozulmus = JSON.parse(ham)
  } catch {
    throw new GraphTokenHatasi('Graph token yanıtı JSON değil', yanit.status, ham.slice(0, 1000))
  }

  if (!cozulmus.access_token) {
    throw new GraphTokenHatasi('Graph token yanıtında access_token yok', yanit.status, ham.slice(0, 1000))
  }

  // expires_in saniye. Payı düştükten sonra negatife düşerse önbelleğe hiç
  // yazmayız — her çağrıda taze alınır, yanlış "hâlâ geçerli" kararından iyidir.
  const omurMs = (cozulmus.expires_in ?? 3600) * 1000
  const gecerlilikSonu = simdi + omurMs - YENILEME_PAYI_MS
  onbellek = gecerlilikSonu > simdi ? { token: cozulmus.access_token, gecerlilikSonu } : null

  return cozulmus.access_token
}

/** Graph kök adresi. .env'deki mevcut değişken kullanılır. */
export function graphKok(): string {
  return process.env.GRAPH_API_ENDPOINT || 'https://graph.microsoft.com/v1.0'
}
