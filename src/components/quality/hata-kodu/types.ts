/**
 * Hata kodu ekranı (KAL-KYT-15 Bölüm 1) — istemci tarafı tipleri.
 *
 * DÜZ liste — hiyerarşi YOK. `ustKodId` 2026-08-09'da şemadan da kaldırıldı.
 */
export type HataKoduRow = {
  id: string
  kod: number
  ad: string
  aktif: boolean
  siraNo: number
  aciklama: string | null
}

/** Düzenlenebilir alanlar. `kod` YOK — bir kez kaydedildikten sonra değişmez. */
export type HataKoduFormState = {
  kod: string // create'te serbest metin (sayıya çevrilir), edit'te salt-okunur gösterilir
  ad: string
  siraNo: string
  aciklama: string
  aktif: boolean
}
