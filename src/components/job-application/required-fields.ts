// İş başvuru formu — MERKEZİ ZORUNLULUK ŞEMASI (İK talebi, 2026-07).
// TEK doğruluk kaynağı: yıldız (görsel), bölüm geçişi ve backend AYNI şemadan sürülür.
// Manuel validasyon (Zod değil). Koşullu alanlar: zorunluluk yalnız alan GÖRÜNÜRSE geçerli
// (visible() false ise zorunlu sayılmaz). Şu an listedeki alanların hiçbiri koşullu değil,
// ama desen ileriye dönük korunuyor.

import type { FormState } from './types'

const filled = (v: string) => v.trim().length > 0

export type RequiredField = {
  key: string // görsel yıldız + backend eşleme anahtarı (FormState/formData key'i)
  label: string // hata mesajlarında görünen ad
  isFilled: (f: FormState) => boolean // client: alan dolu mu?
  visible?: (f: FormState) => boolean // koşullu görünürlük (yoksa her zaman görünür)
}

// Bölüm (adım index) → zorunlu alanlar.
//   B1: S1-S10 hepsi · B2: Ev Adresi/Cep/E-posta · B3: S1-S6 · B4: S1-S7 ·
//   B5: S1-S6 · B6: S1-S5 · B7: Fotoğraf + Beyan.
export const REQUIRED_FIELDS: Record<number, RequiredField[]> = {
  0: [
    { key: 'fullName', label: 'Ad Soyad', isFilled: (f) => filled(f.fullName) },
    { key: 'gender', label: 'Cinsiyet', isFilled: (f) => filled(f.gender) },
    { key: 'birthPlace', label: 'Doğum Yeri', isFilled: (f) => filled(f.birthPlace) },
    { key: 'birthDate', label: 'Doğum Tarihi', isFilled: (f) => filled(f.birthDate) },
    { key: 'nationality', label: 'Uyruğu', isFilled: (f) => filled(f.nationality) },
    { key: 'tcKimlikNo', label: 'TC Kimlik No', isFilled: (f) => filled(f.tcKimlikNo) },
    { key: 'bloodType', label: 'Kan Grubu', isFilled: (f) => filled(f.bloodType) },
    { key: 'militaryStatus', label: 'Askerlik Durumu', isFilled: (f) => filled(f.militaryStatus) },
    { key: 'maritalStatus', label: 'Medeni Durum', isFilled: (f) => filled(f.maritalStatus) },
    { key: 'numberOfChildren', label: 'Çocuk Sayısı', isFilled: (f) => filled(f.numberOfChildren) },
  ],
  1: [
    { key: 'homeAddress', label: 'Ev Adresi', isFilled: (f) => filled(f.homeAddress) },
    { key: 'mobilePhone', label: 'Cep Telefonu', isFilled: (f) => filled(f.mobilePhone) },
    { key: 'email', label: 'E-posta', isFilled: (f) => filled(f.email) },
  ],
  2: [
    { key: 'referralSource', label: 'Bize Nasıl Ulaştınız?', isFilled: (f) => filled(f.referralSource) },
    { key: 'memberships', label: 'Üyelikler', isFilled: (f) => filled(f.memberships) },
    { key: 'hasDriverLicense', label: 'Sürücü Belgesi', isFilled: (f) => filled(f.hasDriverLicense) },
    { key: 'hasCriminalRecord', label: 'Adli sicil kaydı', isFilled: (f) => filled(f.hasCriminalRecord) },
    { key: 'hasConviction', label: 'Hüküm giydiniz mi?', isFilled: (f) => filled(f.hasConviction) },
    { key: 'hasOngoingCase', label: 'Devam eden dava', isFilled: (f) => filled(f.hasOngoingCase) },
  ],
  3: [
    { key: 'height', label: 'Boy', isFilled: (f) => filled(f.height) },
    { key: 'weight', label: 'Kilo', isFilled: (f) => filled(f.weight) },
    { key: 'shoeSize', label: 'Ayakkabı Numarası', isFilled: (f) => filled(f.shoeSize) },
    { key: 'clothingSizeUpper', label: 'Üst Beden', isFilled: (f) => filled(f.clothingSizeUpper) },
    { key: 'clothingSizeLower', label: 'Alt Beden', isFilled: (f) => filled(f.clothingSizeLower) },
    { key: 'hasTravelRestriction', label: 'Seyahat kısıtı', isFilled: (f) => filled(f.hasTravelRestriction) },
    { key: 'canWorkShifts', label: 'Vardiya çalışma', isFilled: (f) => filled(f.canWorkShifts) },
  ],
  4: [
    { key: 'availableStartDate', label: 'Başlayabileceğiniz tarih', isFilled: (f) => filled(f.availableStartDate) },
    { key: 'expectedSalary', label: 'Maaş Beklentisi', isFilled: (f) => filled(f.expectedSalary) },
    { key: 'requestedPosition', label: 'Başvurulan Pozisyon', isFilled: (f) => filled(f.requestedPosition) },
    { key: 'previouslyWorkedHere', label: 'Daha önce çalıştınız mı?', isFilled: (f) => filled(f.previouslyWorkedHere) },
    { key: 'educationLevel', label: 'Eğitim Seviyesi', isFilled: (f) => filled(f.educationLevel) },
    { key: 'educationHistory', label: 'Eğitim Geçmişi', isFilled: (f) => Object.values(f.educationHistory).some((e) => filled(e.institution)) },
  ],
  5: [
    { key: 'workExperience', label: 'İş Tecrübeleri', isFilled: (f) => f.workExperience.some((r) => filled(r.company) || filled(r.position)) },
    { key: 'hasRelativesInCompany', label: 'Firma bünyesinde akraba/tanıdık', isFilled: (f) => filled(f.hasRelativesInCompany) },
    { key: 'preferredContact', label: 'Size nasıl ulaşabiliriz?', isFilled: (f) => f.preferredContactGsm || f.preferredContactEmail || filled(f.preferredContactOther) },
    { key: 'canContactLastEmployer', label: 'Son işveren iletişim', isFilled: (f) => filled(f.canContactLastEmployer) },
    { key: 'references', label: 'Referanslar', isFilled: (f) => f.references.some((r) => filled(r.name) || filled(r.company)) },
  ],
  6: [
    { key: 'photo', label: 'Fotoğraf', isFilled: (f) => f.photo !== null },
    { key: 'declaration', label: 'Beyan', isFilled: (f) => f.declarationAccepted && filled(f.digitalSignature) },
  ],
}

