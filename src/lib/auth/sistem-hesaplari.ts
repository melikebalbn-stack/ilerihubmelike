// Ortak/sistem hesapları — paylaşımlı terminal ve kiosk girişleri.
//
// Liste ldap-sync.ts'ten TAŞINDI (içerik birebir): senkron bunları atlıyor,
// artık giriş yolu da (auth.ts) ve varsayılan rol ataması da aynı listeye
// bakıyor. Tek doğruluk kaynağı burası; ldap-sync yeniden export ediyor.
//
// Ayırt etme YALNIZ e-postayla yapılır. User.id deseni işe yaramaz: bu hesaplar
// da giriş yolundan doğduğu için `ad_*` id taşıyor, gerçek kişilerle aynı.
// (11.09.2026 ölçümü: 7 rolsüz hesabın 6'sı ad_*, 1'i kiosk cuid'i.)
export const SYSTEM_ACCOUNTS = [
  '1.toplantiodasi@ilerigroup.com',
  '2.kattoplantiodasi@ilerigroup.com',
  '2.toplantiodasi@ilerigroup.com',
  'bakimhane@ilerigroup.com',
  'depomail@ilerigroup.com',
  'kaliphane@ilerigroup.com',
  'final.kalite@ilerigroup.com',
  'final.kalite2@ilerigroup.com',
  'giris.kalite@ilerigroup.com',
  'giris.kalite2@ilerigroup.com',
  'kalite.proses@ilerigroup.com',
  'kalite.proses2@ilerigroup.com',
  'koordinat@ilerigroup.com',
  'preshane.barkod@ilerigroup.com',
  'yemekhane@ilerigroup.com',
]

/** Bir kullanıcının sistem/ortak hesap olup olmadığını kontrol et */
export function isSystemAccount(email: string): boolean {
  return SYSTEM_ACCOUNTS.includes(email.toLowerCase())
}
