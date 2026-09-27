import { describe, it, expect } from 'vitest'
import { donemMetrik, cevrimDurum, type OeeKayitGirdi } from './analiz-service'

const k = (o: Partial<OeeKayitGirdi>): OeeKayitGirdi => ({
  planliSaniye: 0, durusSaniye: 0, uretilenAdet: 0, iyiAdet: 0, idealSaniyeAdet: null, cokluIs: false, ...o,
})

describe('donemMetrik — TOPLAMLARDAN (oranların ortalaması DEĞİL)', () => {
  it('availability: eşit olmayan planlı → Σ oranı, ortalama oran DEĞİL', () => {
    // r1: 100/50 → A=0.5 ; r2: 900/90 → A=0.9. Ortalama oran=0.70; toplam oranı=(1000−140)/1000=0.86.
    const r = donemMetrik([
      k({ planliSaniye: 100, durusSaniye: 50 }),
      k({ planliSaniye: 900, durusSaniye: 90 }),
    ])
    expect(r.availability).toBeCloseTo(0.86, 5)
    expect(r.availability).not.toBeCloseTo(0.70, 3) // ortalama oran OLMADIĞINI kanıtlar
  })

  it('performance: Σ(ideal×uretim)/Σ(çalışma)', () => {
    // ideal 2 sn/adet, uretim 100, çalışma 150 → P=200/150=1.333... tek kayıt
    const r = donemMetrik([k({ planliSaniye: 200, durusSaniye: 50, uretilenAdet: 100, idealSaniyeAdet: 2 })])
    expect(r.performance).toBeCloseTo(200 / 150, 5)
  })

  it('COKLU_IS A’ya girer, P/Q’ya girmez', () => {
    const r = donemMetrik([
      k({ planliSaniye: 100, durusSaniye: 20, uretilenAdet: 50, iyiAdet: 50, idealSaniyeAdet: 1, cokluIs: false }),
      k({ planliSaniye: 100, durusSaniye: 80, uretilenAdet: 999, iyiAdet: 0, idealSaniyeAdet: 5, cokluIs: true }),
    ])
    // A: (200−100)/200 = 0.5 (ikisi de)
    expect(r.availability).toBeCloseTo(0.5, 5)
    // Q: yalnız 1. kayıt → 50/50 = 1 (COKLU_IS'in uretilen=999/iyi=0'ı GİRMEZ)
    expect(r.quality).toBe(1)
    // P: yalnız 1. kayıt → (1×50)/(100−20)=0.625
    expect(r.performance).toBeCloseTo(0.625, 5)
  })

  it('boş / sıfır payda → null yayılır', () => {
    expect(donemMetrik([]).oee).toBeNull()
    expect(donemMetrik([k({ planliSaniye: 0 })]).availability).toBeNull()
  })

  it('ideal null kayıt performansa girmez (payda şişmez)', () => {
    const r = donemMetrik([
      k({ planliSaniye: 100, durusSaniye: 0, uretilenAdet: 10, idealSaniyeAdet: null }), // P'ye GİRMEZ
      k({ planliSaniye: 100, durusSaniye: 0, uretilenAdet: 10, idealSaniyeAdet: 5 }),
    ])
    expect(r.performance).toBeCloseTo((5 * 10) / 100, 5) // yalnız 2. kayıt: çalışma 100
  })
})

describe('cevrimDurum — IPRO-001 ile aynı', () => {
  it('planlı ≤ 1 → TANIMSIZ', () => expect(cevrimDurum(1, 50)).toBe('TANIMSIZ'))
  it('ölçülen > planlı → YAVAŞ', () => expect(cevrimDurum(10, 15)).toBe('YAVAŞ'))
  it('ölçülen ≤ planlı → HIZLI', () => expect(cevrimDurum(10, 8)).toBe('HIZLI'))
  it('null → null', () => expect(cevrimDurum(null, 5)).toBeNull())
})
