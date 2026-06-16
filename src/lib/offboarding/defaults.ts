/**
 * OFFB-1: Zimmet İade / İlişik Kesme — varsayılan checklist sabitleri.
 *
 * Form oluşturulurken (OFFB-2 create) bu listeler kopyalanıp
 * OffboardingAssetItem / OffboardingAccessItem satırlarına dönüştürülür.
 * `sira` 1'den başlar; UI sıralaması bu alana göre yapılır.
 *
 * Kaynak: İlişik Kesme ve Zimmet İade prosedürü
 * (ISO 27001:2022 A.5.11 / A.6.5 / A.5.18, Siber Hijyen md. 1.5).
 */

export interface OffboardingChecklistItem {
  sira: number
  label: string
}

/** Fiziksel varlıklar (10 kalem) — prosedür md. 2. */
export const DEFAULT_ASSET_ITEMS: OffboardingChecklistItem[] = [
  { sira: 1, label: 'Dizüstü / Masaüstü bilgisayar' },
  { sira: 2, label: 'Cep telefonu' },
  { sira: 3, label: 'SIM kart / hat' },
  { sira: 4, label: 'Erişim / yaka kartı' },
  { sira: 5, label: 'Kapı / dolap / çekmece anahtarları' },
  { sira: 6, label: 'Donanım token (FortiToken vb.)' },
  { sira: 7, label: 'USB bellek / harici disk' },
  { sira: 8, label: 'Araç ve yakıt kartı' },
  { sira: 9, label: 'Kıyafet / KKD' },
  { sira: 10, label: 'Diğer demirbaş' },
]

/** Mantıksal yetkiler (8 kalem) — prosedür md. 3. */
export const DEFAULT_ACCESS_ITEMS: OffboardingChecklistItem[] = [
  { sira: 1, label: 'Azure AD / Domain hesabı devre dışı' },
  { sira: 2, label: 'E-posta kutusu kapatma / yönlendirme' },
  { sira: 3, label: 'VPN erişimi kaldırma' },
  { sira: 4, label: 'FortiToken / MFA kaydı iptali' },
  { sira: 5, label: 'ILERIHub portal hesabı pasifleştirme' },
  { sira: 6, label: 'Dosya / paylaşım erişim yetkileri' },
  { sira: 7, label: 'Ana yüklenici (Roketsan, ASELSAN) portal erişimleri' },
  { sira: 8, label: 'Yazılım lisansları (ESET vb.) geri alma' },
]
