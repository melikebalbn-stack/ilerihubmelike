import { describe, it, expect } from 'vitest'
import {
  planliSaniyeHesapla,
  oeeBilesenleri,
  oeeHesaplanabilir,
  type VardiyaSaat,
} from './oee-hesap'
import type { IproTatilTip } from './takvim-util'

// Gündüz vardiyası 07:00–17:00 YEREL (UTC+3) = 04:00–14:00 UTC, 10 saat = 36000 sn.
const GUNDUZ: VardiyaSaat = { baslangicSaat: '07:00', bitisSaat: '17:00', ertesiGuneTasar: false }
// Gece vardiyası 21:00–07:00 YEREL ertesi gün = 18:00Z–04:00Z(+1), 10 saat.
const GECE: VardiyaSaat = { baslangicSaat: '21:00', bitisSaat: '07:00', ertesiGuneTasar: true }
const bosTatil = () => new Map<string, IproTatilTip>()

describe('planliSaniyeHesapla — vardiya+tatil kesişimi (TZ UTC+3)', () => {
  it('normal iş günü (Pazartesi) tam gündüz vardiyası → 36000 sn', () => {
    // 2026-08-10 Pazartesi. Pencere = vardiya ile birebir (04:00Z–14:00Z).
    const r = planliSaniyeHesapla(
      new Date('2026-08-10T04:00:00Z'),
      new Date('2026-08-10T14:00:00Z'),
      [GUNDUZ],
      bosTatil(),
    )
    expect(r).toBe(36000)
  })

  it('pencere vardiyadan geniş → yalnız vardiya kesişimi sayılır (36000)', () => {
    const r = planliSaniyeHesapla(
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-08-10T23:59:59Z'),
      [GUNDUZ],
      bosTatil(),
    )
    expect(r).toBe(36000)
  })

  it('Pazar otomatik TATIL → planli 0 (2026-08-09 Pazar)', () => {
    const r = planliSaniyeHesapla(
      new Date('2026-08-09T04:00:00Z'),
      new Date('2026-08-09T14:00:00Z'),
      [GUNDUZ],
      bosTatil(),
    )
    expect(r).toBe(0)
  })

  it('MESAI istisnası Pazar’ı çalışmaya çevirir → 36000', () => {
    const map = new Map<string, IproTatilTip>([['2026-08-09', 'MESAI']])
    const r = planliSaniyeHesapla(
      new Date('2026-08-09T04:00:00Z'),
      new Date('2026-08-09T14:00:00Z'),
      [GUNDUZ],
      map,
    )
    expect(r).toBe(36000)
  })

  it('TATIL istisnası iş gününü sıfırlar → 0', () => {
    const map = new Map<string, IproTatilTip>([['2026-08-10', 'TATIL']])
    const r = planliSaniyeHesapla(
      new Date('2026-08-10T04:00:00Z'),
      new Date('2026-08-10T14:00:00Z'),
      [GUNDUZ],
      map,
    )
    expect(r).toBe(0)
  })

  it('YARIM gün → yarım planlı (18000)', () => {
    const map = new Map<string, IproTatilTip>([['2026-08-10', 'YARIM']])
    const r = planliSaniyeHesapla(
      new Date('2026-08-10T04:00:00Z'),
      new Date('2026-08-10T14:00:00Z'),
      [GUNDUZ],
      map,
    )
    expect(r).toBe(18000)
  })

  it('gece vardiyası (ertesiGuneTasar) doğru kesişim — başladığı günün faktörü (36000)', () => {
    // Başlangıç 2026-08-10 21:00 yerel (18:00Z), bitiş 2026-08-11 07:00 yerel (04:00Z+1). Pzt CALISMA.
    const r = planliSaniyeHesapla(
      new Date('2026-08-10T18:00:00Z'),
      new Date('2026-08-11T04:00:00Z'),
      [GECE],
      bosTatil(),
    )
    expect(r).toBe(36000)
  })

  it('boş vardiya listesi → 0', () => {
    expect(planliSaniyeHesapla(new Date('2026-08-10T04:00:00Z'), new Date('2026-08-10T14:00:00Z'), [], bosTatil())).toBe(0)
  })

  it('bitiş <= başlangıç → 0', () => {
    expect(planliSaniyeHesapla(new Date('2026-08-10T14:00:00Z'), new Date('2026-08-10T04:00:00Z'), [GUNDUZ], bosTatil())).toBe(0)
  })
})

