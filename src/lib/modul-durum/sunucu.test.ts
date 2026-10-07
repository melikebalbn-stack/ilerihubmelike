import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth/require-user', () => ({ requireUser: vi.fn() }))

import { yayinGorunurMu } from './sunucu'

const pilot = (...bolumler: string[]) => ({ durum: 'PILOT' as const, pilotBolumler: bolumler })

describe('yayinGorunurMu — PILOT kapısı', () => {
  it('🔴 Personnel bölüm adı (personelBolum) listedekiyle eşleşirse görür; AD serbest metni ("Departmanı") tutmasa da', () => {
    const k = { role: 'HR_MANAGER', department: 'İnsan Varlıkları Departmanı', personelBolum: 'İnsan Varlıkları Müdürlüğü' }
    expect(yayinGorunurMu(pilot('İnsan Varlıkları Müdürlüğü', 'İdari İşler'), k)).toBe(true)
  })

  it('🔴 AD department boşken (İdari İşler sorumlusu) personelBolum ile görür', () => {
    expect(yayinGorunurMu(pilot('İdari İşler'), { role: 'EMPLOYEE', department: null, personelBolum: 'İdari İşler' })).toBe(true)
  })

  it('personelBolum yoksa eski davranış: department eşleşirse görür (geri uyum)', () => {
    expect(yayinGorunurMu(pilot('Kalite Müdürlüğü'), { role: 'EMPLOYEE', department: 'Kalite Müdürlüğü' })).toBe(true)
  })

  it('negatif: bölüm listede değilse görmez', () => {
    expect(yayinGorunurMu(pilot('İdari İşler'), { role: 'EMPLOYEE', department: 'Kalite', personelBolum: 'Kalite Müdürlüğü' })).toBe(false)
  })

  it('negatif: iki alan da boşsa görmez', () => {
    expect(yayinGorunurMu(pilot('İdari İşler'), { role: 'EMPLOYEE', department: null, personelBolum: null })).toBe(false)
  })

  it('Türkçe normalize: İ/ı/ş farkı eşleşmeyi bozmaz', () => {
    expect(yayinGorunurMu(pilot('İDARİ İŞLER'), { role: 'EMPLOYEE', personelBolum: 'idari isler' })).toBe(true)
  })

  it('SUPER_ADMIN PILOT ve GIZLI görür, ACIK herkes görür, GIZLI diğerleri görmez', () => {
    expect(yayinGorunurMu(pilot(), { role: 'SUPER_ADMIN' })).toBe(true)
    expect(yayinGorunurMu({ durum: 'GIZLI', pilotBolumler: [] }, { role: 'SUPER_ADMIN' })).toBe(true)
    expect(yayinGorunurMu({ durum: 'GIZLI', pilotBolumler: ['İdari İşler'] }, { role: 'EMPLOYEE', personelBolum: 'İdari İşler' })).toBe(false)
    expect(yayinGorunurMu({ durum: 'ACIK', pilotBolumler: [] }, { role: 'EMPLOYEE' })).toBe(true)
  })
})
