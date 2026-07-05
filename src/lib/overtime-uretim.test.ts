import { describe, it, expect } from 'vitest'
import {
  buildUretimRows,
  buildSingles,
  coerceIntNonNeg,
  coerceHedefPozitif,
} from './overtime-uretim'

describe('coerceIntNonNeg', () => {
  it('null/undefined/boş string → null', () => {
    expect(coerceIntNonNeg(null)).toBeNull()
    expect(coerceIntNonNeg(undefined)).toBeNull()
    expect(coerceIntNonNeg('')).toBeNull()
    expect(coerceIntNonNeg('   ')).toBeNull()
  })

  it('negatif → null (reddedilir)', () => {
    expect(coerceIntNonNeg(-1)).toBeNull()
    expect(coerceIntNonNeg('-5')).toBeNull()
  })

  it('geçersiz sayı → null', () => {
    expect(coerceIntNonNeg('abc')).toBeNull()
    expect(coerceIntNonNeg('12abc')).toBeNull()
  })

  it('0 dahil pozitif → trunc', () => {
    expect(coerceIntNonNeg(0)).toBe(0)
    expect(coerceIntNonNeg('0')).toBe(0)
    expect(coerceIntNonNeg('7')).toBe(7)
    expect(coerceIntNonNeg(7.9)).toBe(7)
  })
})

describe('coerceHedefPozitif', () => {
  it('0/negatif/null → null (satır hedefAdet > 0 zorunlu)', () => {
    expect(coerceHedefPozitif(0)).toBeNull()
    expect(coerceHedefPozitif('0')).toBeNull()
    expect(coerceHedefPozitif(-3)).toBeNull()
    expect(coerceHedefPozitif(null)).toBeNull()
    expect(coerceHedefPozitif('')).toBeNull()
  })

  it('pozitif → trunc', () => {
    expect(coerceHedefPozitif(5)).toBe(5)
    expect(coerceHedefPozitif('180')).toBe(180)
    expect(coerceHedefPozitif(3.7)).toBe(3)
  })
})

describe('buildUretimRows', () => {
  describe('geçersiz satır oluşmaz', () => {
    it('parcaKodu boş → satır yok', () => {
      expect(buildUretimRows({ targetProduction: '', hedefAdet: 10 })).toEqual([])
    })

    it('parcaKodu whitespace → satır yok', () => {
      expect(buildUretimRows({ targetProduction: '   ', hedefAdet: 10 })).toEqual([])
    })

    it('hedefAdet null → satır yok', () => {
      expect(buildUretimRows({ targetProduction: 'KR09', hedefAdet: null })).toEqual([])
    })

    it('hedefAdet 0 → satır yok', () => {
      expect(buildUretimRows({ targetProduction: 'KR09', hedefAdet: 0 })).toEqual([])
    })

    it('hedefAdet negatif → satır yok', () => {
      expect(buildUretimRows({ targetProduction: 'KR09', hedefAdet: -5 })).toEqual([])
    })
  })

  describe('legacy payload (uretimSatirlari yok) → 1 satır türetilir', () => {
    it('tekil alanlar birebir yansır, sira=1, hurdaAdet null', () => {
      const rows = buildUretimRows({
        targetProduction: 'KR09-8041',
        mesaiNedeni: 'Acil sevkiyat',
        hedefAdet: 180,
        gerceklesenAdet: 150,
        gerceklesenNote: 'Tezgah arızası',
      })
      expect(rows).toEqual([
        {
          parcaKodu: 'KR09-8041',
          mesaiNedeni: 'Acil sevkiyat',
          hedefAdet: 180,
          gerceklesenAdet: 150,
          gerceklesenNote: 'Tezgah arızası',
          hurdaAdet: null,
          sira: 1,
        },
      ])
    })

    it('parcaKodu trim edilir, boş gerekçe → null', () => {
      const rows = buildUretimRows({
        targetProduction: '  28780010  ',
        mesaiNedeni: '   ',
        hedefAdet: 5,
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].parcaKodu).toBe('28780010')
      expect(rows[0].mesaiNedeni).toBeNull()
      expect(rows[0].gerceklesenAdet).toBeNull()
    })

    it('gerceklesenAdet negatif → null (reddedilir)', () => {
      const rows = buildUretimRows({ targetProduction: 'X', hedefAdet: 3, gerceklesenAdet: -2 })
      expect(rows[0].gerceklesenAdet).toBeNull()
    })
  })

  describe('uretimSatirlari payload → satırlar esas', () => {
    it('birden fazla geçerli satır, sira korunur/atanır', () => {
      const rows = buildUretimRows({
        uretimSatirlari: [
          { parcaKodu: 'A', hedefAdet: 10, sira: 2 },
          { parcaKodu: 'B', hedefAdet: 20 },
        ],
      })
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ parcaKodu: 'A', hedefAdet: 10, sira: 2 })
      // sira verilmeyen 2. satır index+1 = 2
      expect(rows[1]).toMatchObject({ parcaKodu: 'B', hedefAdet: 20, sira: 2 })
    })

    it('geçersiz satırlar filtrelenir, geçerliler kalır', () => {
      const rows = buildUretimRows({
        uretimSatirlari: [
          { parcaKodu: '', hedefAdet: 10 }, // parcaKodu boş → atla
          { parcaKodu: 'B', hedefAdet: 0 }, // hedefAdet 0 → atla
          { parcaKodu: 'C', hedefAdet: 5, hurdaAdet: 3, gerceklesenAdet: 4 },
        ],
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ parcaKodu: 'C', hedefAdet: 5, hurdaAdet: 3, gerceklesenAdet: 4 })
    })

    it('hurdaAdet negatif → null', () => {
      const rows = buildUretimRows({ uretimSatirlari: [{ parcaKodu: 'C', hedefAdet: 5, hurdaAdet: -1 }] })
      expect(rows[0].hurdaAdet).toBeNull()
    })
  })

  describe('UPSERT senaryosu (satırsız eski kayıt → tekil alanlardan seed)', () => {
    it('geçerli tekil alanlar + gerceklesen → seed satır üretir', () => {
      const seed = buildUretimRows({
        targetProduction: 'KR09',
        mesaiNedeni: null,
        hedefAdet: 100,
        gerceklesenAdet: 90,
        gerceklesenNote: null,
      })
      expect(seed).toHaveLength(1)
      expect(seed[0]).toMatchObject({ parcaKodu: 'KR09', hedefAdet: 100, gerceklesenAdet: 90, sira: 1 })
    })

    it('parcaKodu yoksa seed üretilmez (yalnız tekil güncellenir)', () => {
      const seed = buildUretimRows({
        targetProduction: null,
        hedefAdet: 100,
        gerceklesenAdet: 90,
      })
      expect(seed).toEqual([])
    })
  })
})

