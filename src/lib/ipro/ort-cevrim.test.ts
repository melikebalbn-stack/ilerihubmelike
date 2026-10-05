import { describe, it, expect } from 'vitest'
import { ortalamaCevrim } from './ort-cevrim'

const t = (hhmm: string) => new Date(`2026-10-01T${hhmm}:00.000Z`)

describe('ortalamaCevrim', () => {
  it('MAS örneği: 231,9 dk iş, 16,1 dk duruş, 109 adet → ~118,8 sn', () => {
    const r = ortalamaCevrim({
      baslangic: t('04:37'),
      bitis: new Date(t('04:37').getTime() + 231.9 * 60_000),
      adet: 109,
      duruslar: [
        { baslangic: t('06:00'), bitis: t('06:15') },
        { baslangic: t('07:00'), bitis: new Date(t('07:00').getTime() + 66_000) },
      ],
    })
    expect(r.durusSn).toBeCloseTo(15 * 60 + 66, 5)
    expect(r.ortSn!).toBeCloseTo((231.9 * 60 - 966) / 109, 5)
  })

  it('pencere dışına taşan ve açık duruş kırpılır', () => {
    const r = ortalamaCevrim({
      baslangic: t('08:00'),
      bitis: t('09:00'),
      adet: 10,
      duruslar: [
        { baslangic: t('07:30'), bitis: t('08:10') },
        { baslangic: t('08:50'), bitis: null },
      ],
    })
    expect(r.durusSn).toBe(20 * 60)
    expect(r.ortSn).toBe(240)
  })

  it('çakışan duruşlar iki kez düşülmez', () => {
    const r = ortalamaCevrim({
      baslangic: t('08:00'),
      bitis: t('09:00'),
      adet: 1,
      duruslar: [
        { baslangic: t('08:10'), bitis: t('08:30') },
        { baslangic: t('08:20'), bitis: t('08:40') },
      ],
    })
    expect(r.durusSn).toBe(30 * 60)
  })

  it('adet 0 → null', () => {
    expect(ortalamaCevrim({ baslangic: t('08:00'), bitis: t('09:00'), adet: 0, duruslar: [] }).ortSn).toBeNull()
  })
})
