import { describe, it, expect } from 'vitest'
import { ACIK_TICKET_DURUMLARI_DIZI, acikTicketMi } from './durumlar'
import { DURAKLATAN_DURUMLAR, duraklatiyorMu, kapaliMi } from '@/lib/sla/ihlal'

describe('açık ticket durumları', () => {
  it('kapanış durumları açık sayılmaz', () => {
    for (const d of ['RESOLVED', 'CLOSED', 'CANCELLED']) expect(acikTicketMi(d)).toBe(false)
  })

  it('PURCHASING açık bir durumdur — listeden ve sayımlardan düşmez', () => {
    expect(acikTicketMi('PURCHASING')).toBe(true)
    expect(ACIK_TICKET_DURUMLARI_DIZI).toContain('PURCHASING')
  })

  it('bilinmeyen değer açık sayılmaz', () => {
    expect(acikTicketMi('YOK')).toBe(false)
    expect(acikTicketMi(null)).toBe(false)
  })
})

describe('SLA duraklatma', () => {
  it('satınalma süreci SLA saatini durdurur', () => {
    expect(duraklatiyorMu('PURCHASING')).toBe(true)
    expect(DURAKLATAN_DURUMLAR).toContain('PURCHASING')
  })

  it('beklemede ve askıda da durdurur (mevcut davranış korundu)', () => {
    expect(duraklatiyorMu('PENDING')).toBe(true)
    expect(duraklatiyorMu('ON_HOLD')).toBe(true)
  })

  it('satınalma KAPALI durum değil — talep hâlâ açık', () => {
    expect(kapaliMi('PURCHASING')).toBe(false)
  })

  it('işlemde durumunda saat işler', () => {
    expect(duraklatiyorMu('IN_PROGRESS')).toBe(false)
    expect(duraklatiyorMu('NEW')).toBe(false)
  })
})
