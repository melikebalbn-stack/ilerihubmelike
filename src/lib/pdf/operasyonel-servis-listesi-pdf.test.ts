import { describe, expect, it } from 'vitest'
import { generateOperasyonelServisListesiPdfBuffer } from './operasyonel-servis-listesi-pdf'
import type { OperasyonelServisListesiSatiri } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'

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

describe('generateOperasyonelServisListesiPdfBuffer', () => {
  it('gerçek PDF üretir (%PDF- magic byte)', () => {
    const buf = generateOperasyonelServisListesiPdfBuffer({ tarih: '2026-09-22', satirlar: [ornekSatir()] })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('boş satır listesiyle de (yalnız başlık) hata fırlatmadan üretir', () => {
    const buf = generateOperasyonelServisListesiPdfBuffer({ tarih: '2026-09-22', satirlar: [] })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('gecmisTarihSecildi notuyla da hata fırlatmadan üretir (uzun metin dahil satır kaydırma)', () => {
    const buf = generateOperasyonelServisListesiPdfBuffer({
      tarih: '2020-01-01',
      satirlar: [ornekSatir()],
      not: 'Personel listesi 01.01.2020 itibarıyla; saat ve durak bilgileri güncel tanımlara göredir.',
    })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(0)
  })

  it('çok satırlı (sayfa kırılımı tetikleyecek kadar) listede de hata fırlatmadan üretir', () => {
    const cokSatir = Array.from({ length: 80 }, (_, i) => ornekSatir({ personnelId: `p${i}`, sicilNo: String(i), adSoyad: `Personel ${i}` }))
    const buf = generateOperasyonelServisListesiPdfBuffer({ tarih: '2026-09-22', satirlar: cokSatir })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
