import { describe, expect, it } from 'vitest'
import { firmaSiniriniDogrula, FirmaSiniriIhlali } from './sikayet-firma-siniri'

describe('firmaSiniriniDogrula — temiz gövde', () => {
  it('şikâyetçi içermeyen gövde AYNEN geçer', () => {
    const govde = [{ id: 's1', no: 1, durum: 'ACIK', firmaAd: 'Firma A', sorumluAdSoyad: 'Ayşe' }]
    expect(firmaSiniriniDogrula(govde)).toBe(govde)
  })

  it('boş dizi / null / ilkel değerler geçer', () => {
    expect(firmaSiniriniDogrula([])).toEqual([])
    expect(firmaSiniriniDogrula(null)).toBeNull()
    expect(firmaSiniriniDogrula('metin')).toBe('metin')
  })

  it('sorumlu (İV personeli) şikâyetçi DEĞİLDİR — engellenmez', () => {
    const govde = [{ id: 's1', sorumlu: { id: 'p1', adSoyad: 'Ayşe Sorumlu', sicilNo: '222' } }]
    expect(() => firmaSiniriniDogrula(govde)).not.toThrow()
  })
})

describe('firmaSiniriniDogrula — sızıntı', () => {
  it('🔴 düz alan: sikayetciPersonnelId varsa FIRLATIR', () => {
    expect(() => firmaSiniriniDogrula([{ id: 's1', sikayetciPersonnelId: 'p1' }]))
      .toThrow(FirmaSiniriIhlali)
  })

  it('🔴 İÇ İÇE nesnede de yakalar', () => {
    expect(() => firmaSiniriniDogrula({ data: [{ id: 's1', sikayetci: { adSoyad: 'Ahmet' } }] }))
      .toThrow(FirmaSiniriIhlali)
  })

  it('derin dizi içinde de yakalar', () => {
    expect(() => firmaSiniriniDogrula({ a: { b: [{ c: { sikayetciAdi: 'X' } }] } }))
      .toThrow(FirmaSiniriIhlali)
  })

  it('büyük/küçük harf farkı yakalamayı bozmaz', () => {
    expect(() => firmaSiniriniDogrula([{ SikayetciId: 'p1' }])).toThrow(FirmaSiniriIhlali)
  })

  it('hata mesajı SIZAN YOLU söyler — düzeltme nereye yapılacak belli olsun', () => {
    try {
      firmaSiniriniDogrula({ data: [{ sikayetci: { adSoyad: 'Ahmet' } }] })
      throw new Error('fırlatmalıydı')
    } catch (e) {
      expect(e).toBeInstanceOf(FirmaSiniriIhlali)
      const ihlal = e as FirmaSiniriIhlali
      expect(ihlal.yollar).toEqual(['data[0].sikayetci'])
      expect(ihlal.message).toContain('sorgu katmanındaki select düzeltilmeli')
    }
  })

  it('birden çok sızıntı hepsi birden raporlanır', () => {
    try {
      firmaSiniriniDogrula([{ sikayetciPersonnelId: 'p1' }, { sikayetci: {} }])
      throw new Error('fırlatmalıydı')
    } catch (e) {
      expect((e as FirmaSiniriIhlali).yollar).toEqual(['[0].sikayetciPersonnelId', '[1].sikayetci'])
    }
  })

  it('🔴 gövdeyi AYIKLAMIYOR — değiştirmeden fırlatıyor', () => {
    const govde = [{ id: 's1', sikayetciPersonnelId: 'p1' }]
    expect(() => firmaSiniriniDogrula(govde)).toThrow()
    // Ayıklama yapılsaydı alan silinirdi; hata GÖRÜNÜR kalmalı.
    expect(govde[0]).toHaveProperty('sikayetciPersonnelId', 'p1')
  })
})
