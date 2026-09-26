import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

/**
 * Hikvision ISAPI istemcisi (PDKS). HTTP Digest (RFC 7616, MD5 / MD5-sess, qop=auth).
 *
 * - Node fetch digest bilmez; ek paket YOK (tedarik zinciri) — bu dosya yeterli.
 * - Kimlik bilgisi DB'de TUTULMAZ: cihazın `envOnek`'i → process.env[<envOnek>_USER / _PASS].
 *   Kullanıcı adı/parola hiçbir hata mesajına, log'a veya yanıta YAZILMAZ.
 * - Tek çağrının TOPLAM süresi 10 sn (challenge + yetkili istek aynı bütçeden).
 * - Nonce önbelleği (host başına): sonraki istekler önceden yetkili gider, nc artar.
 *   401 gelirse (nonce bayat) taze challenge ile YALNIZ BİR KEZ yeniden denenir —
 *   Hikvision art arda başarısız girişte hesabı kilitler, döngü YOK.
 * - Şema: http (ISAPI 80). Host yalnız özel ağ IPv4 (+ port) — bkz. hostDogrula.
 */

const ZAMAN_ASIMI_MS = 10_000

export type IsapiHataKodu =
  | 'YAPILANDIRMA' // env'de kimlik bilgisi yok / host geçersiz
  | 'ZAMAN_ASIMI' // 10 sn içinde yanıt yok
  | 'BAGLANTI_REDDEDILDI' // ECONNREFUSED — host var, port kapalı
  | 'ULASILAMIYOR' // rota yok / DNS / ağ
  | 'KIMLIK' // digest sonrası hâlâ 401 — kullanıcı/parola yanlış veya hesap kilitli
  | 'YETKI' // 403 — hesabın bu uca yetkisi yok
  | 'HTTP' // diğer 4xx/5xx
  | 'GECERSIZ_YANIT' // beklenen alan yok / ayrıştırılamadı

export class IsapiHata extends Error {
  constructor(
    public readonly kod: IsapiHataKodu,
    mesaj: string,
    public readonly httpDurum?: number,
  ) {
    super(mesaj)
    this.name = 'IsapiHata'
  }
}

export interface IsapiCihaz {
  host: string
  envOnek: string
}

export interface IsapiYanit {
  durum: number
  icerikTipi: string
  metin: string
}

// ── Kimlik bilgisi (env) ─────────────────────────────────────────────────────

/** envOnek yalnız PDKS_CIHAZ_ ile başlayabilir — başka env değişkenlerinin okunmasını engeller. */
export const ENV_ONEK_DESENI = /^PDKS_CIHAZ_[A-Z0-9_]{1,40}$/

