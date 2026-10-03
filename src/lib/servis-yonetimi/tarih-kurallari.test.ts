import { describe, expect, it } from 'vitest'
import {
  TarihHatasi,
  aralikDogrula,
  baslangicTarihiCoz,
  bitisTarihiCoz,
  bugunTR,
  kapatmaTarihiCoz,
  makulTarihCoz,
  tarihCoz,
} from './tarih-kurallari'

// 2026-10-03 12:00 (UTC) — Türkiye'de de 3 Ekim.
const SIMDI = new Date('2026-10-03T09:00:00.000Z')

describe('bugunTR', () => {
  it('UTC gece yarısı öncesi bile Türkiye gününü verir (UTC+3)', () => {
    expect(bugunTR(new Date('2026-10-03T22:30:00.000Z'))).toBe('2026-10-04')
    expect(bugunTR(new Date('2026-10-03T20:59:00.000Z'))).toBe('2026-10-03')
  })
})

describe('tarihCoz — geçerli takvim günü', () => {
  it('geçerli günü Date yapar', () => {
    expect(tarihCoz('2026-02-28', 'x').toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it.each(['abc', '2026-13-01', '2026-02-30', '2026-2-3', '20256-01-01', '03.10.2026', ''])(
    '"%s" geçersiz → TarihHatasi (eskiden Invalid Date sessizce geçiyordu)',
    (deger) => {
      expect(() => tarihCoz(deger, 'Bitiş tarihi')).toThrow(TarihHatasi)
    },
  )

  it('hata mesajı alan adını taşır', () => {
    expect(() => tarihCoz('abc', 'Bitiş tarihi')).toThrow(/^Bitiş tarihi geçersiz/)
  })
})

describe('makulTarihCoz — makul aralık (2020-01-01 .. bugün + 1 yıl)', () => {
  it('sınırlar dahil', () => {
    expect(() => makulTarihCoz('2020-01-01', 'T', SIMDI)).not.toThrow()
    expect(() => makulTarihCoz('2027-10-03', 'T', SIMDI)).not.toThrow()
  })

  it('alt sınırın öncesi reddedilir', () => {
    expect(() => makulTarihCoz('2019-12-31', 'T', SIMDI)).toThrow(/2020-01-01 tarihinden önce olamaz/)
    expect(() => makulTarihCoz('1925-01-01', 'T', SIMDI)).toThrow(TarihHatasi)
  })

  it('1 yıldan ileri reddedilir (yazım hatası 2062 gibi)', () => {
    expect(() => makulTarihCoz('2027-10-04', 'T', SIMDI)).toThrow(/en fazla 1 yıl sonrası \(2027-10-03\)/)
    expect(() => makulTarihCoz('2062-05-01', 'T', SIMDI)).toThrow(TarihHatasi)
  })

  it('29 Şubat bugününde +1 yıl sınırı taşmaz (28 Şubat)', () => {
    const artikGun = new Date('2028-02-29T09:00:00.000Z')
    expect(() => makulTarihCoz('2029-02-28', 'T', artikGun)).not.toThrow()
    expect(() => makulTarihCoz('2029-03-01', 'T', artikGun)).toThrow(TarihHatasi)
  })
})

describe('başlangıç / bitiş', () => {
  it('başlangıç zorunlu', () => {
    expect(() => baslangicTarihiCoz('', SIMDI)).toThrow('Başlangıç tarihi zorunludur.')
    expect(() => baslangicTarihiCoz(null, SIMDI)).toThrow('Başlangıç tarihi zorunludur.')
  })

  it('bitiş boş/null = süresiz', () => {
    expect(bitisTarihiCoz('', SIMDI)).toBeNull()
    expect(bitisTarihiCoz(null, SIMDI)).toBeNull()
    expect(bitisTarihiCoz(undefined, SIMDI)).toBeNull()
  })

  it('bitiş doluysa makul aralıkta olmalı', () => {
    expect(bitisTarihiCoz('2026-12-31', SIMDI)?.toISOString().slice(0, 10)).toBe('2026-12-31')
    expect(() => bitisTarihiCoz('2099-01-01', SIMDI)).toThrow(TarihHatasi)
  })

  it('aralikDogrula: bitiş < başlangıç reddedilir, eşitlik ve süresiz geçer', () => {
    const b = new Date('2026-05-01T00:00:00.000Z')
    expect(() => aralikDogrula(b, new Date('2026-04-30T00:00:00.000Z'))).toThrow('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    expect(() => aralikDogrula(b, new Date('2026-05-01T00:00:00.000Z'))).not.toThrow()
    expect(() => aralikDogrula(b, null)).not.toThrow()
  })
})

describe('kapatmaTarihiCoz — kapatma bugünden ileri olamaz', () => {
  const baslangic = new Date('2026-01-01T00:00:00.000Z')

  it('bugün ve geçmiş (başlangıçtan sonra) kabul edilir', () => {
    expect(kapatmaTarihiCoz('2026-10-03', baslangic, SIMDI).toISOString().slice(0, 10)).toBe('2026-10-03')
    expect(kapatmaTarihiCoz('2026-06-15', baslangic, SIMDI).toISOString().slice(0, 10)).toBe('2026-06-15')
  })

  it('🔴 ileri tarih reddedilir ve planlı bitiş için doğru yol gösterilir', () => {
    expect(() => kapatmaTarihiCoz('2026-10-04', baslangic, SIMDI)).toThrow(
      /bugünden ileri olamaz.*bitiş tarihini düzenleyin/,
    )
    expect(() => kapatmaTarihiCoz('2026-12-31', baslangic, SIMDI)).toThrow(/bugünden ileri olamaz/)
  })

  it('zorunlu, başlangıçtan önce olamaz, makul aralıkta olmalı', () => {
    expect(() => kapatmaTarihiCoz('', baslangic, SIMDI)).toThrow('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
    expect(() => kapatmaTarihiCoz('2025-12-31', baslangic, SIMDI)).toThrow('Kapatma tarihi başlangıç tarihinden önce olamaz.')
    expect(() => kapatmaTarihiCoz('abc', baslangic, SIMDI)).toThrow(TarihHatasi)
  })
})
