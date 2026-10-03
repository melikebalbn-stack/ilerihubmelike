import { describe, expect, it } from 'vitest'
import {
  BenzerPlakaHatasi,
  ayniPlakaMesaji,
  benzerPlakaOnayAciklamasi,
  benzerlikAnahtari,
  normalizePlaka,
  plakaBicimHatasi,
  plakaKontrol,
  plakalarBenzerMi,
} from './plaka'

describe('normalizePlaka', () => {
  it.each([
    ['41P0145', '41P0145'],
    [' 41 p 0145 ', '41P0145'],
    ['41-p-0145', '41P0145'],
    ['34 lac-828', '34LAC828'],
    ['34 LAC\t828', '34LAC828'], // bölünmez boşluk + sekme
  ])('"%s" → "%s"', (ham, beklenen) => {
    expect(normalizePlaka(ham)).toBe(beklenen)
  })

  it('tr-TR büyük harf: ı → I, i → İ (İ geçerli plaka harfi değildir → biçim hatası)', () => {
    expect(normalizePlaka('41ı0145')).toBe('41I0145')
    expect(normalizePlaka('41i0145')).toBe('41İ0145')
    expect(plakaBicimHatasi(normalizePlaka('41i0145'))).toMatch(/Türkçe karakter/)
  })
})

describe('plakaBicimHatasi — il kodu 01-81 + 1-3 harf + 2-4 rakam', () => {
  it.each(['01A12', '41P0145', '34LAC828', '81ABC1234', '06A123', '35AB12', '07ZZ99'])('%s geçerli', (p) => {
    expect(plakaBicimHatasi(p)).toBeNull()
  })

  it.each([
    ['00A123', 'il kodu 00'],
    ['82A123', 'il kodu 82'],
    ['99A123', 'il kodu 99'],
    ['4A123', 'tek haneli il'],
    ['41123', 'harf yok'],
    ['41ABCD123', '4 harf'],
    ['41A1', '1 rakam'],
    ['41A12345', '5 rakam'],
    ['41P', 'rakam yok'],
    ['ABP0145', 'il kodu harf'],
    ['41P01 45', 'iç boşluk (normalize edilmemiş)'],
    ['41Ş0145', 'Türkçe harf'],
    ['', 'boş'],
  ])('%s geçersiz (%s) → açık Türkçe hata', (p) => {
    const hata = plakaBicimHatasi(p)
    expect(hata).not.toBeNull()
    expect(hata).toContain(`Geçersiz plaka biçimi: "${p}"`)
    expect(hata).toContain('il kodu (01-81), 1-3 harf ve 2-4 rakam')
  })

  it('Türkçe karakter için ek ipucu', () => {
    expect(plakaBicimHatasi('41Ş0145')).toContain('Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü) kullanılamaz.')
    expect(plakaBicimHatasi('99A123')).not.toContain('Türkçe karakter')
  })
})

describe('benzerlikAnahtari / plakalarBenzerMi', () => {
  it('O→0, I→1, S→5, B→8', () => {
    expect(benzerlikAnahtari('41PO145')).toBe('41P0145')
    expect(benzerlikAnahtari('34IS8B')).toBe('34158' + '8')
  })

  it('🔴 41PO145 ↔ 41P0145 (O yerine 0): benzer', () => {
    expect(plakalarBenzerMi('41PO145', '41P0145')).toBe(true)
    expect(plakalarBenzerMi('41P0145', '41PO145')).toBe(true)
  })

  it('🔴 41PO0145 ↔ 41P0145 (fazladan O/0 yazılmış): benzer — tek karakter fazlalık kuralı', () => {
    expect(plakalarBenzerMi('41PO0145', '41P0145')).toBe(true)
    expect(plakalarBenzerMi('41P0145', '41PO0145')).toBe(true)
    expect(plakalarBenzerMi('41P00145', '41P0145')).toBe(true)
  })

  it.each([
    ['41P0145', '41P0I45'], // I↔1
    ['34LAC828', '34LACB28'], // B↔8
    ['34LAC828', '34LAC82B'],
    ['06SA123', '065A123'], // S↔5
  ])('%s ↔ %s karışık karakter: benzer', (a, b) => {
    expect(plakalarBenzerMi(a, b)).toBe(true)
  })

  it('aynı plaka "benzer" değildir (aynıdır; çağıran ayrıca ele alır)', () => {
    expect(plakalarBenzerMi('41P0145', '41P0145')).toBe(false)
  })

  it('🔴 rastgele tek karakter farkı BENZER SAYILMAZ (gerçekten farklı araçlar)', () => {
    expect(plakalarBenzerMi('34LAC828', '34LAC829')).toBe(false)
    expect(plakalarBenzerMi('41P0145', '41P0146')).toBe(false)
    expect(plakalarBenzerMi('41P0145', '41R0145')).toBe(false)
    expect(plakalarBenzerMi('41P0145', '42P0145')).toBe(false)
  })

  it('fazladan karakter karışık sınıftan DEĞİLSE (ör. fazladan 2 ya da A) benzer sayılmaz', () => {
    expect(plakalarBenzerMi('41P02145', '41P0145')).toBe(false)
    expect(plakalarBenzerMi('41PA0145', '41P0145')).toBe(false)
  })

  it('iki karakter fark benzer sayılmaz', () => {
    expect(plakalarBenzerMi('41PO00145', '41P0145')).toBe(false)
  })
})

