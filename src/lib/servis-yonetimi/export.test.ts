import { describe, expect, it } from 'vitest'
import { GUZERGAH_LISTESI_HEADERS, guzergahListesiSatirlariOlustur, type GuzergahListesiKaynak } from './export'

function guzergah(overrides: Partial<GuzergahListesiKaynak> = {}): GuzergahListesiKaynak {
  return {
    kod: 'G1',
    ad: 'Güzergah 1',
    bolge: 'Gebze',
    aktif: true,
    gecerlilikBaslangici: new Date('2026-01-01T00:00:00.000Z'),
    gecerlilikBitisi: null,
    yerleske: { kod: 'MERKEZ', ad: 'Merkez Yerleşke' },
    _count: { duraklar: 5 },
    ...overrides,
  }
}

describe('guzergahListesiSatirlariOlustur', () => {
  it('ilk satır başlık satırıdır, sabit HEADERS ile birebir aynıdır', () => {
    const rows = guzergahListesiSatirlariOlustur([])
    expect(rows).toEqual([[...GUZERGAH_LISTESI_HEADERS]])
  })

  it('bir güzergahı doğru sırada ve biçimde satıra çevirir', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah()])
    expect(rows[1]).toEqual(['G1', 'Güzergah 1', 'Gebze', 'MERKEZ — Merkez Yerleşke', 5, '01.01.2026', '', 'Aktif'])
  })

  it('pasif güzergahı "Pasif" olarak işaretler (aktif+pasif TÜMÜ listede)', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah({ aktif: false })])
    expect(rows[1][7]).toBe('Pasif')
  })

  it('bolge null ise boş string yazar, hata vermez', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah({ bolge: null })])
    expect(rows[1][2]).toBe('')
  })

  it('geçerlilik tarihleri null ise boş string yazar', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah({ gecerlilikBaslangici: null, gecerlilikBitisi: null })])
    expect(rows[1][5]).toBe('')
    expect(rows[1][6]).toBe('')
  })

  it('birden fazla güzergahı satır satır (başlık + N satır) üretir', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah({ kod: 'G1' }), guzergah({ kod: 'G2' })])
    expect(rows).toHaveLength(3)
    expect(rows[1][0]).toBe('G1')
    expect(rows[2][0]).toBe('G2')
  })

  it('durak sayısını (_count.duraklar) olduğu gibi geçirir', () => {
    const rows = guzergahListesiSatirlariOlustur([guzergah({ _count: { duraklar: 0 } })])
    expect(rows[1][4]).toBe(0)
  })
})
