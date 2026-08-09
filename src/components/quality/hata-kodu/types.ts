/**
 * Hata kodu ekranı (KAL-KYT-15 Bölüm 1) — istemci tarafı tipleri.
 *
 * Ayrı dosya: hem ağaç bileşeni hem form dialog'u aynı tipi kullanıyor;
 * tek dosyada tutulsa import döngüsü oluşurdu. `src/lib/quality/hata-kodu-tree.ts`
 * KULLANILAMAZ — o dosya prisma import ediyor, istemciye sızar.
 */
export type HataKoduRow = {
  id: string
  kod: number
  ad: string
  ustKodId: string | null
  aktif: boolean
  siraNo: number
  aciklama: string | null
}

/** Düzenlenebilir alanlar. `kod` YOK — bir kez kaydedildikten sonra değişmez. */
export type HataKoduFormState = {
  kod: string // create'te serbest metin (sayıya çevrilir), edit'te salt-okunur gösterilir
  ad: string
  ustKodId: string // '' = üst yok
  siraNo: string
  aciklama: string
  aktif: boolean
}