/** Cihaz kodundan env öneki: HIK-ANA-1 → PDKS_CIHAZ_HIK_ANA_1 */
export function envOnekTuret(kod: string): string {
  return 'PDKS_CIHAZ_' + kod.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function kimlikBilgisi(envOnek: string): { kullanici: string; parola: string } | null {
  if (!ENV_ONEK_DESENI.test(envOnek)) return null
  const kullanici = process.env[`${envOnek}_USER`]
  const parola = process.env[`${envOnek}_PASS`]
  if (!kullanici || !parola) return null
  return { kullanici, parola }
}

/** UI için: yalnız VAR/YOK bilgisi (değer asla dönmez). */
export function kimlikTanimliMi(envOnek: string): boolean {
  return kimlikBilgisi(envOnek) !== null
}

// ── Host doğrulama ───────────────────────────────────────────────────────────

/**
 * Yalnız özel ağ IPv4'ü (10/8, 172.16/12, 192.168/16) + isteğe bağlı port. Şema/yol YOK.
 * Panel ayrı VLAN'da IP ile adreslenir; hostname/genel IP kabul edilmez (SSRF: pdks.manage
 * yetkilisi istemciyi rastgele bir adrese digest göndermeye yönlendiremesin).
 */
export function hostDogrula(host: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?$/.exec(host.trim())
  if (!m) return 'Host "10.0.0.5" veya "10.0.0.5:80" biçiminde olmalı'
  const [a, b, c, d] = m.slice(1, 5).map(Number)
  if ([a, b, c, d].some((x) => x > 255)) return 'Geçersiz IPv4 adresi'
  const port = m[5] ? Number(m[5]) : 80
  if (port < 1 || port > 65535) return 'Geçersiz port'
  const ozel = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  if (!ozel) return 'Yalnız özel ağ adresi (10.x, 172.16-31.x, 192.168.x) kabul edilir'
  return null
}

// ── Digest ───────────────────────────────────────────────────────────────────

interface DigestChallenge {
  realm: string
  nonce: string
  opaque?: string
  qop?: string // yalnız 'auth' desteklenir
  algoritma: 'MD5' | 'MD5-sess'
  nc: number
}

/** host → son challenge (nonce yeniden kullanımı). Süreç belleğinde; PM2 yeniden başlarsa sıfırlanır. */
const challengeOnbellek = new Map<string, DigestChallenge>()

const md5 = (s: string) => createHash('md5').update(s).digest('hex')

/**
 * WWW-Authenticate başlığını ayrıştırır. Cihaz birden çok şema gönderebilir
 * ("Basic realm=..., Digest realm=...") — fetch bunları virgülle birleştirir; Digest
 * sonrasındaki İLK değerler alınır.
 */
export function digestAyristir(baslik: string | null): DigestChallenge | null {
  if (!baslik) return null
  const i = baslik.search(/digest\s/i)
  if (i < 0) return null
  const govde = baslik.slice(i + 7)
  const alanlar: Record<string, string> = {}
  for (const m of govde.matchAll(/([a-zA-Z]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/g)) {
    const ad = m[1].toLowerCase()
    if (!(ad in alanlar)) alanlar[ad] = m[2] ?? m[3] ?? ''
  }
  if (!alanlar.realm || !alanlar.nonce) return null
  const qopListe = (alanlar.qop ?? '').split(',').map((q) => q.trim())
  const alg = (alanlar.algorithm ?? 'MD5').toUpperCase()
  if (alg !== 'MD5' && alg !== 'MD5-SESS') return null
  return {
    realm: alanlar.realm,
    nonce: alanlar.nonce,
    opaque: alanlar.opaque,
    qop: qopListe.includes('auth') ? 'auth' : undefined,
    algoritma: alg === 'MD5-SESS' ? 'MD5-sess' : 'MD5',
    nc: 0,
  }
}

/** Authorization başlığını üretir; challenge.nc'yi artırır. */
export function digestBaslik(
  ch: DigestChallenge,
  kimlik: { kullanici: string; parola: string },
  method: string,
  uri: string,
  cnonce = randomBytes(8).toString('hex'),
): string {
  ch.nc += 1
  const nc = ch.nc.toString(16).padStart(8, '0')
  let ha1 = md5(`${kimlik.kullanici}:${ch.realm}:${kimlik.parola}`)
  if (ch.algoritma === 'MD5-sess') ha1 = md5(`${ha1}:${ch.nonce}:${cnonce}`)
  const ha2 = md5(`${method}:${uri}`)
  const yanit = ch.qop
    ? md5(`${ha1}:${ch.nonce}:${nc}:${cnonce}:${ch.qop}:${ha2}`)
    : md5(`${ha1}:${ch.nonce}:${ha2}`)
  const parcalar = [
    `username="${kimlik.kullanici}"`,
    `realm="${ch.realm}"`,
    `nonce="${ch.nonce}"`,
    `uri="${uri}"`,
    `algorithm=${ch.algoritma}`,
    `response="${yanit}"`,
  ]
  if (ch.opaque !== undefined) parcalar.push(`opaque="${ch.opaque}"`)
  if (ch.qop) parcalar.push(`qop=${ch.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  return `Digest ${parcalar.join(', ')}`
}

// ── Ağ hatası sınıflandırma ──────────────────────────────────────────────────

function agHatasi(e: unknown, host: string): IsapiHata {
  const ad = (e as { name?: string })?.name
  if (ad === 'TimeoutError' || ad === 'AbortError') {
    return new IsapiHata('ZAMAN_ASIMI', `${host} ${ZAMAN_ASIMI_MS / 1000} sn içinde yanıt vermedi`)
  }
  const neden = (e as { cause?: { code?: string; message?: string; errors?: { code?: string }[] } })?.cause
  // Çift yığın (happy eyeballs) denemelerinde kod AggregateError.errors[] içinde gelir.
  const kod = neden?.code ?? neden?.errors?.find((x) => x?.code)?.code ?? (e as { code?: string })?.code
  if (!kod && neden?.message === 'bad port') {
    return new IsapiHata('YAPILANDIRMA', `${host}: bu port fetch tarafından engelli (güvensiz port listesi) — ISAPI portunu kontrol edin`)
  }
  switch (kod) {
    case 'ECONNREFUSED':
      return new IsapiHata('BAGLANTI_REDDEDILDI', `${host} bağlantıyı reddetti (ECONNREFUSED) — port kapalı veya servis kapalı`)
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'ETIMEDOUT':
      return new IsapiHata('ZAMAN_ASIMI', `${host} bağlantı kurulamadı (zaman aşımı)`)
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
    case 'EHOSTDOWN':
      return new IsapiHata('ULASILAMIYOR', `${host} ağda ulaşılamıyor (${kod}) — VLAN/firewall kuralını kontrol edin`)
    case 'ECONNRESET':
    case 'UND_ERR_SOCKET':
      return new IsapiHata('ULASILAMIYOR', `${host} bağlantıyı kesti (${kod})`)
    default:
      return new IsapiHata('ULASILAMIYOR', `${host} erişilemedi${kod ? ` (${kod})` : ''}`)
  }
}

/** Hikvision hata gövdesi (JSON ya da XML ResponseStatus) → kısa açıklama. */
function hikvisionHataOzeti(metin: string): string {
  const alan = (ad: string) =>
    new RegExp(`"${ad}"\\s*:\\s*"?([^",}]+)`).exec(metin)?.[1] ??
    new RegExp(`<${ad}>([^<]*)</${ad}>`).exec(metin)?.[1]
  const parca = [alan('statusString'), alan('subStatusCode'), alan('errorMsg')].filter(Boolean)
  return parca.length ? parca.join(' / ').slice(0, 200) : ''
}

// ── İstek ────────────────────────────────────────────────────────────────────

export interface IsapiIstekSecenek {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** JSON gövde — string'e çevrilir (digest yeniden denemede tekrar gönderilebilsin diye akış değil). */
  json?: unknown
  /** Ham gövde (XML vb.) */
  govde?: string
  icerikTipi?: string
}

/**
 * ISAPI isteği. `yol` "/ISAPI/..." ile başlar (sorgu dizesi dahil). 2xx dışı yanıtlar IsapiHata fırlatır.
 */
export async function isapiIstek(
  cihaz: IsapiCihaz,
  yol: string,
  secenek: IsapiIstekSecenek = {},
): Promise<IsapiYanit> {
  if (!yol.startsWith('/ISAPI/')) throw new IsapiHata('YAPILANDIRMA', 'ISAPI yolu /ISAPI/ ile başlamalı')
  const hostHata = hostDogrula(cihaz.host)
  if (hostHata) throw new IsapiHata('YAPILANDIRMA', hostHata)
  const kimlik = kimlikBilgisi(cihaz.envOnek)
  if (!kimlik) {
    throw new IsapiHata(
      'YAPILANDIRMA',
      `Kimlik bilgisi tanımlı değil: sunucu .env'ine ${cihaz.envOnek}_USER ve ${cihaz.envOnek}_PASS eklenmeli`,
    )
  }

  const method = secenek.method ?? 'GET'
  const url = `http://${cihaz.host.trim()}${yol}`
  const govde = secenek.json !== undefined ? JSON.stringify(secenek.json) : secenek.govde
  const icerikTipi = secenek.json !== undefined ? 'application/json' : secenek.icerikTipi
  const sinyal = AbortSignal.timeout(ZAMAN_ASIMI_MS)

  const gonder = async (authorization?: string) => {
    const basliklar: Record<string, string> = {}
    if (authorization) basliklar.Authorization = authorization
    if (govde !== undefined && icerikTipi) basliklar['Content-Type'] = icerikTipi
    try {
      return await fetch(url, { method, headers: basliklar, body: govde, signal: sinyal, cache: 'no-store', redirect: 'manual' })
    } catch (e) {
      throw agHatasi(e, cihaz.host)
    }
  }

  const onbellekAnahtar = cihaz.host.trim()
  let ch = challengeOnbellek.get(onbellekAnahtar)
  let yanit = await gonder(ch ? digestBaslik(ch, kimlik, method, yol) : undefined)

  if (yanit.status === 401) {
    // Önbellekteki nonce bayat ya da ilk istek: taze challenge ile TEK yeniden deneme.
    await yanit.body?.cancel().catch(() => {})
    const taze = digestAyristir(yanit.headers.get('www-authenticate'))
    if (!taze) {
      challengeOnbellek.delete(onbellekAnahtar)
      throw new IsapiHata('KIMLIK', 'Cihaz Digest kimlik doğrulaması sunmadı (MD5/qop=auth bekleniyordu)', 401)
    }
    ch = taze
    challengeOnbellek.set(onbellekAnahtar, ch)
    yanit = await gonder(digestBaslik(ch, kimlik, method, yol))
    if (yanit.status === 401) {
      challengeOnbellek.delete(onbellekAnahtar)
      await yanit.body?.cancel().catch(() => {})
      throw new IsapiHata(
        'KIMLIK',
        'Kimlik doğrulama reddedildi — kullanıcı/parola yanlış ya da hesap kilitli (art arda denemeyin)',
        401,
      )
    }
  }

  let metin: string
  try {
    metin = await yanit.text()
  } catch (e) {
    throw agHatasi(e, cihaz.host)
  }
  if (yanit.status === 403) {
    throw new IsapiHata('YETKI', `Cihaz hesabının bu işleme yetkisi yok (403) ${hikvisionHataOzeti(metin)}`.trim(), 403)
  }
  if (yanit.status < 200 || yanit.status >= 300) {
    throw new IsapiHata('HTTP', `Cihaz HTTP ${yanit.status} döndü ${hikvisionHataOzeti(metin)}`.trim(), yanit.status)
  }
  return { durum: yanit.status, icerikTipi: yanit.headers.get('content-type') ?? '', metin }
}

