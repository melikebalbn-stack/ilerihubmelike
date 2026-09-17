import { describe, it, expect } from 'vitest'
import { cevrimSaniye, saniyeToCevrim, cevrimMetni } from './cevrim-util'

describe('cevrimSaniye', () => {
  it('UnitsHour → 3600/faktör', () => {
    expect(cevrimSaniye(60, 'UnitsHour')).toBe(60) // 60 adet/saat → 60 sn/adet
  })
  it('HoursUnit → faktör*3600', () => {
    expect(cevrimSaniye(0.02, 'HoursUnit')).toBeCloseTo(72)
  })
  it('faktör 0/null veya bilinmeyen kod → null', () => {
    expect(cevrimSaniye(0, 'HoursUnit')).toBeNull()
    expect(cevrimSaniye(null, 'HoursUnit')).toBeNull()
    expect(cevrimSaniye(10, 'Bilinmeyen')).toBeNull()
  })
})

describe('cevrimMetni — ham faktör DEĞİL saniye + adet/saat', () => {
  it('0.019444 HoursUnit → "70 sn · 51,4 adet/saat"', () => {
    // Bug (c): ekranda ham "0.019444 HoursUnit" yerine saniye görünmeli.
    expect(cevrimMetni(70 / 3600, 'HoursUnit')).toBe('70 sn · 51,4 adet/saat')
  })
  it('UnitsHour da desteklenir', () => {
    expect(cevrimMetni(60, 'UnitsHour')).toBe('60 sn · 60 adet/saat') // 60 adet/saat → 60 sn/adet
  })
  it('çevrilemez → null', () => {
    expect(cevrimMetni(0, 'HoursUnit')).toBeNull()
    expect(cevrimMetni(null, 'HoursUnit')).toBeNull()
    expect(cevrimMetni(10, 'Bilinmeyen')).toBeNull()
  })
})

describe('saniyeToCevrim', () => {
  it('saniye → HoursUnit faktör (saniye/3600)', () => {
    expect(saniyeToCevrim(72)).toEqual({ faktor: 72 / 3600, kod: 'HoursUnit' })
  })
  it('0/null → null', () => {
    expect(saniyeToCevrim(0)).toBeNull()
    expect(saniyeToCevrim(null)).toBeNull()
    expect(saniyeToCevrim(undefined)).toBeNull()
  })
  it('cevrimSaniye ile TAM round-trip', () => {
    for (const sn of [16, 31, 70.0117, 240]) {
      const c = saniyeToCevrim(sn)!
      expect(cevrimSaniye(c.faktor, c.kod)).toBeCloseTo(sn, 6)
    }
  })
})
