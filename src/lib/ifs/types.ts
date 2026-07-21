export type IfsOperationStatus = 'ISLENEBILIR' | 'BEKLIYOR'

export interface IfsShopOrderOperation {
  id: string
  isMerkezi: string
  isEmriNo: string
  operasyon: string
  operasyonNo: number
  stokKodu: string
  stokAdi: string
  teslimTarihi: string   // yyyy-MM-dd (RevisedDueDate)
  ihtiyacTarihi: string  // yyyy-MM-dd (NeedDate)
  miktar: number         // RevisedQtyDue — planlanan adet
  kalanMiktar: number
  uretilenMiktar: number
  hurdaMiktar: number
  machRunFactor: number  // MachRunFactor — planlı makine çevrim (birim: runTimeCode)
  laborRunFactor: number // LaborRunFactor — planlı işçilik çevrim
  runTimeCode: string    // RunTimeCode — çevrim birimi (ör. HoursUnit)
  durum: IfsOperationStatus
}
