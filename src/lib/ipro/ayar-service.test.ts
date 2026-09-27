import { describe, it, expect } from 'vitest'
import { molaCakismaVar, molaVardiyaIcinde, hhmmDk } from './ayar-service'
import { birlesikEsikAyar } from './ipro-ayar'

describe('hhmmDk', () => {
  it('geçerli/geçersiz', () => {
    expect(hhmmDk('10:00')).toBe(600)
    expect(hhmmDk('07:30')).toBe(450)
    expect(hhmmDk('24:00')).toBeNull()
    expect(hhmmDk('9:00')).toBeNull()
  })
})

describe('molaVardiyaIcinde', () => {
  it('gündüz 07:00–17:00: 12:00/45dk içeride, 16:45/30dk dışarıda', () => {
    expect(molaVardiyaIcinde(720, 45, 420, 1020, false)).toBe(true)
    expect(molaVardiyaIcinde(1005, 30, 420, 1020, false)).toBe(false) // 16:45+30 = 17:15 > 17:00
  })
  it('gece 21:00–07:00 (ertesi): 02:00/30dk içeride, 20:00 dışarıda', () => {
    expect(molaVardiyaIcinde(120, 30, 1260, 420, true)).toBe(true) // 02:00 → +1440
    expect(molaVardiyaIcinde(1200, 30, 1260, 420, true)).toBe(false) // 20:00 < 21:00
  })
})

describe('molaCakismaVar — zaman kesişimi + ortak gün', () => {
  const hep = 127
  it('aynı gün + zaman kesişir → çakışma', () => {
    expect(molaCakismaVar({ baslangicDk: 600, sureDk: 30, gunMaskesi: hep }, [{ baslangicDk: 615, sureDk: 30, gunMaskesi: hep }])).toBe(true)
  })
  it('aynı gün ama zaman ayrık → çakışma yok', () => {
    expect(molaCakismaVar({ baslangicDk: 600, sureDk: 30, gunMaskesi: hep }, [{ baslangicDk: 700, sureDk: 30, gunMaskesi: hep }])).toBe(false)
  })
  it('zaman kesişir ama ortak gün yok → çakışma yok', () => {
    expect(molaCakismaVar({ baslangicDk: 600, sureDk: 30, gunMaskesi: 1 }, [{ baslangicDk: 600, sureDk: 30, gunMaskesi: 2 }])).toBe(false)
  })
  it('sınır teması (bitiş=başlangıç) → çakışma yok', () => {
    expect(molaCakismaVar({ baslangicDk: 600, sureDk: 15, gunMaskesi: hep }, [{ baslangicDk: 615, sureDk: 30, gunMaskesi: hep }])).toBe(false)
  })
})

describe('birlesikEsikAyar — tezgah istisnası genel değeri ezer', () => {
  const genel = { carpan: 3.5, taban: 180, tavan: 900 }
  it('istisna tavanı ezer, taban null → genel taban', () => {
    expect(birlesikEsikAyar(genel, { tabanSn: null, tavanSn: 2000 })).toEqual({ carpan: 3.5, taban: 180, tavan: 2000 })
  })
  it('istisna yok → genel', () => {
    expect(birlesikEsikAyar(genel, null)).toEqual({ carpan: 3.5, taban: 180, tavan: 900 })
  })
})