describe('oeeBilesenleri — formüller, null yayılımı, hesapKaynagi dalları', () => {
  it('TAM: üç bileşen de dolu, formüller doğru', () => {
    const b = oeeBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilenAdet: 400, iyiAdet: 380, idealSaniyeAdet: 2, cakismaVar: false })
    // calisma=900. avail=0.9. perf=2*400/900=0.8889. quality=380/400=0.95.
    expect(b.availability).toBeCloseTo(0.9, 5)
    expect(b.performance).toBeCloseTo(0.888888, 4)
    expect(b.quality).toBeCloseTo(0.95, 5)
    expect(b.oee).toBeCloseTo(0.9 * (800 / 900) * 0.95, 5)
    expect(b.hesapKaynagi).toBe('TAM')
  })

  it('PERF_YOK: ideal null → performance & oee null', () => {
    const b = oeeBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilenAdet: 400, iyiAdet: 380, idealSaniyeAdet: null, cakismaVar: false })
    expect(b.availability).toBeCloseTo(0.9, 5)
    expect(b.performance).toBeNull()
    expect(b.quality).toBeCloseTo(0.95, 5)
    expect(b.oee).toBeNull()
    expect(b.hesapKaynagi).toBe('PERF_YOK')
  })

  it('PLANLI_YOK: planli 0 → availability null, oee null', () => {
    const b = oeeBilesenleri({ planliSaniye: 0, durusSaniye: 0, uretilenAdet: 400, iyiAdet: 400, idealSaniyeAdet: 2, cakismaVar: false })
    expect(b.availability).toBeNull()
    expect(b.performance).toBeNull() // calisma=0 değil ama planli 0 → calisma=0 → perf null
    expect(b.oee).toBeNull()
    expect(b.hesapKaynagi).toBe('PLANLI_YOK')
  })

  it('CAKISMA_VAR: her şey dolu olsa bile çakışma işareti öncelikli', () => {
    const b = oeeBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilenAdet: 400, iyiAdet: 380, idealSaniyeAdet: 2, cakismaVar: true })
    expect(b.hesapKaynagi).toBe('CAKISMA_VAR')
    // bileşenler yine hesaplanır (yazılır, işaretlenir)
    expect(b.oee).not.toBeNull()
  })

  it('null yayılımı: uretilen 0 → quality null → oee null', () => {
    const b = oeeBilesenleri({ planliSaniye: 1000, durusSaniye: 100, uretilenAdet: 0, iyiAdet: 0, idealSaniyeAdet: 2, cakismaVar: false })
    expect(b.quality).toBeNull()
    expect(b.oee).toBeNull()
  })
})

describe('oeeHesaplanabilir — kapandı filtresi + legacy guard', () => {
  const bas = new Date('2026-08-10T04:00:00Z')
  const bit = new Date('2026-08-10T14:00:00Z')

  it('tamamlandi=true + kapanmış + hesapKaynagi dolu → hesaplanır', () => {
    expect(oeeHesaplanabilir({ tamamlandi: true, baslatildiAt: bas, bitirildiAt: bit, uretimAdet: 100, hesapKaynagi: 'DELTA' })).toBe(true)
  })

  it('LEGACY: tamamlandi=true ama uretimAdet & hesapKaynagi null (30.07 öncesi terk) → hesaplanmaz', () => {
    expect(oeeHesaplanabilir({ tamamlandi: true, baslatildiAt: bas, bitirildiAt: bit, uretimAdet: null, hesapKaynagi: null })).toBe(false)
  })

  it('tamamlandi=false → hesaplanmaz', () => {
    expect(oeeHesaplanabilir({ tamamlandi: false, baslatildiAt: bas, bitirildiAt: bit, uretimAdet: 100, hesapKaynagi: 'DELTA' })).toBe(false)
  })

  it('bitirildiAt null → hesaplanmaz', () => {
    expect(oeeHesaplanabilir({ tamamlandi: true, baslatildiAt: bas, bitirildiAt: null, uretimAdet: 100, hesapKaynagi: 'DELTA' })).toBe(false)
  })
})
