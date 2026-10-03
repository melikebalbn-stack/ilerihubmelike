import { describe, expect, it } from 'vitest'
import { buAyOzetiOlustur, veriKaliteOzetiOlustur } from './panel'
import type { BuAyNeDegistiSonucu } from './bu-ay-ne-degisti'
import type { VeriKaliteRaporSatiri } from './veri-kalite'

describe('buAyOzetiOlustur — yalnız sayılar (KVKK)', () => {
  it('liste uzunluklarını sayıya çevirir; kişi bilgisi sonuçta yok', () => {
    const kisi = { personelAdi: 'Ayşe Yılmaz', sicil: '123' }
    const s = {
      yil: 2026, ay: 10,
      yeniServisKullanicilari: [kisi, kisi],
      servistenAyrilanlar: [kisi],
      servisDegistirenler: [],
      durakDegistirenler: [kisi],
      aracDegisenServisler: [{}],
      soforDegisenServisler: [],
      vardiyaDegistirenler: [kisi],
    } as unknown as BuAyNeDegistiSonucu
    const o = buAyOzetiOlustur(s)
    expect(o).toEqual({
      yil: 2026, ay: 10, yeniServisKullanicisi: 2, servistenAyrilan: 1, servisDegistiren: 0,
      durakDegistiren: 1, aracDegisenServis: 1, soforDegisenServis: 0, vardiyaDegistiren: 1, toplam: 6,
    })
    expect(JSON.stringify(o)).not.toContain('Ayşe')
  })
})

describe('veriKaliteOzetiOlustur', () => {
  const r = (kod: string, baslik: string, adet: number, hata?: string) =>
    ({ kod, baslik, adet, ...(hata ? { hata } : {}) }) as unknown as VeriKaliteRaporSatiri

  it('toplam, bulgulu kontrol, hatalı kontrol ve en çok bulgu (ilk 5, azalan)', () => {
    const o = veriKaliteOzetiOlustur([
      r('A', 'a', 0), r('B', 'b', 3), r('C', 'c', 10), r('D', 'd', 1),
      r('E', 'e', 7), r('F', 'f', 2), r('G', 'g', 4), r('H', 'h', 0, 'patladı'),
    ])
    expect(o.kontrolSayisi).toBe(8)
    expect(o.bulguluKontrol).toBe(6)
    expect(o.toplamBulgu).toBe(27)
    expect(o.hataliKontrol).toBe(1)
    expect(o.enCokBulgu.map((x) => x.kod)).toEqual(['C', 'E', 'G', 'B', 'F'])
  })

  it('bulgu yoksa sıfırlar ve boş liste', () => {
    const o = veriKaliteOzetiOlustur([r('A', 'a', 0)])
    expect(o).toMatchObject({ toplamBulgu: 0, bulguluKontrol: 0, enCokBulgu: [] })
  })
})
