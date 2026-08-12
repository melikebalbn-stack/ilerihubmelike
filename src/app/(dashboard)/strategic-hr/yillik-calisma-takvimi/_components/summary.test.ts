import { describe, expect, it } from 'vitest'
import { calculateYillikTakvimSummary } from './summary'
import type { YillikTakvimKaydiRow } from './types'
const row = (overrides: Partial<YillikTakvimKaydiRow> = {}): YillikTakvimKaydiRow => ({
  id: Math.random().toString(), anaKonu: 'Konu', surec: 'Süreç', kisaBaslik: null, oncelik: 'ORTA', periyot: 'YILLIK', durum: 'PLANLANDI',
  baslangicTarihi: null, bitisTarihi: null, nihaiSonTarih: '2026-08-15T00:00:00.000Z', plananUygulamaTarihi: null,
  iptalMi: false, kalanGun: null, kaynakModul: null, gerceklesmeDurumu: 'BEKLIYOR', gerceklesmeTarihi: null, department: null, katilimcilar: [], ...overrides,
})
const values = (rows: YillikTakvimKaydiRow[], year = 2026) => Object.fromEntries(calculateYillikTakvimSummary(rows, year, new Date('2026-08-09T12:00:00Z')).map(item => [item.key, item.value]))
describe('Yıllık Takvim özet hesabı', () => {
  it('boş listede tüm kartları sıfır döndürür', () => { expect(Object.values(values([]))).toEqual(Array(8).fill(0)) })
  it('eski ekrandaki gerçek durum dağılımlarını hesaplar', () => { expect(values([row({ durum: 'YAKLASIYOR' }), row({ durum: 'GECIKTI' }), row({ durum: 'TAMAMLANDI' }), row({ durum: 'TAMAMLANDI_ONAY_BEKLIYOR' })])).toMatchObject({ toplam: 4, yaklasan: 1, geciken: 1, tamamlanan: 1, 'onay-bekleyen': 1 }) })
  it('iptal ve kritik kayıtları eski kuraldaki gibi yıl toplamından ayrı sayar', () => { expect(values([row({ iptalMi: true, durum: 'IPTAL_EDILDI', oncelik: 'KRITIK' }), row({ durum: 'ONAYLANDI' })])).toMatchObject({ toplam: 2, iptal: 1, kritik: 1, tamamlanan: 0 }) })
  it('Bu Ay yalnız seçili yıl güncel yıl olduğunda kayıt tarihini sayar', () => { const rows = [row(), row({ nihaiSonTarih: '2026-07-31T00:00:00.000Z' })]; expect(values(rows, 2026)['bu-ay']).toBe(1); expect(values(rows, 2025)['bu-ay']).toBe(0) })
  it('hesap tüm yıl rows girdisini kullanır; filtrelenmiş görünümden bağımsızdır', () => { const allRows = [row({ anaKonu: 'A' }), row({ anaKonu: 'B' })]; const filtered = allRows.filter(item => item.anaKonu === 'A'); expect(values(allRows).toplam).toBe(2); expect(values(filtered).toplam).toBe(1) })
})