describe('plakaKontrol', () => {
  const MEVCUT = [
    { id: 'a1', plaka: '41P0145', aktif: true },
    { id: 'a2', plaka: '34LAC828', aktif: false },
    { id: 'a3', plaka: '41 p-0327', aktif: true }, // eski, normalize edilmemiş kayıt
  ]

  it('aynı plaka → AYNI (aktif)', () => {
    expect(plakaKontrol('41P0145', MEVCUT)).toEqual({ tur: 'AYNI', mevcut: MEVCUT[0] })
  })

  it('aynı plaka PASİFSE de AYNI (pasif kayıt yok sayılmaz)', () => {
    expect(plakaKontrol('34LAC828', MEVCUT)).toEqual({ tur: 'AYNI', mevcut: MEVCUT[1] })
  })

  it('mevcut kayıt normalize edilmeden saklanmışsa bile yakalanır (41 p-0327 ≡ 41P0327)', () => {
    expect(plakaKontrol('41P0327', MEVCUT)).toMatchObject({ tur: 'AYNI', mevcut: { id: 'a3' } })
  })

  it('🔴 benzer → BENZER (aktif ve pasif ayrımı yapılmaz)', () => {
    expect(plakaKontrol('41PO145', MEVCUT)).toEqual({ tur: 'BENZER', benzerler: [MEVCUT[0]] })
    expect(plakaKontrol('34LACB28', MEVCUT)).toEqual({ tur: 'BENZER', benzerler: [MEVCUT[1]] })
  })

  it('hiç benzemiyorsa TEMIZ', () => {
    expect(plakaKontrol('06ABC123', MEVCUT)).toEqual({ tur: 'TEMIZ' })
  })

  it('düzenlenen aracın kendisi hariç tutulur', () => {
    expect(plakaKontrol('41P0145', MEVCUT, 'a1')).toEqual({ tur: 'TEMIZ' })
    expect(plakaKontrol('41PO145', MEVCUT, 'a1')).toEqual({ tur: 'TEMIZ' })
  })

  it('AYNI, BENZER\'den önceliklidir', () => {
    const m = [...MEVCUT, { id: 'a9', plaka: '41PO145', aktif: true }]
    expect(plakaKontrol('41P0145', m).tur).toBe('AYNI')
  })
})

describe('mesajlar', () => {
  it('BenzerPlakaHatasi: "Benzer plaka var: 41P0145 — aynı araç mı?"', () => {
    const e = new BenzerPlakaHatasi([{ id: 'a1', plaka: '41P0145', aktif: true }])
    expect(e.message).toBe('Benzer plaka var: 41P0145 — aynı araç mı?')
    expect(e.benzerler).toEqual([{ plaka: '41P0145', aktif: true }])
    expect(new BenzerPlakaHatasi([
      { id: 'a1', plaka: '41P0145', aktif: true }, { id: 'a2', plaka: '41P0I45', aktif: false },
    ]).message).toBe('Benzer plaka var: 41P0145, 41P0I45 — aynı araç mı?')
  })

  it('aynı plaka mesajı: aktif → kullanılıyor; pasif → Geri Al önerisi', () => {
    expect(ayniPlakaMesaji({ id: 'a1', plaka: '41P0145', aktif: true })).toBe('"41P0145" plakası zaten kullanılıyor.')
    const pasif = ayniPlakaMesaji({ id: 'a2', plaka: '34LAC828', aktif: false })
    expect(pasif).toContain('pasif bir araç olarak kayıtlı')
    expect(pasif).toContain('Geri Al ile etkinleştirin')
  })

  it('onay açıklaması', () => {
    expect(benzerPlakaOnayAciklamasi([{ id: 'a1', plaka: '41P0145', aktif: true }])).toBe(
      'Benzer plaka uyarısı kullanıcı onayıyla geçildi: 41P0145.',
    )
  })
})
