// DB'de karşılığı olan tek opsiyonel "teknik" alanlar bunlar (MAC Adresi/PC Adı/
// IMEI) - RAM/IP Adresi/P-N/Lisans tarihleri hiçbir zaman kaydedilmiyordu, o
// yüzden formdan tamamen kaldırıldı (bkz. commit geçmişi). "Alan ekle" butonu
// SADECE bu 3 alan için.
//
// Hem yeni zimmet sihirbazı (ZimmetFormuStep1.tsx) hem Liste ekranının Düzenle
// dialogu (ZimmetListesi.tsx) BU TEK kataloğu/fonksiyonu kullanır - kod tekrarı
// yok, ikisi birbirinden sapmaz.
export type EkAlanKey = 'macAdresi' | 'pcAdi' | 'imeiNumarasi'

export const EK_ALAN_KATALOG: { key: EkAlanKey; label: string }[] = [
  { key: 'macAdresi', label: 'MAC Adresi' },
  { key: 'pcAdi', label: 'PC Adı' },
  { key: 'imeiNumarasi', label: 'IMEI Numarası' },
]

// Türe göre otomatik açılan alanlar. Diğer türlerde (Yazıcı, El Terminali,
// Yazılım) hiçbiri otomatik açılmıyor - gerekirse "Alan ekle" ile elle
// eklenir. Prisma enum değerleriyle (ör. 'NOTEBOOK_BILGISAYAR') çalışır -
// sihirbazdaki Türkçe etiketler çağıran tarafta enum'a çevrilir.
export function varsayilanEkAlanlar(tur: string): EkAlanKey[] {
  if (tur === 'NOTEBOOK_BILGISAYAR' || tur === 'DESKTOP_BILGISAYAR') return ['macAdresi', 'pcAdi']
  if (tur === 'CEP_TELEFONU') return ['imeiNumarasi']
  return []
}
