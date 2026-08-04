import { describe, it, expect } from 'vitest'
import { idealHesapla, araliklarKesisiyor, IDEAL_ORNEKLEM_ESIGI, type Gozlem } from './ideal-cevrim'

// pencereSn/toplamDelta = çevrim (sn/adet). Örn: 100sn / 50 adet = 2 sn/adet.
const g = (pencereSn: number, toplamDelta: number): Gozlem => ({ pencereSn, toplamDelta })

describe('idealHesapla — saf ideal çevrim', () => {
  it('tek gözlem: ideal = o çevrim, ornekSayisi=1, eşik altı → guvenilir=false', () => {
    const r = idealHesapla([g(100, 50)]) // 2 sn/adet
    expect(r.ideal).toBe(2)
    expect(r.ornekSayisi).toBe(1)
    expect(r.guvenilir).toBe(false)
  })

  it('en hızlı %5 medyanı — tek AYKIRI hızlı gözlem ideali BOZMAZ', () => {
    // 100 gözlem: 99 tanesi ~10 sn/adet, 1 tanesi absürt hızlı 0.1 sn/adet.
    // %5 dilim = ceil(100*0.05)=5 → en hızlı 5'in medyanı. Aykırı tek başına medyanı ele geçiremez.
    const gozlemler: Gozlem[] = []
    gozlemler.push(g(1, 10)) // 0.1 sn/adet (aykırı hızlı)
    for (let i = 0; i < 99; i++) gozlemler.push(g(1000, 100)) // 10 sn/adet
    const r = idealHesapla(gozlemler)
    // en hızlı 5: [0.1, 10, 10, 10, 10] → medyan = 10 (aykırı kenarda kaldı, medyan sağlam)
    expect(r.ideal).toBe(10)
    expect(r.ornekSayisi).toBe(100)
  })

  it('eşik SINIRI: tam eşik kadar gözlem → guvenilir=true', () => {
    const gozlemler = Array.from({ length: IDEAL_ORNEKLEM_ESIGI }, () => g(300, 100)) // 3 sn/adet
    const r = idealHesapla(gozlemler)
    expect(r.ideal).toBe(3)
    expect(r.ornekSayisi).toBe(IDEAL_ORNEKLEM_ESIGI)
    expect(r.guvenilir).toBe(true)
  })

  it('eşik ALTI (eşik−1) → guvenilir=false', () => {
    const gozlemler = Array.from({ length: IDEAL_ORNEKLEM_ESIGI - 1 }, () => g(300, 100))
    expect(idealHesapla(gozlemler).guvenilir).toBe(false)
  })

  it('geçersiz gözlemler (delta<=0 veya pencere<=0) elenir; hiç geçerli yoksa ideal=null', () => {
    const r = idealHesapla([g(100, 0), g(0, 50), g(-5, 10)])
    expect(r.ideal).toBeNull()
    expect(r.ornekSayisi).toBe(0)
    expect(r.guvenilir).toBe(false)
  })

  it('özel eşik parametresi ile guvenilir eşiği ayarlanır', () => {
    const r = idealHesapla([g(100, 50), g(120, 60)], 2) // 2 gözlem, eşik 2 → guvenilir
    expect(r.guvenilir).toBe(true)
  })
})

describe('araliklarKesisiyor — çakışma guard yardımcısı', () => {
  const d = (iso: string) => new Date(iso)
  it('örtüşen aralıklar → true', () => {
    expect(araliklarKesisiyor(d('2026-08-04T10:00:00Z'), d('2026-08-04T12:00:00Z'), d('2026-08-04T11:00:00Z'), d('2026-08-04T13:00:00Z'))).toBe(true)
  })
  it('ayrık aralıklar → false', () => {
    expect(araliklarKesisiyor(d('2026-08-04T10:00:00Z'), d('2026-08-04T11:00:00Z'), d('2026-08-04T12:00:00Z'), d('2026-08-04T13:00:00Z'))).toBe(false)
  })
  it('sınır teması (bitiş==başlangıç) → false (kesişim sayılmaz)', () => {
    expect(araliklarKesisiyor(d('2026-08-04T10:00:00Z'), d('2026-08-04T12:00:00Z'), d('2026-08-04T12:00:00Z'), d('2026-08-04T13:00:00Z'))).toBe(false)
  })
})
