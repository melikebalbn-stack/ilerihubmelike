import 'server-only'
import { getIfsConfig } from '@/lib/ifs/config'
import { getIfsAccessToken } from '@/lib/ifs/token'
import { IfsHttpError } from '@/lib/ifs/client'
import { normalizeTr } from '@/lib/normalize-tr'

/**
 * IFS müşteri ana kaydı OKUYUCU (Proje Takip — Müşteri Firma canlı araması). SERVER-ONLY.
 * Salt okuma — IFS'e yazma YOK.
 *
 * Desen src/lib/ifs/part-sync.ts ile aynı: mainRoot() + getIfsAccessToken(), hata →
 * IfsHttpError(status, body). src/lib/ifs/**'e DOKUNULMADI (yalnız import).
 *
 * Projeksiyon (Melih Bey, 2026-09-28): CustomerHandling.svc/CustomerInfoSet, anahtar
 * CustomerId (ör. "MS00104"), ad alanı Name. /main gateway'inde — /int altında 404.
 * IFS_ENTITY_BASE_URL (entity/v1, barkod) BAŞKA bir kök, burada kullanılmaz.
 */

export interface IfsMusteri {
  customerId: string
  name: string
}

/** config.baseUrl (.../int/.../ShopFloorService.svc) → ana gateway projeksiyon kökü (.../main/.../v1/). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

async function ifsFetch(path: string): Promise<unknown> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değilse ham metin kalsın */
  }
  if (!res.ok) throw new IfsHttpError(res.status, body)
  return body
}

// ── Liste + cache ────────────────────────────────────────────────────────

const SAYFA = 500
/** Sonsuz döngü emniyeti: 200 × 500 = 100.000 müşteri. Aşılırsa hata (sessiz kesme yok). */
const MAKS_SAYFA = 200
/** Her blur'da IFS'i yormamak için. */
const CACHE_MS = 10 * 60_000

let cache: { liste: IfsMusteri[]; expiresAt: number } | null = null
let inFlight: Promise<IfsMusteri[]> | null = null

async function tumMusterileriCek(): Promise<IfsMusteri[]> {
  const out: IfsMusteri[] = []
  for (let sayfa = 0; sayfa < MAKS_SAYFA; sayfa++) {
    const body = (await ifsFetch(
      `CustomerHandling.svc/CustomerInfoSet?$select=CustomerId,Name&$orderby=CustomerId&$top=${SAYFA}&$skip=${sayfa * SAYFA}`,
    )) as { value?: Array<{ CustomerId?: unknown; Name?: unknown }> }
    const satirlar = Array.isArray(body?.value) ? body.value : []
    for (const r of satirlar) {
      if (typeof r.CustomerId === 'string' && typeof r.Name === 'string') {
        out.push({ customerId: r.CustomerId, name: r.Name })
      }
    }
    if (satirlar.length < SAYFA) return out
  }
  throw new Error(`IFS müşteri listesi ${MAKS_SAYFA * SAYFA} kaydı aştı — sayfalama sınırı yükseltilmeli`)
}

/** IFS'teki tüm müşteriler (CustomerId + Name). 10 dk cache; eşzamanlı çağrılar tek istek paylaşır. */
export async function musteriListesi(): Promise<IfsMusteri[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.liste
  if (inFlight) return inFlight
  inFlight = tumMusterileriCek()
    .then((liste) => {
      cache = { liste, expiresAt: Date.now() + CACHE_MS }
      return liste
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

// ── Eşleştirme ───────────────────────────────────────────────────────────

/**
 * normalizeTr + noktalama/tire → boşluk + çoklu boşluk → tek boşluk.
 * ("AGCO-VALTRA" ≡ "Agco  Valtra", "MAK. A.Ş." ≡ "mak a s").
 * Şirket türü ekleri (A.Ş., GmbH, Ltd.) BİLİNÇLİ olarak silinmez — tahmine dayalı
 * normalize yanlış eşleşme riski taşır.
 */
export function musteriAdiNormalize(ad: string): string {
  return normalizeTr(ad).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const CANLI_LIMIT = 8

/**
 * Canlı arama (Müşteri Firma autocomplete): metni İÇEREN müşteriler — ad (normalize)
 * veya CustomerId (büyük/küçük harf duyarsız). En fazla 8; başı eşleşenler önce.
 *
 * NEDEN IFS $filter contains() DEĞİL: bu repo'da IFS'e karşı yalnız startswith()
 * kanıtlı; contains()/tolower() desteği doğrulanmadı. Sunucu tarafı contains ayrıca
 * harf/Türkçe karakter duyarlı olurdu ("türk" → "TURK TRAKTOR" bulunmazdı). Bu yüzden
 * musteriListesi()'nin 10 dk cache'li listesinde yerel filtre — IFS'e ek sorgu yok.
 */
export async function musteriAraCanli(metin: string): Promise<IfsMusteri[]> {
  const hedef = musteriAdiNormalize(metin)
  if (!hedef) return []
  // Locale'siz toUpperCase() bilinçli: tr-TR "i"yi "İ" yapar, kodu bozar.
  const kodHedef = metin.trim().toUpperCase()

  const liste = await musteriListesi()
  const basta: IfsMusteri[] = []
  const icinde: IfsMusteri[] = []
  for (const m of liste) {
    const ad = musteriAdiNormalize(m.name)
    const kod = m.customerId.toUpperCase()
    if (ad.startsWith(hedef) || kod.startsWith(kodHedef)) basta.push(m)
    else if (ad.includes(hedef) || kod.includes(kodHedef)) icinde.push(m)
    if (basta.length >= CANLI_LIMIT) break
  }
  return [...basta, ...icinde].slice(0, CANLI_LIMIT)
}
