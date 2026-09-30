/**
 * Rapor tasarımcısı — IFS OData $metadata okuma ve ayrıştırma (Faz 1).
 *
 * Token/istek altyapısı personel-sync/ifs-api.ts'ten (istek → Bearer + mainRoot).
 * XML ayrıştırma bağımlılıksız: CSDL çıktısı çok düzenli (EntityType > Key/Property),
 * fast-xml-parser package.json'da yok — yalnız @types/nodemailer → aws-sdk zinciriyle
 * geçici olarak node_modules'ta; ona yaslanmak kırılgan olurdu.
 */
import { ifsBaglanti, istek } from '@/lib/ifs/personel-sync/ifs-api'

/** Başlangıç kataloğu — ihtiyaç oldukça genişletilir. */
export const PROJEKSIYONLAR = [
  'ShopOrdersHandling',
  'ShopOrderHandling',
  'CustomerOrdersHandling',
  'CustomerOrderHandling',
  'PurchaseOrderHandling',
  'InventoryPartHandling',
  'InventoryPartInStockHandling',
  'PartHandling',
  'ManualReservationShopOrderHandling',
  'PersonHandling',
  'EmployeesHandling',
  'PersonnelFileHandling',
  'OrganizationUnitsHandling',
  'PositionsHandling',
  'WorkCenterHandling',
] as const

export type RaporVeriTipi = 'metin' | 'sayi' | 'tarih' | 'mantiksal'

export interface MetadataAlan {
  alan: string
  veriTipi: RaporVeriTipi
  anahtarMi: boolean
  /** IFS iç alanları (luname, objkey…) — katalogda pasif tutulur. */
  gizli: boolean
  /** Alan bir EnumType'a işaret ediyorsa tipin adı (ör. 'ShopOrdState'). */
  enumTipi?: string
  /** Enum üye adları — IFS'in döndürdüğü HAM değerler (ör. Closed, Released). */
  degerler?: string[]
}

export interface MetadataEntity {
  entity: string
  alanlar: MetadataAlan[]
}

/**
 * IFS iç alanları — katalogda pasif tutulur.
 * Objstate BİLEREK listede değil: iş emri/sipariş durumu (Closed, Released…) rapor
 * tasarlarken en çok gruplanan alan ve enum değerleri rapor_katalog_deger'de Türkçeleşiyor.
 * Listeye geri eklenirse her katalog yüklemesinde tekrar gizlenir (elle UPDATE gerekir).
 */
const GIZLI_ALANLAR = new Set(['luname', 'keyref', 'objgrants', 'objsite', 'objkey', 'objversion', 'objid'])

