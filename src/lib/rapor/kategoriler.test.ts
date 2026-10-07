import { describe, it, expect } from 'vitest'
import { kategoriCoz, kategoriEtiketi, KATEGORILER, KATEGORISIZ } from './kategoriler'

describe('kategoriCoz', () => {
  it('kanonik adların kendisini tanır', () => {
    for (const k of KATEGORILER) expect(kategoriCoz(k)).toBe(k)
  })

  it('ekrandaki ikiliği bitirir — "Satın Alma" ve "Satınalma" tek kategori', () => {
    // 07.10.2026 ölçümü: /raporlar ekranında iki ayrı çip görünüyordu.
    expect(kategoriCoz('Satın Alma')).toBe('Satınalma')
    expect(kategoriCoz('Satınalma')).toBe('Satınalma')
    expect(kategoriCoz('SATIN ALMA')).toBe('Satınalma')
    expect(kategoriCoz('satinalma')).toBe('Satınalma')
  })

  it('Türkçe İ/I/ı yazımlarını ayırt etmez', () => {
    for (const s of ['İnsan Varlıkları', 'INSAN VARLIKLARI', 'insan varliklari', 'İK']) {
      expect(kategoriCoz(s)).toBe('İnsan Varlıkları')
    }
  })

  it('İngilizce ve bölüm adı varyantlarını eşler', () => {
    expect(kategoriCoz('Production')).toBe('Üretim')
    expect(kategoriCoz('Üretim Planlama')).toBe('Üretim')
    expect(kategoriCoz('Kalite Müdürlüğü')).toBe('Kalite')
    expect(kategoriCoz('Sistem Geliştirme')).toBe('IT')
  })

  it('tanımadığı metin ve boş değerler için null döner', () => {
    for (const s of ['Pazarlama', 'zzz', '', '   ', null, undefined]) {
      expect(kategoriCoz(s)).toBeNull()
    }
  })
})

describe('kategoriEtiketi', () => {
  it('eşleşmeyeni Diğer grubuna düşürür', () => {
    expect(kategoriEtiketi('Pazarlama')).toBe(KATEGORISIZ)
    expect(kategoriEtiketi(null)).toBe(KATEGORISIZ)
    expect(kategoriEtiketi('Depo')).toBe('Depo')
  })
})
