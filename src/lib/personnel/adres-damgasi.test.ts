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

// ----------------------------------------------------------------------------
// Melih düzeltmesi (25.09.2026): karşılaştırma büyük/küçük harf ve fazladan
// boşluğa duyarsız. YALNIZ karşılaştırma için — saklanan adres DEĞİŞMEZ.
// ----------------------------------------------------------------------------
describe('adresDegisimDamgasi — karşılaştırma normalleştirmesi', () => {
  it('yalnız BÜYÜK/KÜÇÜK harf farkı → damga YOK', () => {
    expect(adresDegisimDamgasi('Atatürk Cd. 5', 'ATATÜRK CD. 5')).toEqual({})
    expect(adresDegisimDamgasi('ATATÜRK CD. 5', 'atatürk cd. 5')).toEqual({})
  })

  it('yalnız ÇOKLU BOŞLUK farkı → damga YOK', () => {
    expect(adresDegisimDamgasi('Atatürk Cd. 5', 'Atatürk  Cd. 5')).toEqual({})
    expect(adresDegisimDamgasi('Atatürk Cd. 5', 'Atatürk\tCd.  5')).toEqual({})
  })

  it('harf + boşluk farkı BİRLİKTE → damga YOK', () => {
    expect(adresDegisimDamgasi('Atatürk Cd. 5', '  atatürk   cd. 5  ')).toEqual({})
  })

  it('GERÇEK içerik farkı → damga VAR (normalleştirme gerçek değişikliği yutmuyor)', () => {
    expect(adresDegisimDamgasi('Atatürk Cd. 5', 'Atatürk Cd. 6')).toHaveProperty('ikametAdresiDegisimTarihi')
    expect(adresDegisimDamgasi('Atatürk Cd. 5', 'Cumhuriyet Cd. 5')).toHaveProperty('ikametAdresiDegisimTarihi')
  })

  it('Türkçe karakterler korunur — ü/ğ/ş farkı GERÇEK farktır', () => {
    expect(adresDegisimDamgasi('Güzeltepe', 'Guzeltepe')).toHaveProperty('ikametAdresiDegisimTarihi')
  })

  // 🔴 İ/I vakası BİLEREK test edilmedi — Melih'in kararı bekleniyor.
  // toLocaleUpperCase('tr-TR') noktalı/noktasız i'yi ayrı harf olarak korur,
  // yani "İstiklal" ve "ISTIKLAL" FARKLI sayılır ve damga BASILIR. Harf
  // katlaması semantik bir karardır ("iş"/"ış" gibi gerçek farkları da
  // birleştirir), kendiliğinden eklenmedi. Karar gelince tek satırlık test
  // buraya eklenecek.
})

describe('adresDegisimDamgasi — saklanan değere DOKUNMAZ', () => {
  it('fonksiyon YALNIZ damga alanını döndürür, adres alanı DÖNMEZ', () => {
    const sonuc = adresDegisimDamgasi('Eski Cd. 1', '  yeni   CD. 2  ')
    expect(Object.keys(sonuc)).toEqual(['ikametAdresiDegisimTarihi'])
    expect(sonuc).not.toHaveProperty('ikametAdresi')
  })

  it('no-op durumunda da hiçbir alan dönmez (adres asla yamalanmaz)', () => {
    expect(Object.keys(adresDegisimDamgasi('Atatürk Cd. 5', 'ATATÜRK  CD. 5'))).toEqual([])
  })
})
