import { describe, expect, it } from 'vitest'
import type { KapasiteGuzergahSatiri } from '@/lib/servis-yonetimi/kapasite'
import { panelAramaEslesir, panelSatirlariFiltreleSirala } from './panel-liste'

function satir(
  kod: string, ad: string, araclar: string[],
  o: Partial<KapasiteGuzergahSatiri['ozet']> = {},
): KapasiteGuzergahSatiri {
  return {
    guzergahId: kod, kod, ad, dilimKod: null, dilimSayisi: 1, aracliDilimSayisi: araclar.length, tekilPersonel: o.atananPersonelSayisi ?? 5, araclar,
    ozet: {
      kapasite: 10, atananPersonelSayisi: 5, bosKoltuk: 5, dolulukOrani: 50, aracSayisi: araclar.length,
      durum: 'UYGUN', asimMiktari: 0, ...o,
    },
    dilimler: [],
  }
}

const ISTANBUL = satir('G1', 'İstanbul Hattı', ['34 ABC 123'], { dolulukOrani: 95, durum: 'DOLMAK_UZERE', bosKoltuk: 1 })
const IZMIR = satir('G2', 'Izmir Hattı', ['35 XYZ 999'], { dolulukOrani: 20, bosKoltuk: 8 })
const SISLI = satir('G3', 'Şişli Hattı', ['34 SIS 001'], { dolulukOrani: 110, durum: 'ASIM', bosKoltuk: -1, asimMiktari: 1 })
const ARACSIZ = satir('G4', 'Çayırova Hattı', [], { kapasite: 0, dolulukOrani: null, durum: 'ARAC_YOK', bosKoltuk: 0 })
const HEPSI = [ISTANBUL, IZMIR, SISLI, ARACSIZ]

describe('panel arama (Türkçe)', () => {
  it('"istanbul" → İstanbul (İ/i dönüşümü)', () => {
    expect(panelAramaEslesir(ISTANBUL, 'istanbul')).toBe(true)
  })
  it('"ISTANBUL" büyük harf de İstanbul\'u bulur', () => {
    expect(panelAramaEslesir(ISTANBUL, 'ISTANBUL')).toBe(true)
  })
  it('"şişli" ve "SISLI" Şişli\'yi bulur', () => {
    expect(panelAramaEslesir(SISLI, 'şişli')).toBe(true)
    expect(panelAramaEslesir(SISLI, 'SISLI')).toBe(true)
  })
  it('"çayırova" → Çayırova', () => {
    expect(panelAramaEslesir(ARACSIZ, 'çayırova')).toBe(true)
  })
  it('plaka ile arama (boşluk/harf duyarsız)', () => {
    expect(panelAramaEslesir(IZMIR, 'xyz')).toBe(true)
  })
  it('eşleşmeyen arama elenir; boş arama hepsini getirir', () => {
    expect(panelSatirlariFiltreleSirala(HEPSI, 'bulunmaz', null)).toHaveLength(0)
    expect(panelSatirlariFiltreleSirala(HEPSI, '  ', null)).toHaveLength(4)
  })
})

describe('panel sıralama', () => {
  const kodlar = (l: KapasiteGuzergahSatiri[]) => l.map((s) => s.kod)

  it('güzergâh adına göre tr-TR sırası (Çayırova, Izmir/İstanbul, Şişli)', () => {
    const adaGore = panelSatirlariFiltreleSirala(
      HEPSI.map((s) => ({ ...s, kod: '' })), '', { alan: 'guzergah', yon: 'asc' },
    ).map((s) => s.ad)
    expect(adaGore).toEqual(['Çayırova Hattı', 'Izmir Hattı', 'İstanbul Hattı', 'Şişli Hattı'])
  })

  it('doluluk artan/azalan; araç yok (null) HER yönde sonda', () => {
    expect(kodlar(panelSatirlariFiltreleSirala(HEPSI, '', { alan: 'doluluk', yon: 'asc' }))).toEqual(['G2', 'G1', 'G3', 'G4'])
    expect(kodlar(panelSatirlariFiltreleSirala(HEPSI, '', { alan: 'doluluk', yon: 'desc' }))).toEqual(['G3', 'G1', 'G2', 'G4'])
  })

  it('boş koltuk: aşım (negatif) en başta artan; araç yok sonda', () => {
    expect(kodlar(panelSatirlariFiltreleSirala(HEPSI, '', { alan: 'bos', yon: 'asc' }))).toEqual(['G3', 'G1', 'G2', 'G4'])
    expect(kodlar(panelSatirlariFiltreleSirala(HEPSI, '', { alan: 'bos', yon: 'desc' }))).toEqual(['G2', 'G1', 'G3', 'G4'])
  })

  it('durum: aşım → araç yok → dolmak üzere → uygun', () => {
    expect(kodlar(panelSatirlariFiltreleSirala(HEPSI, '', { alan: 'durum', yon: 'asc' }))).toEqual(['G3', 'G4', 'G1', 'G2'])
  })

  it('sıralama yoksa gelen sıra korunur; girdi dizisi değişmez', () => {
    const girdi = [...HEPSI]
    expect(kodlar(panelSatirlariFiltreleSirala(girdi, '', null))).toEqual(['G1', 'G2', 'G3', 'G4'])
    panelSatirlariFiltreleSirala(girdi, '', { alan: 'doluluk', yon: 'desc' })
    expect(kodlar(girdi)).toEqual(['G1', 'G2', 'G3', 'G4'])
  })
})
