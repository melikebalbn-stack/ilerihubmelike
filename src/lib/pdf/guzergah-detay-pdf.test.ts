import { describe, expect, it } from 'vitest'
import { generateGuzergahDetayPdfBuffer } from './guzergah-detay-pdf'
import type { GuzergahDetayPdfData } from '@/lib/servis-yonetimi/export'

// PDF ikili (binary) çıktısının görsel/layout doğruluğu bu testin kapsamı
// DIŞINDA — repodaki hiçbir PDF üreticisi (src/lib/pdf/*.ts) test edilmiyor,
// aynı sınırlama burada da geçerli. Bu, DOĞRU ve tam bir PDF üretildiğinin
// (font yükleme hatası/autoTable API yanlış kullanımı/undefined erişimi gibi
// çökmelere karşı) DUMAN (smoke) testidir — gerçek bir kanıt, ama görsel
// doğrulama değil.

const temelVeri: GuzergahDetayPdfData = {
  guzergah: {
    kod: 'G1',
    ad: 'Güzergah 1',
    bolge: 'Gebze',
    aktif: true,
    gecerlilikBaslangici: new Date('2026-01-01'),
    gecerlilikBitisi: null,
    yerleske: { kod: 'MERKEZ', ad: 'Merkez Yerleşke' },
  },
  duraklar: [{ sira: 1, durakKod: 'D1', durakAd: 'Durak 1', saatlerMetni: 'S1 (Gidiş): 08:00' }],
  aracAtamalari: [{ dilimEtiket: 'S1 (Gidiş)', plaka: '41ABC123', kapasite: 16, rol: 'ANA' }],
  soforAtamalari: [{ dilimEtiket: 'S1 (Gidiş)', adSoyad: 'Ahmet Yılmaz', rol: 'ANA' }],
}

describe('generateGuzergahDetayPdfBuffer', () => {
  it('geçerli bir PDF buffer üretir (%PDF-1.x magic byte ile başlar)', () => {
    const buf = generateGuzergahDetayPdfBuffer(temelVeri)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('duraklar/araç/şoför atamaları BOŞ olsa bile hata vermez ("kayıt yok" satırıyla üretir)', () => {
    const bosVeri: GuzergahDetayPdfData = { ...temelVeri, duraklar: [], aracAtamalari: [], soforAtamalari: [] }
    const buf = generateGuzergahDetayPdfBuffer(bosVeri)
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('bölge/geçerlilik bitişi null olsa bile hata vermez', () => {
    const buf = generateGuzergahDetayPdfBuffer({
      ...temelVeri,
      guzergah: { ...temelVeri.guzergah, bolge: null, gecerlilikBaslangici: null, gecerlilikBitisi: null },
    })
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('çok sayıda durak/atama ile (sayfa taşması senaryosu) hata vermez', () => {
    const cokDurak: GuzergahDetayPdfData = {
      ...temelVeri,
      duraklar: Array.from({ length: 60 }, (_, i) => ({
        sira: i + 1,
        durakKod: `D${i + 1}`,
        durakAd: `Durak ${i + 1}`,
        saatlerMetni: 'S1 (Gidiş): 08:00, S1 (Dönüş): 17:00',
      })),
    }
    const buf = generateGuzergahDetayPdfBuffer(cokDurak)
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
