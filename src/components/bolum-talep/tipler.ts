// Bölüm değişikliği talebi — iki ekranın paylaştığı satır tipi (API yanıtı).

export type BolumTalepSatiri = {
  id: string
  talepNo: string
  durum: 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI' | 'IPTAL'
  mevcutBolum: string
  hedefBolum: string
  talepTarihi: string
  transferTarihi: string | null
  kararTarihi: string | null
  redGerekcesi: string | null
  isgOnayi: string | null
  doktorOnayi: string | null
  acanRol: 'MUDUR' | 'MUDUR_YRD'
  acanBolum: string | null
  gerekceler: string[]
  gerekceAciklamasi: string | null
  gerekceDigerKisi: string | null
  gerekceDigerIs: string | null
  personnel: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null }
  acan: { id: string; name: string | null; email: string } | null
  kararVeren: { id: string; name: string | null; email: string } | null
}

export const ACAN_ROL_ETIKET: Record<string, string> = {
  MUDUR: 'Müdür',
  MUDUR_YRD: 'Müdür Yardımcısı',
}
