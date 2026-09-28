import { describe, it, expect } from 'vitest'
import { carpanSec } from './sayac-carpani'

describe('carpanSec — çözüm sırası tezgahlı > tezgahsız > null', () => {
  const satirlar = [
    { tezgahKod: null, carpan: 2 },
    { tezgahKod: 'PE01', carpan: 4 },
    { tezgahKod: 'PE02', carpan: 8 },
  ]
  it('tezgahlı eşleşme öncelikli', () => {
    expect(carpanSec(satirlar, 'PE01')).toBe(4)
    expect(carpanSec(satirlar, 'PE02')).toBe(8)
  })
  it('tezgahlı yoksa tezgahsız (genel)', () => {
    expect(carpanSec(satirlar, 'PE99')).toBe(2) // PE99 satırı yok → genel 2
  })
  it('tezgahKod verilmezse genel', () => {
    expect(carpanSec(satirlar)).toBe(2)
    expect(carpanSec(satirlar, null)).toBe(2)
  })
  it('hiç eşleşme yoksa null (çağıran 1 varsayar)', () => {
    expect(carpanSec([{ tezgahKod: 'PE01', carpan: 4 }], 'PE99')).toBeNull()
    expect(carpanSec([], 'PE01')).toBeNull()
  })
})
