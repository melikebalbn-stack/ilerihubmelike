// PR-PERSONNEL-DEPARTMENT-TRANSFER: Form gerekçeleri + enum label'ları.

export const KISI_GEREKCELER = [
  { value: 'KISI_SAGLIK_PROBLEMLERI', label: 'Sağlık Problemleri' },
  { value: 'KISI_EGITIM_DEGISIM', label: 'Eğitim durumunun değişmesi' },
  { value: 'KISI_KENDI_IRADESI', label: 'Kişinin kendi iradesi ile görev/bölüm değişikliği' },
  { value: 'KISI_VERIMLILIK', label: 'Başka birimde daha verimli çalışma olasılığı' },
] as const

export const IS_GEREKCELER = [
  { value: 'IS_ISG_UYGUNSUZLUK', label: 'Mesleksel sağlık ve güvenlik açısından işe uygun olmama' },
  { value: 'IS_PERFORMANS', label: 'Performans Düşüklüğü' },
  { value: 'IS_YONETICI_TALEBI', label: 'Kişinin bağlı olduğu yöneticinin talebi' },
  { value: 'IS_NITELIK_UYUMSUZ', label: 'Taşıdığı niteliklerle yaptığı işin uygunluk durumu' },
  { value: 'IS_BASKA_BIRIM_GEREKSINIM', label: 'Başka bir birimde gereksinim duyulması' },
  { value: 'IS_VERIMLI_KULLANIM', label: 'İş gücünün verimli kullanılması' },
  { value: 'IS_EGITIM_UYGUNLUK', label: 'Kişinin eğitiminin farklı bir işe daha uygun olması' },
] as const

export const TALEP_EDEN_OPTIONS = [
  { value: 'PERSONEL', label: 'Personel' },
  { value: 'BOLUM_YONETICISI', label: 'Bölüm Yöneticisi' },
] as const

export const ONAY_OPTIONS = [
  { value: 'UYGUN', label: 'Uygun' },
  { value: 'UYGUN_DEGIL', label: 'Uygun Değil' },
] as const

export function gerekceLabel(value: string): string {
  const all = [...KISI_GEREKCELER, ...IS_GEREKCELER]
  return all.find((g) => g.value === value)?.label ?? value
}

export function talepEdenLabel(value: string): string {
  return TALEP_EDEN_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function onayLabel(value: string): string {
  return ONAY_OPTIONS.find((o) => o.value === value)?.label ?? value
}
