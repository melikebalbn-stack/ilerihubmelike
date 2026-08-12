import { describe, expect, it } from 'vitest'
import { buildYillikTakvimExportData, escapeExcelFormula, getYillikTakvimExportFileName, type YillikTakvimExportSource } from './excel'
const row = (overrides: Partial<YillikTakvimExportSource> = {}): YillikTakvimExportSource => ({
  anaKonu: 'İnsan Kaynakları', surec: 'Yıllık değerlendirme', kisaBaslik: 'Değerlendirme', sorumluAdi: 'Güvenli Kullanıcı',
  departmentAdi: 'İK', plananUygulamaTarihi: '2026-08-05T00:00:00.000Z', nihaiSonTarih: '2026-08-15T00:00:00.000Z',
  periyot: 'YILLIK', oncelik: 'KRITIK', durum: 'GECIKTI', gerceklesmeDurumu: 'DEVREDILDI', gerceklesmeTarihi: null,
  iptalMi: false, kalanGun: -3, ...overrides,
})
describe('Yıllık Takvim Excel export', () => {
  it('boş veride boş satır listesi üretir', () => expect(buildYillikTakvimExportData([], 2026)).toEqual([]))
  it('Türkçe başlık, tarih ve enum etiketlerini üretir', () => { const result = buildYillikTakvimExportData([row()], 2026)[0]; expect(result).toMatchObject({ 'Yıl': 2026, 'Ana Konu': 'İnsan Kaynakları', 'Planlanan Uygulama Tarihi': '05.08.2026', 'Nihai Son Tarih': '15.08.2026', 'Periyot': 'Yıllık', 'Öncelik': 'Kritik', 'Durum': 'Gecikti', 'Gerçekleşme Durumu': 'Devredildi' }) })
  it('PII/internal ID/storage alanlarını kolon olarak üretmez', () => { const text = JSON.stringify(buildYillikTakvimExportData([row()], 2026)); expect(text).not.toMatch(/email|userId|departmentId|saklamaYolu|storage|Personnel/i) })
  it.each(['=SUM(A1:A2)', '+cmd', '-2+3', '@HYPERLINK'])('formula başlangıcını escape eder: %s', value => expect(escapeExcelFormula(value)).toBe(`'${value}`))
  it('iptal kaydı filtrelenmeden verilirse export eder', () => expect(buildYillikTakvimExportData([row({ iptalMi: true, durum: 'IPTAL_EDILDI' })], 2026)[0]).toMatchObject({ 'İptal': 'Evet', 'Durum': 'İptal Edildi' }))
  it('dosya adını yalnız sabit prefix ve ISO gününden üretir', () => expect(getYillikTakvimExportFileName(new Date('2026-08-09T12:00:00Z'))).toBe('Yillik_Calisma_Takvimi_2026-08-09.xlsx'))
})
