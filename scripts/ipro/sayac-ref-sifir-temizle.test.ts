import { describe, it, expect } from 'vitest'
import { refSifirOlaylari } from './sayac-ref-sifir-temizle'

describe('refSifirOlaylari — ref=0 gap-kurtarma log ayrıştırma', () => {
  it('ref 0 satırını yakalar (ts, pin, delta)', () => {
    const o = refSifirOlaylari(['[2026-09-28T15:25:59.756Z] ↺ PANO-1 pin 100 GAP KURTARMA (ref 0 → 5918) delta=5918 — restart/reconnect boşluğu geri kazanıldı'])
    expect(o).toHaveLength(1)
    expect(o[0]).toMatchObject({ pinKod: 100, delta: 5918 })
    expect(o[0].ts).toBe(Date.parse('2026-09-28T15:25:59.756Z'))
  })
  it('ref>0 (gerçek kurtarma) ve diğer satırları YOK SAYAR', () => {
    const o = refSifirOlaylari([
      '[2026-09-28T14:02:04.587Z] ↺ PANO-1 pin 35 GAP KURTARMA (ref 1224376 → 1224776) delta=400 — ...',
      '[2026-09-28T14:02:04.131Z] IPRO PLC Poller başlıyor',
      '[2026-09-28T15:00:00.000Z] ↺ PANO-1 pin 9 GAP KURTARMA (ref 0 → 1042) delta=1042 — ...',
    ])
    expect(o).toHaveLength(1)
    expect(o[0].pinKod).toBe(9)
  })
})
