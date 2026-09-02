import { describe, expect, it } from 'vitest'
import {
  GUZERGAH_LISTESI_HEADERS,
  guzergahListesiSatirlariOlustur,
  type GuzergahListesiKaynak,
  dilimEtiketi,
  guzergahDetayDuraklariniHazirla,
  guzergahDetayAracAtamalariniHazirla,
  guzergahDetaySoforAtamalariniHazirla,
} from './export'

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

describe('dilimEtiketi', () => {
  it('GIDIS için "Gidiş", DONUS için "Dönüş" yazar', () => {
    expect(dilimEtiketi({ kod: 'S1', yon: 'GIDIS' })).toBe('S1 (Gidiş)')
    expect(dilimEtiketi({ kod: 'S1', yon: 'DONUS' })).toBe('S1 (Dönüş)')
  })
})

describe('guzergahDetayDuraklariniHazirla', () => {
  it('saatleri "dilim (yön): saat" biçiminde, virgülle ayırıp birleştirir', () => {
    const sonuc = guzergahDetayDuraklariniHazirla([
      {
        sira: 1,
        durak: { kod: 'D1', ad: 'Durak 1' },
        saatler: [
          { saat: '08:00', dilim: { kod: 'S1', yon: 'GIDIS' } },
          { saat: '17:00', dilim: { kod: 'S1', yon: 'DONUS' } },
        ],
      },
    ])
    expect(sonuc).toEqual([
      { sira: 1, durakKod: 'D1', durakAd: 'Durak 1', saatlerMetni: 'S1 (Gidiş): 08:00, S1 (Dönüş): 17:00' },
    ])
  })

  it('hiç saati olmayan durak için em-dash ("—") yazar, hata vermez', () => {
    const sonuc = guzergahDetayDuraklariniHazirla([{ sira: 1, durak: { kod: 'D1', ad: 'Durak 1' }, saatler: [] }])
    expect(sonuc[0].saatlerMetni).toBe('—')
  })

  it('birden fazla durağı sırasıyla (girdi sırasını KORUYARAK) döner', () => {
    const sonuc = guzergahDetayDuraklariniHazirla([
      { sira: 1, durak: { kod: 'D1', ad: 'Durak 1' }, saatler: [] },
      { sira: 2, durak: { kod: 'D2', ad: 'Durak 2' }, saatler: [] },
    ])
    expect(sonuc.map((s) => s.durakKod)).toEqual(['D1', 'D2'])
  })
})

describe('guzergahDetayAracAtamalariniHazirla', () => {
  it('dilim etiketini, plakayı, kapasiteyi ve rolü doğru eşler', () => {
    const sonuc = guzergahDetayAracAtamalariniHazirla([
      { dilim: { kod: 'S1', yon: 'GIDIS' }, arac: { plaka: '41ABC123', kapasite: 16 }, rol: 'ANA' },
    ])
    expect(sonuc).toEqual([{ dilimEtiket: 'S1 (Gidiş)', plaka: '41ABC123', kapasite: 16, rol: 'ANA' }])
  })

  it('boş listede boş dizi döner', () => {
    expect(guzergahDetayAracAtamalariniHazirla([])).toEqual([])
  })
})

describe('guzergahDetaySoforAtamalariniHazirla', () => {
  it('dilim etiketini, ad soyadı ve rolü doğru eşler', () => {
    const sonuc = guzergahDetaySoforAtamalariniHazirla([
      { dilim: { kod: 'S1', yon: 'DONUS' }, sofor: { adSoyad: 'Ahmet Yılmaz' }, rol: 'YEDEK' },
    ])
    expect(sonuc).toEqual([{ dilimEtiket: 'S1 (Dönüş)', adSoyad: 'Ahmet Yılmaz', rol: 'YEDEK' }])
  })

  it('boş listede boş dizi döner', () => {
    expect(guzergahDetaySoforAtamalariniHazirla([])).toEqual([])
  })
})
