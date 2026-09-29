import 'server-only'
import { getIfsConfig } from '@/lib/ifs/config'
import { getIfsAccessToken } from '@/lib/ifs/token'
import { IfsHttpError } from '@/lib/ifs/client'
import { normalizeTr } from '@/lib/normalize-tr'

/**
 * IFS müşteri ana kaydı OKUYUCU (Proje Takip — Yeni Proje müşteri kontrolü). SERVER-ONLY.
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

export type MusteriKontrolSonucu =
  | { durum: 'VAR'; eslesme: 'KOD' | 'AD'; eslesenler: IfsMusteri[] }
  | { durum: 'YOK'; benzerler: IfsMusteri[] }

/** config.baseUrl (.../int/.../ShopFloorService.svc) → ana gateway projeksiyon kökü (.../main/.../v1/). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

const esc = (v: string) => v.replace(/'/g, "''")

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

const BENZER_LIMIT = 10

/** CustomerId TAM eşleşme ($filter eq) — cache'siz, tek kayıt. Yoksa null. */
async function musteriKoduGetir(kod: string): Promise<IfsMusteri | null> {
  const filtre = encodeURIComponent(`CustomerId eq '${esc(kod)}'`)
  const body = (await ifsFetch(
    `CustomerHandling.svc/CustomerInfoSet?$filter=${filtre}&$select=CustomerId,Name&$top=1`,
  )) as { value?: Array<{ CustomerId?: unknown; Name?: unknown }> }
  const r = Array.isArray(body?.value) ? body.value[0] : undefined
  return r && typeof r.CustomerId === 'string' && typeof r.Name === 'string'
    ? { customerId: r.CustomerId, name: r.Name }
    : null
}

/**
 * Tek kutuya girilen değer müşteri KODU (CustomerId, ör. "MS00104") ya da ADI olabilir.
 * Kod formatı varsayılmaz — sıra sabit:
 *   1) CustomerId'de TAM eşleşme (büyük/küçük harf duyarsız) → VAR (eslesme: KOD), isim eşleştirmesine geçilmez.
 *   2) Yoksa ad: birebir (normalize edilmiş) eşleşme → VAR (eslesme: AD).
 *   3) Yoksa → YOK + benzerler: girilen adın TÜM kelimelerini içeren IFS kayıtları
 *      (kullanıcıya gösterilir; "eşdeğer" sayılmaz, karar kullanıcıda).
 */
export async function musteriAra(deger: string): Promise<MusteriKontrolSonucu> {
  const temiz = deger.trim()
  if (!temiz) return { durum: 'YOK', benzerler: [] }

  // CustomerId büyük harfli (ör. "MS00104") — "ms00104" de eşleşsin diye büyütülür.
  // Locale'siz toUpperCase() bilinçli: tr-TR "i"yi "İ" yapar, kodu bozar.
  // (IFS $filter tolower() desteği doğrulanmadığı için sunucu tarafında yapılmıyor.)
  const kodla = await musteriKoduGetir(temiz.toUpperCase())
  if (kodla) return { durum: 'VAR', eslesme: 'KOD', eslesenler: [kodla] }

  const hedef = musteriAdiNormalize(temiz)
  if (!hedef) return { durum: 'YOK', benzerler: [] }

  const liste = await musteriListesi()
  const eslesenler = liste.filter((m) => musteriAdiNormalize(m.name) === hedef)
  if (eslesenler.length > 0) return { durum: 'VAR', eslesme: 'AD', eslesenler }

  const kelimeler = hedef.split(' ')
  const benzerler = liste
    .filter((m) => {
      const adKelimeleri = new Set(musteriAdiNormalize(m.name).split(' '))
      return kelimeler.every((k) => adKelimeleri.has(k))
    })
    .slice(0, BENZER_LIMIT)
  return { durum: 'YOK', benzerler }
}
