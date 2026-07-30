import { describe, it, expect } from 'vitest'
import { pazarMi, gunDurumu, gecerliTatilTip, gecerliSaat, tarihAnahtari, type IproTatilTip } from './takvim-util'

const g = (s: string) => new Date(`${s}T00:00:00.000Z`)

describe('pazarMi / gunDurumu — Pazar otomatik türetme', () => {
  it('Pazar → true, diğer günler false', () => {
    expect(pazarMi(g('2026-08-02'))).toBe(true) // Pazar
    expect(pazarMi(g('2026-08-03'))).toBe(false) // Pazartesi
  })
  it('kayıt YOKKEN Pazar TATIL, hafta içi CALISMA', () => {
    const bos = new Map<string, IproTatilTip>()
    expect(gunDurumu(g('2026-08-02'), bos)).toBe('TATIL') // Pazar
    expect(gunDurumu(g('2026-08-03'), bos)).toBe('CALISMA') // Pzt
  })
  it('istisna kaydı Pazar\'ı bile EZER (MESAI → çalışma)', () => {
    const m = new Map<string, IproTatilTip>([['2026-08-02', 'MESAI']])
    expect(gunDurumu(g('2026-08-02'), m)).toBe('MESAI') // Pazar ama çalışılıyor
  })
  it('resmi tatil hafta içi → TATIL, yarım gün → YARIM', () => {
    const m = new Map<string, IproTatilTip>([['2026-08-30', 'TATIL'], ['2026-08-28', 'YARIM']])
    expect(gunDurumu(g('2026-08-30'), m)).toBe('TATIL')
    expect(gunDurumu(g('2026-08-28'), m)).toBe('YARIM')
  })
})

describe('validation', () => {
  it('tip TATIL/YARIM/MESAI kabul, diğerleri red', () => {
    expect(gecerliTatilTip('TATIL')).toBe(true)
    expect(gecerliTatilTip('YARIM')).toBe(true)
    expect(gecerliTatilTip('MESAI')).toBe(true)
    expect(gecerliTatilTip('BAYRAM')).toBe(false)
    expect(gecerliTatilTip(null)).toBe(false)
  })
  it('saat HH:mm formatı', () => {
    expect(gecerliSaat('07:00')).toBe(true)
    expect(gecerliSaat('23:59')).toBe(true)
    expect(gecerliSaat('24:00')).toBe(false)
    expect(gecerliSaat('7:00')).toBe(false)
    expect(gecerliSaat('07:60')).toBe(false)
  })
  it('tarihAnahtari UTC YYYY-MM-DD (TZ kayması yok)', () => {
    expect(tarihAnahtari(g('2026-08-30'))).toBe('2026-08-30')
  })
})
