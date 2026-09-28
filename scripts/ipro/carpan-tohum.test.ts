import { describe, it, expect } from 'vitest'
import { hedefleriTuret } from './carpan-tohum'

const R = (WorkCenterCode: string, CounterMultiplier: number, n: number, wo: number) =>
  ({ MaterialCode: 'P1', OperationCode: '10', WorkCenterCode, CounterMultiplier, n, wo })

describe('hedefleriTuret — tohum kuralları', () => {
  it('TEK çarpan → tezgahsız (genel) satır, baskinPay=100, dogrulanacak=false', () => {
    const h = hedefleriTuret([R('PE01', 2, 50, 5), R('PE02', 2, 30, 3)])
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ tezgahKod: null, carpan: 2, baskinPay: 100, isSayisi: 8, dogrulanacak: false })
  })

  it('tezgaha göre BASKIN değişiyor → tezgah başına satır', () => {
    // PE01 baskın 4, PE02 baskın 8 → iki tezgahlı satır
    const h = hedefleriTuret([R('PE01', 4, 10, 4), R('PE01', 2, 1, 1), R('PE02', 8, 9, 3)])
    expect(h).toHaveLength(2)
    const pe01 = h.find((x) => x.tezgahKod === 'PE01')!
    const pe02 = h.find((x) => x.tezgahKod === 'PE02')!
    expect(pe01.carpan).toBe(4)
    expect(pe01.baskinPay).toBe(90.9) // 10/11
    expect(pe01.dogrulanacak).toBe(false)
    expect(pe02).toMatchObject({ carpan: 8, baskinPay: 100, dogrulanacak: false })
  })

  it('baskın pay < %80 → dogrulanacak=true (tezgahlı)', () => {
    // PE01 baskın 4 ama pay %57 (<80); PE02 baskın 8 → tezgaha göre değişiyor
    const h = hedefleriTuret([R('PE01', 4, 4, 2), R('PE01', 2, 3, 1), R('PE02', 8, 5, 2)])
    const pe01 = h.find((x) => x.tezgahKod === 'PE01')!
    expect(pe01.carpan).toBe(4)
    expect(pe01.baskinPay).toBe(57.1) // 4/7
    expect(pe01.dogrulanacak).toBe(true)
  })

  it('çok çarpan ama baskın tezgaha göre AYNI → genel satır (genel baskın+pay)', () => {
    // iki tezgah da baskın 2; toplam 2×(50+30)=... 2 baskın, 4 azınlık
    const h = hedefleriTuret([R('PE01', 2, 50, 5), R('PE01', 4, 10, 1), R('PE02', 2, 30, 3)])
    expect(h).toHaveLength(1)
    expect(h[0].tezgahKod).toBeNull()
    expect(h[0].carpan).toBe(2)
    expect(h[0].baskinPay).toBe(88.9) // 80/90
    expect(h[0].dogrulanacak).toBe(false)
  })

  it('çok çarpanlı genel + pay<80 → dogrulanacak=true', () => {
    const h = hedefleriTuret([R('PE01', 2, 5, 2), R('PE01', 4, 5, 2)]) // tek tezgah, 50/50
    expect(h).toHaveLength(1)
    expect(h[0].tezgahKod).toBeNull()
    expect(h[0].baskinPay).toBe(50)
    expect(h[0].dogrulanacak).toBe(true)
  })
})
