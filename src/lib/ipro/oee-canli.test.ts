import { describe, it, expect } from 'vitest'
import { oeeCanliBilesenleri } from './oee-canli'

describe('oeeCanliBilesenleri — açık iş canlı OEE (quality null)', () => {
  it('ideal güvenilir: availability + performance dolu, quality null, oeeCanli = A×P', () => {
    // planli=1000, durus=100 → calisma=900. avail=0.9. perf=2×400/900=0.8889.
    const r = oeeCanliBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilen: 400, idealSaniyeAdet: 2 })
    expect(r.availability).toBeCloseTo(0.9, 5)
    expect(r.performance).toBeCloseTo(0.888888, 4)
    expect(r.quality).toBeNull()
    expect(r.oeeCanli).toBeCloseTo(0.9 * (800 / 900), 5)
    expect(r.durum).toBe('CANLI_KISMI')
  })

  it('ideal YOK (birikiyor): performance null → oeeCanli null, availability yine dolu', () => {
    const r = oeeCanliBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilen: 400, idealSaniyeAdet: null })
    expect(r.availability).toBeCloseTo(0.9, 5)
    expect(r.performance).toBeNull()
    expect(r.oeeCanli).toBeNull()
    expect(r.quality).toBeNull()
    expect(r.durum).toBe('CANLI_KISMI')
  })

  it('planli 0 (vardiya dışı): availability null, oeeCanli null, durum PLANLI_YOK', () => {
    const r = oeeCanliBilesenleri({ planliSaniye: 0, durusSaniye: 0, uretilen: 100, idealSaniyeAdet: 2 })
    expect(r.availability).toBeNull()
    expect(r.performance).toBeNull() // calisma=0 → perf null
    expect(r.oeeCanli).toBeNull()
    expect(r.durum).toBe('PLANLI_YOK')
  })

  it('quality her koşulda null (açık işte iyi/hurda yok — seçenek A)', () => {
    const r = oeeCanliBilesenleri({ planliSaniye: 500, durusSaniye: 0, uretilen: 250, idealSaniyeAdet: 1 })
    expect(r.quality).toBeNull()
    // tam OEE (A×P×Q) DEĞİL — yalnız A×P
    expect(r.oeeCanli).toBeCloseTo(r.availability! * r.performance!, 6)
  })
})
