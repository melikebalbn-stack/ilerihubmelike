import { describe, it, expect } from 'vitest'
import {
  employeeNoToSicilNo,
  workCenterToTezgahKod,
  uretimAdedi,
  isEmirineGrupla,
  type MasUretimGirdi,
} from './uretim-mapper'

describe('employeeNoToSicilNo', () => {
  it('4 haneli → ILR- + 5 haneye sıfır dolgu', () => {
    expect(employeeNoToSicilNo('0029')).toBe('ILR-00029')
    expect(employeeNoToSicilNo('0282')).toBe('ILR-00282')
    expect(employeeNoToSicilNo('0711')).toBe('ILR-00711')
  })
  it('5 haneli → aynen', () => {
    expect(employeeNoToSicilNo('01151')).toBe('ILR-01151')
  })
  it('rakam-dışı karakter temizlenir', () => {
    expect(employeeNoToSicilNo(' 29 ')).toBe('ILR-00029')
    expect(employeeNoToSicilNo('EMP0029')).toBe('ILR-00029')
  })
  it('boş/null/rakamsız → null', () => {
    expect(employeeNoToSicilNo(null)).toBeNull()
    expect(employeeNoToSicilNo('')).toBeNull()
    expect(employeeNoToSicilNo('ABC')).toBeNull()
  })
})

describe('workCenterToTezgahKod', () => {
  it('birebir trim', () => {
    expect(workCenterToTezgahKod(' 501 ')).toBe('501')
    expect(workCenterToTezgahKod('CN03')).toBe('CN03')
  })
  it('boş → null', () => {
    expect(workCenterToTezgahKod('')).toBeNull()
    expect(workCenterToTezgahKod(null)).toBeNull()
  })
})

describe('uretimAdedi', () => {
  it('Amount > 0 → Amount', () => {
    expect(uretimAdedi({ amount: 100, reportedAmount: 50 })).toBe(100)
  })
  it('Amount 0/negatif → ReportedAmount', () => {
    expect(uretimAdedi({ amount: 0, reportedAmount: 50 })).toBe(50)
    expect(uretimAdedi({ amount: null, reportedAmount: 42 })).toBe(42)
  })
  it('CounterMultiplier/Divider uygulanır', () => {
    expect(uretimAdedi({ amount: 100, counterMultiplier: 2 })).toBe(200)
    expect(uretimAdedi({ amount: 100, counterDivider: 4 })).toBe(25)
    expect(uretimAdedi({ amount: 100, counterMultiplier: 3, counterDivider: 2 })).toBe(150)
  })
  it('geçersiz multiplier/divider → 1 (nötr)', () => {
    expect(uretimAdedi({ amount: 100, counterMultiplier: 0, counterDivider: 0 })).toBe(100)
    expect(uretimAdedi({ amount: 100, counterMultiplier: null, counterDivider: -1 })).toBe(100)
  })
  it('hiç adet yok → 0', () => {
    expect(uretimAdedi({ amount: 0, reportedAmount: 0 })).toBe(0)
    expect(uretimAdedi({})).toBe(0)
  })
})

describe('isEmirineGrupla', () => {
  const g = (o: Partial<MasUretimGirdi>): MasUretimGirdi => ({
    masId: 1, tezgahKod: '501', employeeNo: '0029', workOrderNo: 'WO-1', amount: 10, ...o,
  })

  it('aynı WorkOrderNo farklı operasyon → tek iş, adet tekrar edilmiş (max)', () => {
    const r = isEmirineGrupla([
      g({ masId: 1, operasyonNo: '10', amount: 168 }),
      g({ masId: 2, operasyonNo: '20', amount: 168 }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].workOrderNo).toBe('WO-1')
    expect(r[0].adet).toBe(168)
    expect(r[0].satirSayisi).toBe(2)
  })

  it('farklı WorkOrderNo → ayrı iş', () => {
    const r = isEmirineGrupla([g({ workOrderNo: 'WO-1' }), g({ workOrderNo: 'WO-2' })])
    expect(r).toHaveLength(2)
  })

  it('WorkOrderNo boş → PM bazında ayrı grup (birleştirme yok)', () => {
    const r = isEmirineGrupla([g({ masId: 5, workOrderNo: null }), g({ masId: 6, workOrderNo: '' })])
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.anahtar).sort()).toEqual(['PM:5', 'PM:6'])
  })

  it('temsili masProductionMasterId + operasyonNo DETERMİNİSTİK (min) — satır sırasından bağımsız', () => {
    const artan = isEmirineGrupla([
      g({ masId: 100, operasyonNo: '10' }),
      g({ masId: 90, operasyonNo: '20' }),
    ])
    const azalan = isEmirineGrupla([
      g({ masId: 90, operasyonNo: '20' }),
      g({ masId: 100, operasyonNo: '10' }),
    ])
    // İki farklı sırada da aynı temsili değerler (min) → idempotent upsert anahtarı.
    expect(artan[0].masProductionMasterId).toBe(90)
    expect(artan[0].operasyonNo).toBe('10')
    expect(azalan[0].masProductionMasterId).toBe(90)
    expect(azalan[0].operasyonNo).toBe('10')
  })

  it('grup masProductionMasterId + operasyonNo alanları dolu', () => {
    const r = isEmirineGrupla([g({ masId: 42, operasyonNo: '30', workOrderNo: 'WO-9' })])
    expect(r[0].masProductionMasterId).toBe(42)
    expect(r[0].operasyonNo).toBe('30')
    expect(r[0].workOrderNo).toBe('WO-9')
  })
})