describe('buildSingles', () => {
  describe('legacy payload → mevcut davranışla birebir', () => {
    it('tekil alanlar geçirilir (targetProduction trim edilmez)', () => {
      expect(
        buildSingles({ targetProduction: 'KR09-8041', mesaiNedeni: ' Acil ', hedefAdet: 12 })
      ).toEqual({ targetProduction: 'KR09-8041', mesaiNedeni: 'Acil', hedefAdet: 12 })
    })

    it('boş targetProduction → null, hedefAdet 0 korunur (tekil >= 0 kuralı)', () => {
      expect(buildSingles({ targetProduction: '', mesaiNedeni: '', hedefAdet: 0 })).toEqual({
        targetProduction: null,
        mesaiNedeni: null,
        hedefAdet: 0,
      })
    })

    it('hedefAdet negatif → null', () => {
      expect(buildSingles({ targetProduction: 'X', hedefAdet: -1 }).hedefAdet).toBeNull()
    })
  })

  describe('uretimSatirlari payload → 1. (min-index) satır tekil alanlara yansır', () => {
    it('ilk geçerli satırın değerleri tekil alanlara kopyalanır', () => {
      expect(
        buildSingles({
          uretimSatirlari: [
            { parcaKodu: 'A', mesaiNedeni: 'gerekce', hedefAdet: 10 },
            { parcaKodu: 'B', hedefAdet: 20 },
          ],
        })
      ).toEqual({ targetProduction: 'A', mesaiNedeni: 'gerekce', hedefAdet: 10 })
    })

    it('ilk satır geçersizse ilk GEÇERLİ satır esas alınır', () => {
      expect(
        buildSingles({
          uretimSatirlari: [
            { parcaKodu: '', hedefAdet: 10 }, // geçersiz
            { parcaKodu: 'B', hedefAdet: 20 },
          ],
        })
      ).toEqual({ targetProduction: 'B', mesaiNedeni: null, hedefAdet: 20 })
    })

    it('hiç geçerli satır yoksa tekil alanlar boşalır', () => {
      expect(buildSingles({ uretimSatirlari: [{ parcaKodu: '', hedefAdet: 0 }] })).toEqual({
        targetProduction: null,
        mesaiNedeni: null,
        hedefAdet: null,
      })
    })
  })
})
