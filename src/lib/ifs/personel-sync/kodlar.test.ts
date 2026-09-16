import { describe, expect, it } from 'vitest'
import { adSoyadAyir, baslikHali, bolumShopFloorMu, hubKodundanIfsKodu, ifsCinsiyet, ifsTarih, kaynakTuru, kisiShopFloorMu, laborClassAciklamasi, laborClassKodu, orgKodu, posKodu, sicilSenkronKapsamindaMi } from './kodlar'

describe('IFS personel senkronu — kod türetme', () => {
  it('ORG-TF öneki atılır, 10 karakter sınırı korunur', () => {
    expect(orgKodu('ORG-TF-P0021-N001')).toBe('P0021-N001')
    expect(orgKodu('ORG-TF-P0016')).toBe('P0016')
    expect(posKodu('ORG-TF-P0008-K01')).toBe('P0008-K01')
    expect(posKodu('ORG-TF-GMY')).toBe('GMY')
    expect(() => orgKodu('ORG-TF-P0021-N001-UZUN')).toThrow(/OrgCode sınırı/)
    expect(() => orgKodu('ORG-KR-BGYS')).toThrow()
    expect(hubKodundanIfsKodu('ORG-TF')).toBe('ORG-TF') // kök: önek eşleşmez (tire yok)
  })
  it('labor class: tiresiz bölüm kodu, Kaynakhane R/M soneki', () => {
    expect(laborClassKodu('ORG-TF-P0068-N001')).toBe('P0068N001')
    expect(laborClassKodu('ORG-TF-P0021-N001', { kaynakTuru: 'R' })).toBe('P0021N001R')
    expect(laborClassKodu('ORG-TF-P0021-N001', { kaynakTuru: 'M' })).toBe('P0021N001M')
    expect(laborClassAciklamasi('Kaynakhane', 'R')).toBe('Kaynakhane – Robot')
    expect(laborClassAciklamasi('Talaşlı İmalat')).toBe('Talaşlı İmalat')
  })
  it('Kaynakhane görevden: ROBOT → R, diğerleri → M', () => {
    expect(kaynakTuru('ROBOT KAYNAK OPERATÖRÜ')).toBe('R')
    expect(kaynakTuru('MANUEL KAYNAK OPERATÖRÜ')).toBe('M')
    expect(kaynakTuru('PUNTA KAYNAK OPERATÖRÜ')).toBe('M')
    expect(kaynakTuru('KAYNAK OPERATÖRÜ')).toBe('M')
    expect(kaynakTuru('KAYNAKHANE BÖLÜM SORUMLUSU')).toBe('M')
    expect(kaynakTuru(null)).toBe('M')
  })
  it('shop-floor kuralı: MAVI/GRI olan bölüm, İdari İşler hariç; beyaz asla', () => {
    expect(bolumShopFloorMu('Kalite Müdürlüğü', true)).toBe(true)
    expect(bolumShopFloorMu('İdari İşler', true)).toBe(false)
    expect(bolumShopFloorMu('Finans-Muhasebe Müdürlüğü', false)).toBe(false)
    expect(kisiShopFloorMu('BEYAZ', true)).toBe(false)
    expect(kisiShopFloorMu('GRI', true)).toBe(true)
    expect(kisiShopFloorMu('MAVI', false)).toBe(false)
  })
  it('ad ayırma tr-TR başlık hâli, son kelime soyad', () => {
    expect(baslikHali('HÜSAMETTİN YAVUZ')).toBe('Hüsamettin Yavuz')
    expect(adSoyadAyir('TUĞÇE BOLAT KARGIN')).toEqual({ Fname: 'Tuğçe Bolat', Lname: 'Kargın' })
    expect(adSoyadAyir('ILKAY')).toEqual({ Fname: 'Ilkay', Lname: 'Ilkay' })
  })
  it('yardımcılar', () => {
    expect(ifsCinsiyet('MALE')).toBe('Male'); expect(ifsCinsiyet('FEMALE')).toBe('Female'); expect(ifsCinsiyet(null)).toBeUndefined()
    expect(ifsTarih(new Date('2024-09-30T00:00:00.000Z'))).toBe('2024-09-30'); expect(ifsTarih(null)).toBeNull()
    expect(sicilSenkronKapsamindaMi('ILR-00946')).toBe(true); expect(sicilSenkronKapsamindaMi('IG002')).toBe(false); expect(sicilSenkronKapsamindaMi(null)).toBe(false)
  })
})
