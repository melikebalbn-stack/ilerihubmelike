// PR-JOBAPP-RENDERER: Public job-application formu için sabitler.
// Mevcut page.tsx'ten taşındı.

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Bay' },
  { value: 'FEMALE', label: 'Bayan' },
] as const

export const BLOOD_TYPE_OPTIONS = [
  { value: 'A_POSITIVE', label: 'A Rh+' },
  { value: 'A_NEGATIVE', label: 'A Rh-' },
  { value: 'B_POSITIVE', label: 'B Rh+' },
  { value: 'B_NEGATIVE', label: 'B Rh-' },
  { value: 'AB_POSITIVE', label: 'AB Rh+' },
  { value: 'AB_NEGATIVE', label: 'AB Rh-' },
  { value: 'O_POSITIVE', label: '0 Rh+' },
  { value: 'O_NEGATIVE', label: '0 Rh-' },
] as const

export const MILITARY_STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Yaptı' },
  { value: 'NOT_DONE', label: 'Yapmadı' },
  { value: 'EXEMPT', label: 'Muaf' },
  { value: 'POSTPONED', label: 'Tecilli' },
] as const

export const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Bekar' },
  { value: 'MARRIED', label: 'Evli' },
] as const

// Kaynak seçenekleri — YALNIZ FALLBACK. Asıl liste İK sözlüğünden gelir
// (/api/job-application/referral-sources → ReferralSourceDef.name).
//
// ⚠ DEĞERLER SÖZLÜK ADLARIYLA BİREBİR AYNI OLMALI. Sunucu gelen değeri
// `ReferralSourceDef.name` ile eşleştirip `referralSourceId`'yi çözüyor; eskiden burada
// enum KODLARI (AGENCY/ISKUR/…) vardı ve fetch başarısız olup fallback'e düşüldüğünde
// eşleşme bulunamıyor, kaynak SESSİZCE null kalıyordu. Sözlüğe yeni kaynak eklenirse
// buraya eklemek ŞART DEĞİL (fallback yalnız uç senaryo), ama BURADAKİ bir ad sözlükte
// yoksa o seçim yine kaynaksız kayıt üretir.
export const REFERRAL_SOURCE_OPTIONS = [
  { value: 'Aracı Kurum', label: 'Aracı Kurum' },
  { value: 'İŞKUR', label: 'İŞKUR' },
  { value: 'Web Sitesi', label: 'Web Sitesi' },
  { value: 'Referans', label: 'Referans' },
  { value: 'Diğer', label: 'Diğer' },
] as const

export const EDUCATION_LEVEL_OPTIONS = [
  { value: 'PRIMARY_SCHOOL', label: 'İlköğretim' },
  { value: 'HIGH_SCHOOL', label: 'Lise' },
  { value: 'ASSOCIATE', label: 'Önlisans' },
  { value: 'BACHELOR', label: 'Lisans' },
  { value: 'MASTER', label: 'Yüksek Lisans / Lüstü' },
  { value: 'DOCTORATE', label: 'Doktora' },
] as const

export const LANGUAGE_LEVEL_OPTIONS = [
  { value: 'BASIC', label: 'Temel' },
  { value: 'INTERMEDIATE', label: 'Orta' },
  { value: 'ADVANCED', label: 'İyi' },
] as const

export const COMPUTER_LEVEL_OPTIONS = [
  { value: 'POOR', label: 'Az' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'GOOD', label: 'İyi' },
  { value: 'VERY_GOOD', label: 'Çok İyi' },
] as const

export const YES_NO_OPTIONS = [
  { value: 'true', label: 'Evet' },
  { value: 'false', label: 'Hayır' },
] as const

// educationHistory fixed-key listesi (Record<key, EducationEntry>)
export const EDUCATION_HISTORY_KEYS = [
  { id: 'primarySchool', label: 'İlköğretim' },
  { id: 'highSchool', label: 'Lise' },
  { id: 'vocational', label: 'Meslek Lisesi' },
  { id: 'university', label: 'Üniversite' },
  { id: 'master', label: 'Yüksek Lisans' },
  { id: 'other', label: 'Diğer' },
] as const

export const DECLARATION_TEXT = `Verdiğim bilgiler doğru ve tamdır. İLERİ GROUP, başvurum hakkında her türlü tahkikata yetkilidir. İletilen kişisel verilerimin yasal mevzuata uygun olarak şirketimize veri sorumlusu sıfatı ile işlenmekte olup, yasal olarak aktarılması gereken resmi makamlara hukuki zorunluluklar nedeniyle ve ayrıca şirketimize uygun görülmesi halinde üçüncü parti firma destek hizmetleri kuruluşlarına aktarılabilmektedir.

Bu formun doldurulması, söz konusu bilgilendirmeyi okuduğunuz, anladığınız ve kabul ettiğiniz anlamına gelmektedir.

Eksik veya yanlış bilgilerin, başvurumun iptaline, yasal takibata ve hizmet akdinin ihbarsız feshine yol açabileceğini kabul ederim.

Kişisel Verilerin Korunması: Bu form üzerinde verdiğim kişisel bilgilerimin kurum ile iş ilişkimin kurulması nedeniyle kurum tarafından gerek gördüğü paylaşımların yapılması, muhafazası ve işlenmesi ile referans kontrolleri için muvaffakatım vardır.`
