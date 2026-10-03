import { describe, expect, it } from 'vitest'
import {
  GUZERGAH_LISTESI_PDF_BASLIKLARI,
  generateGuzergahListesiPdfBuffer,
  guzergahListesiPdfGovdesi,
  type GuzergahListesiPdfSatiri,
} from './guzergah-listesi-pdf'

const ozet = (o: object) => ({
  kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0, ...o,
}) as GuzergahListesiPdfSatiri['kapasite']

const SATIRLAR: GuzergahListesiPdfSatiri[] = [
  { kod: 'G1', ad: 'İstanbul', bolge: 'Gebze', yerleske: 'M — Merkez', durakSayisi: 4, plakalar: ['34 ABC 123'], dilimKod: 'SABAH_GIDIŞ', tekilPersonel: 14, kapasite: ozet({}), aktif: true },
  { kod: 'G2', ad: 'Şişli', bolge: null, yerleske: 'M — Merkez', durakSayisi: 2, plakalar: [], kapasite: ozet({ kapasite: 0, dolulukOrani: null, durum: 'ARAC_YOK' }), aktif: true },
  { kod: 'G3', ad: 'Eski', bolge: null, yerleske: 'M — Merkez', durakSayisi: 0, plakalar: [], kapasite: null, aktif: false },
  { kod: 'G4', ad: 'Aşım', bolge: null, yerleske: 'M — Merkez', durakSayisi: 1, plakalar: ['06 A 1'], kapasite: ozet({ durum: 'ASIM', asimMiktari: 3, dolulukOrani: 118.5 }), aktif: true },
]

describe('güzergâh listesi PDF', () => {
  it('gövde: araç yok → koltuk/doluluk "—"; pasif → "Pasif"; aşım → "Aşım +N"', () => {
    const b = guzergahListesiPdfGovdesi(SATIRLAR)
    // SEFER = satırdaki değerlerin ait olduğu (en dolu) dilim; TEKİL KİŞİ son sütun
    expect(b[0]).toEqual(['G1', 'İstanbul', 'Gebze', 'M — Merkez', '4', '34 ABC 123', 'SABAH_GIDIŞ', '16', '12', '%75.0', 'Uygun', '14'])
    expect(b[1].slice(6)).toEqual(['—', '—', '12', '—', 'Araç yok', '—'])
    expect(b[2].slice(6)).toEqual(['—', '—', '—', '—', 'Pasif', '—'])
    expect(b[3][10]).toBe('Aşım +3')
    expect(GUZERGAH_LISTESI_PDF_BASLIKLARI).toContain('PERSONEL (EN DOLU SEFER)')
    expect(b[0]).toHaveLength(GUZERGAH_LISTESI_PDF_BASLIKLARI.length)
  })

  it('gerçek PDF baytları (%PDF-) üretir', () => {
    const buf = generateGuzergahListesiPdfBuffer({ tarih: '2026-10-03', satirlar: SATIRLAR })
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('boş listede de geçerli PDF', () => {
    expect(generateGuzergahListesiPdfBuffer({ tarih: '2026-10-03', satirlar: [] }).subarray(0, 5).toString()).toBe('%PDF-')
  })
})
