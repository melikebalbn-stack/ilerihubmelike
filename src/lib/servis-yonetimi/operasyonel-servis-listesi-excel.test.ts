import { describe, expect, it } from 'vitest'
import {
  EXPORT_HEADERS,
  gecmisTarihNotuOlustur,
  operasyonelServisListesiSatirlariOlustur,
} from './operasyonel-servis-listesi-excel'
import type { OperasyonelServisListesiSatiri } from './operasyonel-servis-listesi'

function ornekSatir(overrides: Partial<OperasyonelServisListesiSatiri> = {}): OperasyonelServisListesiSatiri {
  return {
    personnelId: 'p1',
    sicilNo: '111',
    adSoyad: 'Ahmet Yılmaz',
    bolum: 'Üretim',
    guzergahKod: 'G1',
    guzergahAd: 'Güzergah 1',
    durakKod: 'D1',
    durakAd: 'Durak 1',
    sabahSaati: '07:15',
    telefon: '5551112233',
    ...overrides,
  }
}

describe('operasyonelServisListesiSatirlariOlustur', () => {
  it('başlık satırı MASTER madde 29 sütun sırasıyla birebir aynı', () => {
    const rows = operasyonelServisListesiSatirlariOlustur([])
    expect(rows[0]).toEqual([...EXPORT_HEADERS])
    expect(EXPORT_HEADERS).toEqual(['SİCİL', 'AD SOYAD', 'BÖLÜM', 'SERVİS', 'DURAK', 'SABAH SAATİ', 'TELEFON'])
  })

  it('satır doğru sırayla eşlenir, TELEFON dahil (KVKK gereği çıkarılmaz)', () => {
    const rows = operasyonelServisListesiSatirlariOlustur([ornekSatir()])
    expect(rows[1]).toEqual(['111', 'Ahmet Yılmaz', 'Üretim', 'G1 — Güzergah 1', 'D1 — Durak 1', '07:15', '5551112233'])
  })

  it('durak atanmamışsa (durakKod null) DURAK hücresi boş kalır', () => {
    const rows = operasyonelServisListesiSatirlariOlustur([ornekSatir({ durakKod: null, durakAd: null })])
    expect(rows[1][4]).toBe('')
  })

  it('not verilmezse başlık ilk satırdır (ek satır eklenmez)', () => {
    const rows = operasyonelServisListesiSatirlariOlustur([ornekSatir()])
    expect(rows[0]).toEqual([...EXPORT_HEADERS])
    expect(rows).toHaveLength(2) // başlık + 1 veri satırı
  })

  it('not verilirse (gecmisTarihSecildi) not + boş ayraç satırı başlıktan ÖNCE eklenir', () => {
    const rows = operasyonelServisListesiSatirlariOlustur([ornekSatir()], 'Test notu')
    expect(rows[0]).toEqual(['Test notu'])
    expect(rows[1]).toEqual([])
    expect(rows[2]).toEqual([...EXPORT_HEADERS])
    expect(rows[3][1]).toBe('Ahmet Yılmaz')
  })
})

describe('gecmisTarihNotuOlustur', () => {
  it('MASTER metnini tarihle birlikte üretir', () => {
    const not = gecmisTarihNotuOlustur('2026-06-01')
    expect(not).toContain('01.06.2026')
    expect(not).toBe(
      'Personel listesi 01.06.2026 itibarıyla; saat ve durak bilgileri güncel tanımlara göredir.',
    )
  })
})
