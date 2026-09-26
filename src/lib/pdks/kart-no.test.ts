import { describe, expect, it } from 'vitest'
import {
  KartNoHatasi,
  kartHamCoz,
  kartNoBicimiOku,
  kartNoDonustur,
  kartNoGoster,
  kartHamPanelden,
} from './kart-no'

describe('kartHamCoz', () => {
  it('8 haneli BizManager değerini tesis + kart olarak ayırır', () => {
    expect(kartHamCoz('11863577')).toEqual({ ham: '11863577', tesis: 118, kart: 63577 })
  })
  it('ASManager "118-63577" biçimini aynı ham değere çevirir', () => {
    expect(kartHamCoz('118-63577').ham).toBe('11863577')
    expect(kartHamCoz(' 118 63577 ').ham).toBe('11863577')
  })
  it('baştaki sıfırları korur (metin girdi) ve kısa ayrık girişi doldurur', () => {
    expect(kartHamCoz('00100042')).toEqual({ ham: '00100042', tesis: 1, kart: 42 })
    expect(kartHamCoz('1-42').ham).toBe('00100042')
  })
  it('Wiegand 26 sınırlarını aşanları reddeder', () => {
    expect(() => kartHamCoz('25665535')).toThrow(KartNoHatasi) // tesis 256
    expect(() => kartHamCoz('11865536')).toThrow(KartNoHatasi) // kart 65536
    expect(kartHamCoz('25565535')).toEqual({ ham: '25565535', tesis: 255, kart: 65535 })
  })
  it('bozuk girdileri reddeder', () => {
    for (const g of ['', '1186357', '118635770', '11a63577', '118-635770', null, undefined]) {
      expect(() => kartHamCoz(g)).toThrow(KartNoHatasi)
    }
  })
})

describe('kartNoDonustur', () => {
  it('BIRLESIK: 8 haneli ham değer olduğu gibi', () => {
    expect(kartNoDonustur('11863577', 'BIRLESIK')).toBe('11863577')
    expect(kartNoDonustur('00100042', 'BIRLESIK')).toBe('00100042')
  })
  it('W26_ONDALIK: tesis * 65536 + kart', () => {
    expect(kartNoDonustur('11863577', 'W26_ONDALIK')).toBe(String(118 * 65536 + 63577)) // 7796825
    expect(kartNoDonustur('11863577', 'W26_ONDALIK')).toBe('7796825')
    expect(kartNoDonustur('00000000', 'W26_ONDALIK')).toBe('0')
    expect(kartNoDonustur('25565535', 'W26_ONDALIK')).toBe(String(2 ** 24 - 1)) // 16777215
  })
  it('geçersiz ham değerde her iki biçim de fırlatır', () => {
    expect(() => kartNoDonustur('11865536', 'BIRLESIK')).toThrow(KartNoHatasi)
    expect(() => kartNoDonustur('11865536', 'W26_ONDALIK')).toThrow(KartNoHatasi)
  })
})

describe('kartNoGoster', () => {
  it('"118-63577" biçiminde gösterir, tanımadığını olduğu gibi bırakır', () => {
    expect(kartNoGoster('11863577')).toBe('118-63577')
    expect(kartNoGoster('abc')).toBe('abc')
    expect(kartNoGoster(null)).toBe('—')
  })
})

describe('kartNoBicimiOku', () => {
  const db = (value: string | null) => ({
    systemSetting: { findUnique: async () => (value === null ? null : { value }) },
  })
  it('kayıt yoksa BIRLESIK', async () => {
    expect(await kartNoBicimiOku(db(null))).toBe('BIRLESIK')
  })
  it('kayıttaki biçimi döner', async () => {
    expect(await kartNoBicimiOku(db('W26_ONDALIK'))).toBe('W26_ONDALIK')
    expect(await kartNoBicimiOku(db(' BIRLESIK '))).toBe('BIRLESIK')
  })
  it('tanınmayan değerde fırlatır (fail-closed)', async () => {
    await expect(kartNoBicimiOku(db('HEX'))).rejects.toThrow(KartNoHatasi)
  })
})

describe('kartHamPanelden (kartNoDonustur tersi)', () => {
  it('her iki biçimde gidiş-dönüş aynı hamı verir', () => {
    for (const ham of ['11863577', '00100042', '25565535', '00000000']) {
      expect(kartHamPanelden(kartNoDonustur(ham, 'BIRLESIK'), 'BIRLESIK')).toBe(ham)
      expect(kartHamPanelden(kartNoDonustur(ham, 'W26_ONDALIK'), 'W26_ONDALIK')).toBe(ham)
    }
  })
  it('çözülemeyeni null döner', () => {
    expect(kartHamPanelden('1234', 'BIRLESIK')).toBeNull()
    expect(kartHamPanelden('11899999', 'BIRLESIK')).toBeNull() // kart > 65535
    expect(kartHamPanelden('99999999999', 'W26_ONDALIK')).toBeNull()
    expect(kartHamPanelden('', 'W26_ONDALIK')).toBeNull()
    expect(kartHamPanelden('12a', 'BIRLESIK')).toBeNull()
  })
})
