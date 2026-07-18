export type IfsOperationStatus = 'ISLENEBILIR' | 'BEKLIYOR'

export interface IfsShopOrderOperation {
  id: string
  isMerkezi: string
  isEmriNo: string
  operasyon: string
  operasyonNo: number
  stokKodu: string
  stokAdi: string
  teslimTarihi: string   // yyyy-MM-dd
  miktar: number
  kalanMiktar: number
  uretilenMiktar: number
  hurdaMiktar: number
  durum: IfsOperationStatus
}