const SAYI_TIPLERI = new Set(['Edm.Int16', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Double', 'Edm.Single'])
const TARIH_TIPLERI = new Set(['Edm.Date', 'Edm.DateTimeOffset', 'Edm.TimeOfDay'])

export function veriTipiEsle(edmTipi: string): RaporVeriTipi {
  if (SAYI_TIPLERI.has(edmTipi)) return 'sayi'
  if (TARIH_TIPLERI.has(edmTipi)) return 'tarih'
  if (edmTipi === 'Edm.Boolean') return 'mantiksal'
  return 'metin' // Edm.String, enum, Collection(...) vb.
}

/** `${mainRoot}${proj}.svc/$metadata` — mainRoot sonunda '/' taşır (istek ile aynı birleştirme). */
export function metadataUrl(projeksiyon: string): string {
  return `${ifsBaglanti().mainRoot}${projeksiyon}.svc/$metadata`
}

/** $metadata XML'ini ham metin olarak çeker. */
export async function metadataGetir(projeksiyon: string): Promise<string> {
  if (!/^[A-Za-z0-9_]+$/.test(projeksiyon)) throw new Error(`Geçersiz projeksiyon adı: ${projeksiyon}`)
  // istek gövdeyi JSON.parse dener, XML'de düşer → metin olarak döner.
  const { body } = await istek<unknown>(`${projeksiyon}.svc/$metadata`, { headers: { Accept: 'application/xml' } })
  if (typeof body !== 'string' || !body.includes('<EntityType')) {
    throw new Error(`${projeksiyon}: $metadata beklenen CSDL XML değil (${typeof body}, ${String(body).slice(0, 80)})`)
  }
  return body
}

const attr = (etiketler: string, ad: string): string | undefined =>
  new RegExp(`\\b${ad}="([^"]*)"`).exec(etiketler)?.[1]

/**
 * CSDL EnumType'ları: tip adı → üye adları.
 * IFS'te durum/kod alanları düz metin DEĞİL enum'dur (ShopOrd.Objstate → IfsApp.ShopOrderHandling.ShopOrdState);
 * olası değerler yalnız burada tanımlıdır. Üye adı = OData'nın döndürdüğü ham değer.
 */
export function enumlariAyristir(xml: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const re = /<EnumType\b([^>]*)>([\s\S]*?)<\/EnumType>/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const ad = attr(m[1], 'Name')
    if (!ad) continue
    const uyeler: string[] = []
    const uyeRe = /<Member\b([^>]*?)\/?>/g
    for (let u = uyeRe.exec(m[2]); u; u = uyeRe.exec(m[2])) {
      const uye = attr(u[1], 'Name')
      if (uye) uyeler.push(uye)
    }
    if (uyeler.length) out.set(ad, uyeler)
  }
  return out
}

/** CSDL: her EntityType için Key/PropertyRef ve Property listesi. NavigationProperty/ComplexType dışarıda. */
export function metadataAyristir(xml: string): MetadataEntity[] {
  const enumlar = enumlariAyristir(xml)
  const out: MetadataEntity[] = []
  const entityRe = /<EntityType\b([^>]*)>([\s\S]*?)<\/EntityType>/g
  for (let m = entityRe.exec(xml); m; m = entityRe.exec(xml)) {
    const entity = attr(m[1], 'Name')
    if (!entity) continue
    const govde = m[2]

    const anahtarlar = new Set<string>()
    const keyGovde = /<Key>([\s\S]*?)<\/Key>/.exec(govde)?.[1] ?? ''
    const refRe = /<PropertyRef\b([^>]*)\/?>/g
    for (let r = refRe.exec(keyGovde); r; r = refRe.exec(keyGovde)) {
      const ad = attr(r[1], 'Name')
      if (ad) anahtarlar.add(ad)
    }

    const alanlar: MetadataAlan[] = []
    const gorulen = new Set<string>()
    const propRe = /<Property\b([^>]*?)\/?>/g
    for (let p = propRe.exec(govde); p; p = propRe.exec(govde)) {
      const alan = attr(p[1], 'Name')
      if (!alan || gorulen.has(alan)) continue
      gorulen.add(alan)
      // Tip "IfsApp.<Projeksiyon>.<Ad>" ise ve <Ad> bir EnumType'sa alanın olası değerleri bilinir.
      const tipAdi = attr(p[1], 'Type') ?? ''
      const sonParca = tipAdi.split('.').pop() ?? ''
      const degerler = enumlar.get(sonParca)
      alanlar.push({
        alan,
        veriTipi: veriTipiEsle(tipAdi),
        anahtarMi: anahtarlar.has(alan),
        gizli: GIZLI_ALANLAR.has(alan.toLowerCase()),
        ...(degerler ? { enumTipi: sonParca, degerler } : {}),
      })
    }
    out.push({ entity, alanlar })
  }
  return out
}

// ── EntitySet ↔ EntityType eşlemesi ──────────────────────────────────────
// Katalog EntityType adını tutar (ShopOrd); OData sorgusu EntitySet ister (ShopOrds,
// ShopOrderOperationSet…). Ad türetilemez → $metadata'dan okunur, süreç içinde önbellek.

const ENTITY_SET_TTL_MS = 60 * 60 * 1000
const entitySetCache = new Map<string, { zaman: number; esleme: Map<string, string[]> }>()

/** CSDL EntityContainer: EntityType adı → onu sunan EntitySet adları. */
export function entitySetleriAyristir(xml: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const re = /<EntitySet\b([^>]*)\/?>/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const set = attr(m[1], 'Name')
    const tip = attr(m[1], 'EntityType')?.split('.').pop()
    if (!set || !tip) continue
    const l = out.get(tip)
    if (l) l.push(set); else out.set(tip, [set])
  }
  return out
}

/** Projeksiyonun EntityType → EntitySet[] eşlemesi (1 saat önbellek). */
export async function entitySetleri(projeksiyon: string): Promise<Map<string, string[]>> {
  const c = entitySetCache.get(projeksiyon)
  if (c && Date.now() - c.zaman < ENTITY_SET_TTL_MS) return c.esleme
  const esleme = entitySetleriAyristir(await metadataGetir(projeksiyon))
  entitySetCache.set(projeksiyon, { zaman: Date.now(), esleme })
  return esleme
}
