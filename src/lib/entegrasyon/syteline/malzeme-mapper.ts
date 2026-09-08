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
export interface MalzemeReferans {
  birimler: string[]
  muhasebeGruplari: string[]
  urunKodlari: string[]
  contract: string
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

  const unit = (satir.u_m ?? '').trim().toLowerCase()
  if (!unit) return { hata: `birim boş: ${partNo}` }
  const birimSet = new Set(ref.birimler.map((u) => u.trim().toLowerCase()))
  if (!birimSet.has(unit)) return { hata: `birim yok: ${(satir.u_m ?? '').trim()}` }

  const urun = (satir.product_code ?? '').trim()
  if (!urun) return { hata: `ürün kodu boş: ${partNo}` }
  const urunSet = new Set(ref.urunKodlari.map((c) => c.trim()))
  if (!urunSet.has(urun)) return { hata: `ürün kodu yok: ${urun}` }

  // AccountingGroup: family_code IFS grup listesinde varsa aynen; yoksa '*'.
  const family = (satir.family_code ?? '').trim()
  const grupSet = new Set(ref.muhasebeGruplari.map((g) => g.trim()))
  const accountingGroup = family && grupSet.has(family) ? family : '*'

  const typeCode: 'Manufactured' | 'PurchasedRaw' =
    (satir.p_m_t_code ?? '').trim() === 'M' ? 'Manufactured' : 'PurchasedRaw'

  const katalog: MalzemeKatalog = { PartNo: partNo, Description: description, UnitCode: unit, ...KATALOG_SABIT }
  const envanter: MalzemeEnvanter = {
    Contract: ref.contract,
    PartNo: partNo,
    Description: description,
    UnitMeas: unit,
    TypeCode: typeCode,
    PartProductCode: urun,
    AccountingGroup: accountingGroup,
    PartStatus: 'A',
    PlannerBuyer: '*',
  }
  const hash = createHash('sha256').update(JSON.stringify({ katalog, envanter })).digest('hex')
  return { katalog, envanter, hash }
}