// ── Yüksek seviye çağrılar ───────────────────────────────────────────────────

/** Basit XML/JSON alan okuyucu (ISAPI deviceInfo/time yanıtları düz ve küçük). */
export function alanOku(metin: string, ad: string): string | undefined {
  const xml = new RegExp(`<${ad}>([^<]*)</${ad}>`).exec(metin)?.[1]
  if (xml !== undefined) return xml.trim()
  const json = new RegExp(`"${ad}"\\s*:\\s*"([^"]*)"`).exec(metin)?.[1]
  return json?.trim()
}

export interface CihazBilgisi {
  cihazAdi?: string
  model?: string
  seriNo?: string
  firmware?: string
  firmwareTarihi?: string
  mac?: string
}

/** GET /ISAPI/System/deviceInfo */
export async function cihazBilgisiAl(cihaz: IsapiCihaz): Promise<CihazBilgisi> {
  const { metin } = await isapiIstek(cihaz, '/ISAPI/System/deviceInfo')
  const bilgi: CihazBilgisi = {
    cihazAdi: alanOku(metin, 'deviceName'),
    model: alanOku(metin, 'model'),
    seriNo: alanOku(metin, 'serialNumber'),
    firmware: alanOku(metin, 'firmwareVersion'),
    firmwareTarihi: alanOku(metin, 'firmwareReleasedDate'),
    mac: alanOku(metin, 'macAddress'),
  }
  if (!bilgi.model && !bilgi.seriNo) throw new IsapiHata('GECERSIZ_YANIT', 'deviceInfo yanıtında model/seri no yok')
  return bilgi
}

