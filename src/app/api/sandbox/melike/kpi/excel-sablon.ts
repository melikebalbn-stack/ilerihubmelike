import * as XLSX from 'xlsx'

// KPI Excel şablonu — hem boş şablon indirme hem dolu dışa aktarma bu 3 sayfayı
// kullanır, böylece "dışa aktar → düzenle → içeri al" turu sorunsuz çalışır.
// Sayfa 1: KPI Tanımları | Sayfa 2: Ölçümler | Sayfa 3: Aksiyonlar

export const YON_ETIKET: Record<string, string> = {
  higher_is_better: 'Yüksek İyi',
  lower_is_better: 'Düşük İyi',
}
export const YON_TERS: Record<string, string> = {
  'Yüksek İyi': 'higher_is_better',
  'Düşük İyi': 'lower_is_better',
}
export const PERIYOT_ETIKET: Record<string, string> = {
  monthly: 'Aylık',
  quarterly: 'Çeyreklik',
}
export const PERIYOT_TERS: Record<string, string> = {
  Aylık: 'monthly',
  Çeyreklik: 'quarterly',
}
export const ORAN_ETIKET: Record<string, string> = { G_H: 'G/H', H_G: 'H/G' }
export const ORAN_TERS: Record<string, string> = { 'G/H': 'G_H', 'H/G': 'H_G' }

interface KpiVeri {
  name: string
  unit: string | null
  direction: string
  frequency: string
  gerceklesenEtiketi: string
  hedefEtiketi: string
  oranYonu: string
  measurements: { year: number; month: number; target: number | null; actual: number | null }[]
  actions: {
    reason: string | null
    action: string | null
    sorumluAdi: string | null
    startDate: Date | string | null
    endDate: Date | string | null
    completionPercent: number | null
  }[]
}

export function kpiExcelOlustur(kpiler: KpiVeri[]): XLSX.WorkBook {
  const tanimSatirlari = kpiler.length > 0
    ? kpiler.map(k => ({
        'KPI Adı': k.name,
        Birim: k.unit ?? '',
        Yön: YON_ETIKET[k.direction] ?? 'Yüksek İyi',
        Periyot: PERIYOT_ETIKET[k.frequency] ?? 'Aylık',
        'Gerçekleşen Etiketi': k.gerceklesenEtiketi,
        'Hedef Etiketi': k.hedefEtiketi,
        'Oran Yönü': ORAN_ETIKET[k.oranYonu] ?? 'G/H',
      }))
    : [{ 'KPI Adı': 'Örnek KPI', Birim: '%', Yön: 'Yüksek İyi', Periyot: 'Aylık', 'Gerçekleşen Etiketi': 'Gerçekleşen', 'Hedef Etiketi': 'Hedef', 'Oran Yönü': 'G/H' }]

  const olcumSatirlari = kpiler.length > 0
    ? kpiler.flatMap(k => k.measurements.map(m => ({
        'KPI Adı': k.name,
        Yıl: m.year,
        Dönem: m.month,
        Hedef: m.target ?? '',
        Gerçekleşen: m.actual ?? '',
      })))
    : [{ 'KPI Adı': 'Örnek KPI', Yıl: new Date().getFullYear(), Dönem: 1, Hedef: 100, Gerçekleşen: '' }]

  const aksiyonSatirlari = kpiler.length > 0
    ? kpiler.flatMap(k => k.actions.map(a => ({
        'KPI Adı': k.name,
        Neden: a.reason ?? '',
        Aksiyon: a.action ?? '',
        Sorumlu: a.sorumluAdi ?? '',
        'Başlangıç Tarihi': a.startDate ? new Date(a.startDate).toLocaleDateString('tr-TR') : '',
        'Bitiş Tarihi': a.endDate ? new Date(a.endDate).toLocaleDateString('tr-TR') : '',
        'Tamamlanma %': a.completionPercent ?? 0,
      })))
    : [{ 'KPI Adı': 'Örnek KPI', Neden: '', Aksiyon: '', Sorumlu: '', 'Başlangıç Tarihi': '', 'Bitiş Tarihi': '', 'Tamamlanma %': 0 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tanimSatirlari), 'KPI Tanımları')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(olcumSatirlari), 'Ölçümler')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aksiyonSatirlari), 'Aksiyonlar')
  return wb
}
