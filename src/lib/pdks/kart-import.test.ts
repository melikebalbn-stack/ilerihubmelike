import { describe, expect, it } from 'vitest'
import { siniflandir, sicilNormalize, type BizSatir, type HubPersonel } from './kart-import'

const satir = (n: number, sicil: string, kart: string | null, ayrildi = false): BizSatir => ({
  satir: n, sicilHam: sicil, sicil: sicilNormalize(sicil), kartGirdi: kart, ayrildi,
})
const kisi = (id: string, sicilNo: string, aktif = true): HubPersonel => ({ id, sicilNo, adSoyad: id.toUpperCase(), aktif, departman: null })

describe('sicilNormalize', () => {
  it('boşluk / tire / küçük harf farklarını giderir, haneleri OLDUĞU GİBİ bırakır', () => {
    expect(sicilNormalize(' ilr 00207 ')).toBe('ILR-00207')
    expect(sicilNormalize('ILR00207')).toBe('ILR-00207')
    expect(sicilNormalize('ILR-0006')).toBe('ILR-0006') // 4 hane: doldurulmaz
    expect(sicilNormalize('12345')).toBe('12345')
  })
})

describe('siniflandir', () => {
  const personeller = [
    kisi('a', 'ILR-00001'),
    kisi('b', 'ILR-00002', false),
    kisi('c', 'ILR-00003'),
    kisi('d', 'ILR-00004'),
    kisi('e', 'ILR-00005'),
    kisi('f', 'ILR-00006'),
    kisi('g', 'ILR-00007'), // aktif, dosyada kartsız
  ]

  it('her sınıfı doğru ayırır', () => {
    const r = siniflandir(
      [
        satir(6, 'ILR-00001', '11863577'), // ESLESEN
        satir(7, 'ILR-00002', '11800001', true), // HUBDA_PASIF_KARTLI
        satir(8, 'STJ-00009', '11800002'), // HUBDA_YOK (Biz aktif)
        satir(9, 'ILR-00003', '11800003'), // mükerrer sicil
        satir(10, 'ILR-00003', '11800004'),
        satir(11, 'ILR-00004', '11800005'), // aynı kart iki sicilde
        satir(12, 'ILR-00005', '11800005'),
        satir(13, 'ILR-00006', '11899999'), // kart > 65535 → geçersiz
        satir(14, 'ILR-00007', null), // kartsız
      ],
      personeller,
      [],
    )
    const s = Object.fromEntries(r.kayitlar.map((k) => [k.satir, k.sinif]))
    expect(s).toEqual({
      6: 'ESLESEN', 7: 'HUBDA_PASIF_KARTLI', 8: 'HUBDA_YOK', 9: 'CAKISMA_MUKERRER_SICIL', 10: 'CAKISMA_MUKERRER_SICIL',
      11: 'CAKISMA_MUKERRER_KART', 12: 'CAKISMA_MUKERRER_KART', 13: 'CAKISMA_GECERSIZ_KART', 14: 'KARTSIZ',
    })
    expect(r.kayitlar.find((k) => k.satir === 7)!.guvenlikBulgusu).toBe(true)
    expect(r.kayitlar.find((k) => k.satir === 8)!.guvenlikBulgusu).toBe(true)
    expect(r.kayitlar.find((k) => k.satir === 6)!.kartHam).toBe('11863577')
    // aktif ama import edilecek kartı olmayanlar: c (mükerrer), d, e (çakışma), f (geçersiz), g (kartsız)
    expect(r.hubAktifKartsiz.map((p) => p.id)).toEqual(['c', 'd', 'e', 'f', 'g'])
  })

  it('Hub\'daki mevcut aktif kartlara göre ZATEN_VAR / FARKLI / BAŞKASINDA', () => {
    const r = siniflandir(
      [
        satir(6, 'ILR-00001', '11863577'),
        satir(7, 'ILR-00003', '11800003'),
        satir(8, 'ILR-00004', '11800009'),
      ],
      personeller,
      [
        { personnelId: 'a', kartNoHam: '11863577' },
        { personnelId: 'c', kartNoHam: '11800077' },
        { personnelId: 'e', kartNoHam: '11800009' },
      ],
    )
    expect(r.kayitlar.map((k) => k.sinif)).toEqual(['ZATEN_VAR', 'CAKISMA_HUB_FARKLI_KART', 'CAKISMA_KART_BASKASINDA'])
    // a ve c'nin Hub'da kartı var, e'nin de; kartsız aktifler: d, f, g
    expect(r.hubAktifKartsiz.map((p) => p.id)).toEqual(['d', 'f', 'g'])
  })

  it('eşleşmeyen oranı: payda BizManager-AKTİF kartlı satırlar, pay Hub\'da hiç olmayanlar', () => {
    const r = siniflandir(
      [
        satir(6, 'ILR-00001', '11863577'), // aktif, eşleşti
        satir(7, 'STJ-00001', '11800001'), // aktif, Hub'da yok → pay
        satir(8, 'STJ-00002', '11800002', true), // AYRILDI → paydada değil
        satir(9, 'ILR-00002', '11800003', true), // AYRILDI (Hub pasif) → paydada değil
        satir(10, 'ILR-00007', null), // kartsız → paydada değil
      ],
      personeller,
      [],
    )
    expect(r.eslesmeyen).toEqual({ pay: 1, payda: 2, oran: 0.5 })
  })
})