export interface CihazSaati {
  cihazSaatiHam: string
  saatModu?: string // NTP | manual
  sapmaSn: number // cihaz − sunucu (pozitif = cihaz ileride)
}

/**
 * GET /ISAPI/System/time → sunucu saatine göre sapma. İstek gidiş-dönüşünün ORTASI referans alınır.
 * localTime ofsetsiz gelirse (bazı firmware'ler ayrı <timeZone> verir) Europe/Istanbul (+03:00,
 * 2016'dan beri sabit) varsayılır.
 */
export async function cihazSaatiAl(cihaz: IsapiCihaz): Promise<CihazSaati> {
  const t0 = Date.now()
  const { metin } = await isapiIstek(cihaz, '/ISAPI/System/time')
  const t1 = Date.now()
  const ham = alanOku(metin, 'localTime')
  if (!ham) throw new IsapiHata('GECERSIZ_YANIT', 'time yanıtında localTime yok')
  const ofsetli = /([+-]\d{2}:?\d{2}|Z)$/.test(ham) ? ham : `${ham}+03:00`
  const cihazMs = Date.parse(ofsetli)
  if (Number.isNaN(cihazMs)) throw new IsapiHata('GECERSIZ_YANIT', `Cihaz saati ayrıştırılamadı: ${ham.slice(0, 40)}`)
  return {
    cihazSaatiHam: ham,
    saatModu: alanOku(metin, 'timeMode'),
    sapmaSn: Math.round((cihazMs - (t0 + t1) / 2) / 1000),
  }
}