const isVisible = (rf: RequiredField, f: FormState) => (rf.visible ? rf.visible(f) : true)

// Yıldız (görsel): key form genelinde tekil → herhangi bir bölümde zorunluysa yıldızlı.
const REQUIRED_KEYS = new Set(Object.values(REQUIRED_FIELDS).flat().map((r) => r.key))
export function isRequiredField(key: string): boolean {
  return REQUIRED_KEYS.has(key)
}

/** Bir bölümdeki EKSİK (görünür + boş) zorunlu alanların label listesi. */
export function missingFieldsInStep(form: FormState, step: number): string[] {
  return (REQUIRED_FIELDS[step] ?? [])
    .filter((rf) => isVisible(rf, form) && !rf.isFilled(form))
    .map((rf) => rf.label)
}

/** Tüm bölümlerde her zorunlu alan dolu mu? (submit gate) */
export function allRequiredFilled(form: FormState): boolean {
  return Object.keys(REQUIRED_FIELDS).every((s) => missingFieldsInStep(form, Number(s)).length === 0)
}

// ── Backend (formData) için ──
// Yapısal/özel alanlar route'ta ayrı kontrol edilir; gerisi düz metin (formData key = key).
const SPECIAL_SERVER_KEYS = new Set(['educationHistory', 'workExperience', 'references', 'preferredContact', 'photo', 'declaration'])
/** Backend: formData'da non-empty kontrol edilecek düz-metin zorunlu alanlar (şemadan türetilir). */
export const SERVER_SCALAR_REQUIRED: { key: string; label: string }[] = Object.values(REQUIRED_FIELDS)
  .flat()
  .filter((r) => !SPECIAL_SERVER_KEYS.has(r.key))
  .map((r) => ({ key: r.key, label: r.label }))
