import { describe, expect, it } from 'vitest'
import { adresDegisimDamgasi } from './adres-damgasi'

describe('adresDegisimDamgasi — TEK KAYNAK (put-govde.ts, import, personele-donustur.ts aynısını kullanır)', () => {
  it('adres gerçekten değişirse ikametAdresiDegisimTarihi döner', () => {
    const sonuc = adresDegisimDamgasi('Eski Adres', 'Yeni Adres')
    expect(sonuc.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('aynı adres — boş nesne döner (no-op)', () => {
    const sonuc = adresDegisimDamgasi('Aynı Adres', 'Aynı Adres')
    expect(sonuc).toEqual({})
  })

  it('trim sonrası eşitse (baştaki/sondaki boşluk farkı) değişiklik SAYILMAZ', () => {
    const sonuc = adresDegisimDamgasi('Aynı Adres', '  Aynı Adres  ')
    expect(sonuc).toEqual({})
  })

  it('eskiden null, yeniden de boş/null ise değişiklik SAYILMAZ', () => {
    expect(adresDegisimDamgasi(null, null)).toEqual({})
    expect(adresDegisimDamgasi(null, '')).toEqual({})
    expect(adresDegisimDamgasi(undefined, null)).toEqual({})
    expect(adresDegisimDamgasi('   ', null)).toEqual({})
  })

  it('null → dolu adres değişiklik SAYILIR', () => {
    const sonuc = adresDegisimDamgasi(null, 'İlk Adres')
    expect(sonuc.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })

  it('dolu adres → null (silindi) değişiklik SAYILIR', () => {
    const sonuc = adresDegisimDamgasi('Eski Adres', null)
    expect(sonuc.ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })
})
