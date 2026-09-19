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
}

export interface MetadataEntity {
  entity: string
  alanlar: MetadataAlan[]
}

const GIZLI_ALANLAR = new Set(['luname', 'keyref', 'objgrants', 'objstate', 'objsite', 'objkey', 'objversion', 'objid'])

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

/** CSDL: her EntityType için Key/PropertyRef ve Property listesi. NavigationProperty/ComplexType dışarıda. */
export function metadataAyristir(xml: string): MetadataEntity[] {
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
      alanlar.push({
        alan,
        veriTipi: veriTipiEsle(attr(p[1], 'Type') ?? ''),
        anahtarMi: anahtarlar.has(alan),
        gizli: GIZLI_ALANLAR.has(alan.toLowerCase()),
      })
    }
    out.push({ entity, alanlar })
  }
  return out
}
