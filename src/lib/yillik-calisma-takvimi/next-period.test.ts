import { describe, expect, it } from 'vitest'
import type { YillikTakvimPeriyot } from '@/generated/prisma'
import { sonrakiDonemHesaplanabilir, sonrakiDonemTarihi } from './next-period'

describe('sonraki dönem tarih hesabı', () => {
  it.each<[YillikTakvimPeriyot, string]>([
    ['GUNLUK', '2026-01-02'],
    ['HAFTALIK', '2026-01-08'],
    ['IKI_HAFTADA_BIR', '2026-01-15'],
    ['AYLIK', '2026-02-01'],
    ['IKI_AYDA_BIR', '2026-03-01'],
    ['UC_AYLIK', '2026-04-01'],
    ['ALTI_AYLIK', '2026-07-01'],
    ['YILLIK', '2027-01-01'],
    ['IKI_YILDA_BIR', '2028-01-01'],
    ['UC_YILDA_BIR', '2029-01-01'],
  ])('%s periyodunu doğru öteler', (periyot, expected) => {
    expect(sonrakiDonemTarihi(new Date('2026-01-01T00:00:00.000Z'), periyot)?.toISOString().slice(0, 10)).toBe(expected)
    expect(sonrakiDonemHesaplanabilir(periyot)).toBe(true)
  })

  it.each<YillikTakvimPeriyot>(['TEK_SEFERLIK', 'OZEL', 'BELIRLI_AYLAR', 'BELIRLI_TARIHLER'])('%s periyodunda tarihi kopyalamaz', periyot => {
    expect(sonrakiDonemTarihi(new Date('2026-01-01T00:00:00.000Z'), periyot)).toBeNull()
    expect(sonrakiDonemHesaplanabilir(periyot)).toBe(false)
  })
})
