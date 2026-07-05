import { describe, it, expect } from 'vitest'
import {
  buildUretimRows,
  buildSingles,
  buildBackfillRow,
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
  it('0/negatif/null → null (API satır hedefAdet > 0 zorunlu)', () => {
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

// ── API BAĞLAMI (buildUretimRows / buildSingles) ──
// parcaKodu <- mesaiNedeni (prod'da parça kodu buraya girilmiş; targetProduction retired).
// hedefAdet > 0 ZORUNLU — sağlanamayan satır oluşmaz.
describe('buildUretimRows (API bağlamı)', () => {
  describe('geçersiz satır oluşmaz', () => {
    it('parcaKodu (mesaiNedeni) boş → satır yok', () => {
      expect(buildUretimRows({ mesaiNedeni: '', hedefAdet: 10 })).toEqual([])
    })

    it('mesaiNedeni whitespace → satır yok', () => {
      expect(buildUretimRows({ mesaiNedeni: '   ', hedefAdet: 10 })).toEqual([])
    })

    it('hedefAdet null → satır yok (API zorunlu)', () => {
      expect(buildUretimRows({ mesaiNedeni: '8048', hedefAdet: null })).toEqual([])
    })

    it('hedefAdet 0 → satır yok', () => {
      expect(buildUretimRows({ mesaiNedeni: '8048', hedefAdet: 0 })).toEqual([])
    })

    it('hedefAdet negatif → satır yok', () => {
      expect(buildUretimRows({ mesaiNedeni: '8048', hedefAdet: -5 })).toEqual([])
    })
  })

  describe('legacy payload (uretimSatirlari yok) → 1 satır', () => {
    it('parcaKodu mesaiNedeni’den gelir; satır mesaiNedeni (gerekçe) null', () => {
      const rows = buildUretimRows({
        mesaiNedeni: '80050016',
        hedefAdet: 180,
        gerceklesenAdet: 150,
        gerceklesenNote: 'Tezgah arızası',
      })
      expect(rows).toEqual([
        {
          parcaKodu: '80050016',
          mesaiNedeni: null,
          hedefAdet: 180,
          gerceklesenAdet: 150,
          gerceklesenNote: 'Tezgah arızası',
          hurdaAdet: null,
          sira: 1,
        },
      ])
    })

    it('parcaKodu trim edilir', () => {
      const rows = buildUretimRows({ mesaiNedeni: '  8011-2  ', hedefAdet: 5 })
      expect(rows).toHaveLength(1)
      expect(rows[0].parcaKodu).toBe('8011-2')
      expect(rows[0].gerceklesenAdet).toBeNull()
    })

    it('gerceklesenAdet negatif → null (reddedilir)', () => {
      const rows = buildUretimRows({ mesaiNedeni: '8048', hedefAdet: 3, gerceklesenAdet: -2 })
      expect(rows[0].gerceklesenAdet).toBeNull()
    })
  })

  describe('uretimSatirlari payload (Faz 2) → satırlar esas', () => {
    it('birden fazla geçerli satır, sira korunur/atanır', () => {
      const rows = buildUretimRows({
        uretimSatirlari: [
          { parcaKodu: 'A', hedefAdet: 10, sira: 2 },
          { parcaKodu: 'B', hedefAdet: 20 },
        ],
      })
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ parcaKodu: 'A', hedefAdet: 10, sira: 2 })
      expect(rows[1]).toMatchObject({ parcaKodu: 'B', hedefAdet: 20, sira: 2 })
    })

    it('geçersiz satırlar filtrelenir, geçerliler kalır', () => {
      const rows = buildUretimRows({
        uretimSatirlari: [
          { parcaKodu: '', hedefAdet: 10 }, // parcaKodu boş → atla
          { parcaKodu: 'B', hedefAdet: 0 }, // hedefAdet 0 → atla
          { parcaKodu: 'C', hedefAdet: 5, hurdaAdet: 3, gerceklesenAdet: 4, mesaiNedeni: 'acil' },
        ],
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        parcaKodu: 'C',
        mesaiNedeni: 'acil',
        hedefAdet: 5,
        hurdaAdet: 3,
        gerceklesenAdet: 4,
      })
    })

    it('hurdaAdet negatif → null', () => {
      const rows = buildUretimRows({ uretimSatirlari: [{ parcaKodu: 'C', hedefAdet: 5, hurdaAdet: -1 }] })
      expect(rows[0].hurdaAdet).toBeNull()
    })
  })
})

describe('buildSingles (API bağlamı)', () => {
  describe('legacy payload → mevcut davranışla birebir', () => {
    it('mesaiNedeni + hedefAdet (targetProduction ARTIK yok)', () => {
      expect(buildSingles({ mesaiNedeni: ' 80050016 ', hedefAdet: 12 })).toEqual({
        mesaiNedeni: '80050016',
        hedefAdet: 12,
      })
    })

    it('boş mesaiNedeni → null, hedefAdet 0 korunur (tekil >= 0 kuralı)', () => {
      expect(buildSingles({ mesaiNedeni: '', hedefAdet: 0 })).toEqual({
        mesaiNedeni: null,
        hedefAdet: 0,
      })
    })

    it('hedefAdet negatif → null', () => {
      expect(buildSingles({ mesaiNedeni: '8048', hedefAdet: -1 }).hedefAdet).toBeNull()
    })
  })

  describe('uretimSatirlari payload → 1. satır tekil alanlara yansır', () => {
    it('tekil mesaiNedeni = 1. satırın parça kodu', () => {
      expect(
        buildSingles({
          uretimSatirlari: [
            { parcaKodu: 'A', mesaiNedeni: 'gerekce', hedefAdet: 10 },
            { parcaKodu: 'B', hedefAdet: 20 },
          ],
        })
      ).toEqual({ mesaiNedeni: 'A', hedefAdet: 10 })
    })

    it('ilk satır geçersizse ilk GEÇERLİ satır esas alınır', () => {
      expect(
        buildSingles({
          uretimSatirlari: [
            { parcaKodu: '', hedefAdet: 10 }, // geçersiz
            { parcaKodu: 'B', hedefAdet: 20 },
          ],
        })
      ).toEqual({ mesaiNedeni: 'B', hedefAdet: 20 })
    })

    it('hiç geçerli satır yoksa tekil alanlar boşalır', () => {
      expect(buildSingles({ uretimSatirlari: [{ parcaKodu: '', hedefAdet: 0 }] })).toEqual({
        mesaiNedeni: null,
        hedefAdet: null,
      })
    })
  })
})

// ── BACKFILL BAĞLAMI (buildBackfillRow) ──
// parcaKodu <- mesaiNedeni; hedefAdet null ise NULL TAŞINIR (satır yine oluşur).
// API'nin hedefAdet > 0 kuralından KASITLI olarak farklı.
describe('buildBackfillRow (backfill bağlamı)', () => {
  it('parcaKodu (mesaiNedeni) boş/whitespace → null (kayıt atlanır)', () => {
    expect(buildBackfillRow({ mesaiNedeni: null })).toBeNull()
    expect(buildBackfillRow({ mesaiNedeni: '' })).toBeNull()
    expect(buildBackfillRow({ mesaiNedeni: '   ' })).toBeNull()
  })

  it('hedefAdet null → satır OLUŞUR, hedefAdet NULL taşınır (API’den farklı)', () => {
    const row = buildBackfillRow({ mesaiNedeni: '8048', hedefAdet: null })
    expect(row).not.toBeNull()
    expect(row).toEqual({
      parcaKodu: '8048',
      mesaiNedeni: null,
      hedefAdet: null,
      gerceklesenAdet: null,
      gerceklesenNote: null,
      hurdaAdet: null,
      sira: 1,
    })
  })

  it('hedefAdet dolu → taşınır; gerceklesen alanları kopyalanır', () => {
    const row = buildBackfillRow({
      mesaiNedeni: '  80340002  ',
      hedefAdet: 370,
      gerceklesenAdet: 350,
      gerceklesenNote: 'ok',
    })
    expect(row).toEqual({
      parcaKodu: '80340002',
      mesaiNedeni: null,
      hedefAdet: 370,
      gerceklesenAdet: 350,
      gerceklesenNote: 'ok',
      hurdaAdet: null,
      sira: 1,
    })
  })

  it('gerceklesenAdet negatif → null', () => {
    const row = buildBackfillRow({ mesaiNedeni: '8048', hedefAdet: 5, gerceklesenAdet: -9 })
    expect(row?.gerceklesenAdet).toBeNull()
  })
})
