import { describe, it, expect } from 'vitest'
import { medyan, esikSaniye, cevrimMedyaniGaplerden, ESIK_TABAN_SN, ESIK_TAVAN_SN } from './durus-esik'

describe('medyan', () => {
  it('tek/çift eleman', () => {
    expect(medyan([3, 1, 2])).toBe(2)
    expect(medyan([1, 2, 3, 4])).toBe(2.5)
  })
  it('boş → null', () => {
    expect(medyan([])).toBeNull()
  })
})

describe('esikSaniye — clamp(3.5×çevrim, 180, 900)', () => {
  it('hızlı tezgah (çevrim 15) → taban 180', () => {
    expect(esikSaniye(15)).toBe(ESIK_TABAN_SN) // 3.5×15=52.5 → 180
  })
  it('orta (çevrim 220) → 3.5×220=770', () => {
    expect(esikSaniye(220)).toBe(770)
  })
  it('yavaş (çevrim 400) → tavan 900', () => {
    expect(esikSaniye(400)).toBe(ESIK_TAVAN_SN) // 1400 → 900
  })
  it('çevrim yok/0/negatif → taban', () => {
    expect(esikSaniye(null)).toBe(180)
    expect(esikSaniye(0)).toBe(180)
    expect(esikSaniye(-5)).toBe(180)
  })
})

describe('cevrimMedyaniGaplerden', () => {
  it('uzun duruş gap’i medyanı bozmaz (tavan üstü elenir)', () => {
    // 6 üretim gap’i ~30sn + 1 uzun duruş (5000sn) → medyan yine ~30
    expect(cevrimMedyaniGaplerden([28, 30, 31, 29, 32, 30, 5000])).toBe(30)
  })
  it('hepsi tavan üstüyse yine de medyan döner (fallback)', () => {
    expect(cevrimMedyaniGaplerden([1000, 2000, 3000])).toBe(2000)
  })
  it('boş → null', () => {
    expect(cevrimMedyaniGaplerden([])).toBeNull()
  })
})
