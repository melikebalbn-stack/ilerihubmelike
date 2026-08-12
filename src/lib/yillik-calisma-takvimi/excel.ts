import * as XLSX from 'xlsx'
import type { YillikTakvimDurum, YillikTakvimGerceklesmeDurumu, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'

export interface YillikTakvimExportSource {
  anaKonu: string; surec: string; kisaBaslik: string | null; sorumluAdi: string; departmentAdi: string
  plananUygulamaTarihi: string | null; nihaiSonTarih: string | null; periyot: YillikTakvimPeriyot
  oncelik: YillikTakvimOncelik; durum: YillikTakvimDurum; gerceklesmeDurumu: YillikTakvimGerceklesmeDurumu
  gerceklesmeTarihi: string | null; iptalMi: boolean; kalanGun: number | null
}

const PERIOD: Record<YillikTakvimPeriyot, string> = {
  TEK_SEFERLIK: 'Tek Seferlik', GUNLUK: 'Günlük', HAFTALIK: 'Haftalık', IKI_HAFTADA_BIR: 'İki Haftada Bir',
  AYLIK: 'Aylık', IKI_AYDA_BIR: 'İki Ayda Bir', UC_AYLIK: 'Üç Aylık', ALTI_AYLIK: 'Altı Aylık', YILLIK: 'Yıllık',
  IKI_YILDA_BIR: 'İki Yılda Bir', UC_YILDA_BIR: 'Üç Yılda Bir', BELIRLI_AYLAR: 'Belirli Aylar',
  BELIRLI_TARIHLER: 'Belirli Tarihler', OZEL: 'Özel',
}
const PRIORITY: Record<YillikTakvimOncelik, string> = { DUSUK: 'Düşük', ORTA: 'Orta', YUKSEK: 'Yüksek', KRITIK: 'Kritik' }
const STATUS: Record<YillikTakvimDurum, string> = {
  TASLAK: 'Taslak', PLANLANDI: 'Planlandı', DEVAM_EDIYOR: 'Devam Ediyor', YAKLASIYOR: 'Yaklaşıyor', GECIKTI: 'Gecikti',
  TAMAMLANDI: 'Tamamlandı', TAMAMLANDI_ONAY_BEKLIYOR: 'Onay Bekliyor', ONAYLANDI: 'Onaylandı',
  REVIZYON_ISTENDI: 'Revizyon İstendi', ERTELENDI: 'Ertelendi', IPTAL_EDILDI: 'İptal Edildi', ASKIYA_ALINDI: 'Askıya Alındı',
}
const REALIZATION: Record<YillikTakvimGerceklesmeDurumu, string> = {
  BEKLIYOR: 'Bekliyor', GERCEKLESTI: 'Gerçekleşti', GERCEKLESMEDI: 'Gerçekleşmedi', DEVREDILDI: 'Devredildi', PLANDISI: 'Plan Dışı',
}

export function escapeExcelFormula(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ')
  return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned
}
function dateLabel(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
export function buildYillikTakvimExportData(rows: YillikTakvimExportSource[], yil: number) {
  return rows.map(row => ({
    'Yıl': yil,
    'Ana Konu': escapeExcelFormula(row.anaKonu),
    'Süreç / Yapılacak İş': escapeExcelFormula(row.surec),
    'Kısa Başlık': escapeExcelFormula(row.kisaBaslik ?? ''),
    'Sorumlu': escapeExcelFormula(row.sorumluAdi),
    'Departman': escapeExcelFormula(row.departmentAdi),
    'Planlanan Uygulama Tarihi': dateLabel(row.plananUygulamaTarihi),
    'Nihai Son Tarih': dateLabel(row.nihaiSonTarih),
    'Periyot': PERIOD[row.periyot],
    'Öncelik': PRIORITY[row.oncelik],
    'Durum': STATUS[row.durum],
    'Gerçekleşme Durumu': REALIZATION[row.gerceklesmeDurumu],
    'Gerçekleşme Tarihi': dateLabel(row.gerceklesmeTarihi),
    'İptal': row.iptalMi ? 'Evet' : 'Hayır',
    'Kalan Gün': row.kalanGun ?? '',
  }))
}
export function getYillikTakvimExportFileName(now = new Date()): string {
  return `Yillik_Calisma_Takvimi_${now.toISOString().slice(0, 10)}.xlsx`
}
export function exportYillikTakvimToExcel(rows: YillikTakvimExportSource[], yil: number): void {
  const worksheet = XLSX.utils.json_to_sheet(buildYillikTakvimExportData(rows, yil))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Yıllık Takvim')
  XLSX.writeFile(workbook, getYillikTakvimExportFileName())
}
