// Araç tipi seçim listesi (A7). Şema değişmez: değer string kalır (ServisArac.aracTipi).
// Eski kayıtlardaki serbest metin değerleri bozulmadan korunur (ekranda "mevcut değer"
// olarak gösterilir, sunucuda DEĞİŞMEDİKÇE kabul edilir).
export const ARAC_TIPLERI = ['Minibüs', 'Midibüs', 'Otobüs', 'Otomobil', 'Diğer'] as const

export type AracTipi = (typeof ARAC_TIPLERI)[number]

export function aracTipiGecerliMi(deger: string): boolean {
  return (ARAC_TIPLERI as readonly string[]).includes(deger)
}

export const ARAC_TIPI_HATASI = `Araç tipi şunlardan biri olmalıdır: ${ARAC_TIPLERI.join(', ')}.`
