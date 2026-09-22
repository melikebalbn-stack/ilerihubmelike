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

  // 🔴 Kritik kenar durum (FAZ 1C göçü): yeniAdres === undefined "alan hiç
  // gönderilmedi" demektir — null/''den FARKLI. Toplu Excel import'ta boş
  // hücre bu şekilde temsil edilir; mevcut dolu bir adresle karşılaştırılıp
  // "değişti" sayılırsa (ve adres gerçekten null yazılırsa) göç yüzlerce
  // sahte sinyal + veri kaybı üretir.
  it('yeniAdres undefined ise ("alan hiç gönderilmedi") eskiden DOLU bir adres olsa bile değişiklik SAYILMAZ', () => {
    const sonuc = adresDegisimDamgasi('Mevcut Gerçek Adres', undefined)
    expect(sonuc).toEqual({})
  })

  it('yeniAdres undefined ise, eski de null/boşsa yine değişiklik SAYILMAZ', () => {
    expect(adresDegisimDamgasi(null, undefined)).toEqual({})
    expect(adresDegisimDamgasi(undefined, undefined)).toEqual({})
  })

  it('yeniAdres undefined İLE yeniAdres null/"" AYNI ŞEY DEĞİL — null/"" (bilerek boşaltma) hâlâ değişiklik SAYILIR', () => {
    // Bu test yalnız undefined'ın özel yol olduğunu, null/''in eski davranışını
    // BOZMADIĞINI kanıtlıyor (regresyon güvencesi).
    expect(adresDegisimDamgasi('Eski Adres', null).ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
    expect(adresDegisimDamgasi('Eski Adres', '').ikametAdresiDegisimTarihi).toBeInstanceOf(Date)
  })
})
