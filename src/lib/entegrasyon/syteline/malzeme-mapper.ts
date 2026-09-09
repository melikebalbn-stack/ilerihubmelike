import { createHash } from 'node:crypto'

/**
 * Syteline malzeme satırı → IFS { katalog, envanter } eşlemesi. SAF FONKSİYON (server-only DEĞİL,
 * DB/IFS erişmez) — DB'siz unit test edilir. Kaynak hatası → { hata } (kayıt HATA'ya çekilir,
 * IFS'e gidilmez). Kanıt: HUBTEST-0001 create'inde geçen minimal-artı alan seti.
 */

/** Mapper'ın kullandığı Syteline alanları (server-only malzeme.ts'ten decouple). */
export interface MalzemeGirdi {
  item: string | null
  description: string | null
  u_m: string | null
  product_code: string | null
  p_m_t_code: string | null
  family_code: string | null
}

/** IFS referans setleri + hedef contract (orkestratör IFS'ten çekip geçirir). */
/**
 * Hub eşleme tabloları (SyteEsleme'den). Boş/eksik ise mapper sabit fallback'e düşer.
 *  - birim:    kaynak (BÜYÜK harf) → IFS UnitCode
 *  - urunKodu: TAM product_code → IFS PartProductCode (ilk-3-hane kuralını EZER)
 *  - muhasebe: family_code → IFS AccountingGroup
 */
export interface SyteEslemeHaritalari {
  birim?: Map<string, string>
  urunKodu?: Map<string, string>
  muhasebe?: Map<string, string>
}

export interface MalzemeReferans {
  birimler: string[]
  muhasebeGruplari: string[]
  urunKodlari: string[]
  contract: string
  esleme?: SyteEslemeHaritalari
}

/**
 * Syteline birim → IFS ISO birim eşlemesi (büyük harf anahtar). Haritada yoksa u_m lowercase
 * denenir; her iki halde de IFS birim LOV'unda varlık kontrolü uygulanır.
 */
export const BIRIM_HARITASI: Record<string, string> = {
  AD: 'ad',
  LT: 'l',
  GR: 'g',
  PKT: 'pkg',
  RU: 'ru',
  TOP: 'top',
}

/**
 * PartCatalog kontrol/enum sabitleri — HUBTEST-0001 create'inde doğrulanan set.
 * LotTrackingCode şimdilik SABİT 'NotLotTracking'; ileride Syteline lot_tracked'a bağlanacak (v2).
 */
export const KATALOG_SABIT = {
  ConditionCodeUsage: 'NotAllowConditionCode',
  LotTrackingCode: 'NotLotTracking',
  SerialRule: 'Manual',
  SerialTrackingCode: 'NotSerialTracking',
  EngSerialTrackingCode: 'NotSerialTracking',
  Configurable: 'NotConfigured',
  SubLotRule: 'NoSubLotsAllowed',
  LotQuantityRule: 'OneLotPerShopOrder',
  PositionPart: 'NotAPositionPart',
  MultilevelTracking: 'TrackingOff',
  ComponentLotRule: 'ManyLotsAllowed',
  StdNameId: 0,
  StandardName: '*',
} as const

export interface MalzemeKatalog {
  PartNo: string
  Description: string
  UnitCode: string
  ConditionCodeUsage: string
  LotTrackingCode: string
  SerialRule: string
  SerialTrackingCode: string
  EngSerialTrackingCode: string
  Configurable: string
  SubLotRule: string
  LotQuantityRule: string
  PositionPart: string
  MultilevelTracking: string
  ComponentLotRule: string
  StdNameId: number
  StandardName: string
}
export interface MalzemeEnvanter {
  Contract: string
  PartNo: string
  Description: string
  UnitMeas: string
  TypeCode: 'Manufactured' | 'PurchasedRaw'
  PartProductCode: string
  AccountingGroup: string
  PartStatus: 'A'
  PlannerBuyer: '*'
}
export type MalzemeMapSonuc =
  | { katalog: MalzemeKatalog; envanter: MalzemeEnvanter; hash: string }
  | { hata: string }

export function malzemeMapla(satir: MalzemeGirdi, ref: MalzemeReferans): MalzemeMapSonuc {
  const partNo = (satir.item ?? '').trim()
  if (!partNo) return { hata: 'item (PartNo) boş' }

  const description = (satir.description ?? '').trim()
  if (!description) return { hata: `açıklama boş: ${partNo}` }

  const esleme = ref.esleme ?? {}
  // Birim: DB eşlemesi (SyteEsleme/BIRIM) öncelik → yoksa sabit BIRIM_HARITASI → yoksa lowercase.
  // Her halde IFS birim LOV kontrolü. (DB boşsa eski davranış korunur.)
  const uHam = (satir.u_m ?? '').trim()
  if (!uHam) return { hata: `birim boş: ${partNo}` }
  const uUpper = uHam.toUpperCase()
  const unit = esleme.birim?.get(uUpper) ?? BIRIM_HARITASI[uUpper] ?? uHam.toLowerCase()
  const birimSet = new Set(ref.birimler.map((u) => u.trim().toLowerCase()))
  if (!birimSet.has(unit.toLowerCase())) return { hata: `birim yok: ${uHam}` }

  // PartProductCode: TAM product_code için URUN_KODU override VARSA o öncelikli; yoksa İLK 3 HANE
  // (1510101 → 151; <3 hane / rakam-dışı → geçersiz). Sonra IFS ürün-kodu LOV kontrolü.
  const pcHam = (satir.product_code ?? '').trim()
  if (!pcHam) return { hata: `ürün kodu boş: ${partNo}` }
  const pcOverride = esleme.urunKodu?.get(pcHam)
  let urunKodu: string
  if (pcOverride) {
    urunKodu = pcOverride
  } else {
    const ilk3 = pcHam.slice(0, 3)
    if (pcHam.length < 3 || !/^\d{3}$/.test(ilk3)) return { hata: `ürün kodu geçersiz: ${pcHam}` }
    urunKodu = ilk3
  }
  const urunSet = new Set(ref.urunKodlari.map((c) => c.trim()))
  if (!urunSet.has(urunKodu)) return { hata: `ürün kodu yok: ${urunKodu}` }

  // AccountingGroup: MUHASEBE_GRUBU override öncelik → yoksa family_code IFS grubunda varsa aynen → yoksa '*'.
  const family = (satir.family_code ?? '').trim()
  const grupSet = new Set(ref.muhasebeGruplari.map((g) => g.trim()))
  const grpOverride = esleme.muhasebe?.get(family)
  const accountingGroup = grpOverride ?? (family && grupSet.has(family) ? family : '*')

  const typeCode: 'Manufactured' | 'PurchasedRaw' =
    (satir.p_m_t_code ?? '').trim() === 'M' ? 'Manufactured' : 'PurchasedRaw'

  const katalog: MalzemeKatalog = { PartNo: partNo, Description: description, UnitCode: unit, ...KATALOG_SABIT }
  const envanter: MalzemeEnvanter = {
    Contract: ref.contract,
    PartNo: partNo,
    Description: description,
    UnitMeas: unit,
    TypeCode: typeCode,
    PartProductCode: urunKodu,
    AccountingGroup: accountingGroup,
    PartStatus: 'A',
    PlannerBuyer: '*',
  }
  const hash = createHash('sha256').update(JSON.stringify({ katalog, envanter })).digest('hex')
  return { katalog, envanter, hash }
}
