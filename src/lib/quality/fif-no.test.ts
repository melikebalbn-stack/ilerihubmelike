import { describe, it, expect } from 'vitest'
import { fifNoPrefix, parseFifNo } from './fif-no'
import { fifInput, FIF_ZORUNLU_ALANLAR } from './fif-validators'
import { fifRecordInScope } from './fif-access'

describe('fif-no — kayıt no biçim + yıl geçişi', () => {
  it('prefix yıl bazlı', () => {
    expect(fifNoPrefix(2026)).toBe('FIF-2026-')
    expect(fifNoPrefix(2027)).toBe('FIF-2027-')
  })

  it('parseFifNo geçerli biçimi ayrıştırır', () => {
    expect(parseFifNo('FIF-2026-001')).toEqual({ year: 2026, seq: 1 })
    expect(parseFifNo('FIF-2026-042')).toEqual({ year: 2026, seq: 42 })
    expect(parseFifNo('FIF-2027-123')).toEqual({ year: 2027, seq: 123 })
  })

  it('biçim dışı değerler null', () => {
    expect(parseFifNo('FIF-2026-')).toBeNull()
    expect(parseFifNo('2026-001')).toBeNull()
    expect(parseFifNo('FIF-26-001')).toBeNull()
    expect(parseFifNo('OR-2026-00001')).toBeNull()
  })

  it('yıl geçişi: farklı yıl prefix ayrı seri (aynı seq çakışmaz)', () => {
    const a = parseFifNo('FIF-2026-050')!
    const b = parseFifNo('FIF-2027-001')!
    expect(a.year).not.toBe(b.year)
    // 2027 yeni yıl 001'den başlar — 2026'nın 050'siyle karışmaz (prefix ayrı).
    expect(fifNoPrefix(a.year)).not.toBe(fifNoPrefix(b.year))
  })

  it('seq 3+ hane (taşma da ayrıştırılır)', () => {
    expect(parseFifNo('FIF-2026-1000')).toEqual({ year: 2026, seq: 1000 })
  })
})

describe('fif-validators — Faz 1 zorunluluk (tek kaynak)', () => {
  const gecerli = { tur: 'DUZELTICI', sorumluBolumId: 'dept1', uygunsuzlukTanimi: 'Tespit' }

  it('zorunlu üçlü sağlanınca geçer', () => {
    expect(fifInput.safeParse(gecerli).success).toBe(true)
  })

  it('sorumluBolumId eksikse reddeder', () => {
    const { sorumluBolumId, ...eksik } = gecerli
    void sorumluBolumId
    expect(fifInput.safeParse(eksik).success).toBe(false)
  })

  it('tespit (uygunsuzlukTanimi) boşsa reddeder', () => {
    expect(fifInput.safeParse({ ...gecerli, uygunsuzlukTanimi: '   ' }).success).toBe(false)
  })

  it('geçersiz tür reddeder', () => {
    expect(fifInput.safeParse({ ...gecerli, tur: 'BASKA' }).success).toBe(false)
  })

  it('opsiyonel alanlar boş bırakılabilir; boş string → null normalize', () => {
    const r = fifInput.safeParse({ ...gecerli, denetlemeAdi: '', standartMadde: '' })
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.denetlemeAdi).toBeNull() }
  })

  it('FIF_ZORUNLU_ALANLAR tam olarak Faz 1 üçlüsü (sıkılaştırma tek kaynak)', () => {
    expect([...FIF_ZORUNLU_ALANLAR]).toEqual(['tur', 'sorumluBolumId', 'uygunsuzlukTanimi'])
  })

  it('faaliyet satırı açıklaması zorunlu (alt kayıt tutarlılık)', () => {
    const r = fifInput.safeParse({ ...gecerli, faaliyetler: [{ sira: 1, aciklama: '' }] })
    expect(r.success).toBe(false)
  })
})

describe('fif-access — kapsam predicate (fifRecordInScope, DB\'siz)', () => {
  const kayit = {
    createdById: 'baskaUser',
    hazirlayanUserId: 'baskaUser',
    sorumluBolumId: 'deptX',
    yayinlayanBolumId: null,
  }

  it('manage → TÜMÜ görür (ilgisiz kayıt bile)', () => {
    const ctx = { userId: 'u1', isManage: true, deptIds: [] }
    expect(fifRecordInScope(ctx, kayit)).toBe(true)
  })

  it('hazırlayan/kendi → kendi açtığı veya hazırlayan olduğu kaydı görür', () => {
    const ctx = { userId: 'u1', isManage: false, deptIds: [] }
    expect(fifRecordInScope(ctx, { ...kayit, createdById: 'u1' })).toBe(true)
    expect(fifRecordInScope(ctx, { ...kayit, hazirlayanUserId: 'u1' })).toBe(true)
    // bölümü de eşleşiyorsa görür
    expect(fifRecordInScope({ ...ctx, deptIds: ['deptX'] }, kayit)).toBe(true)
  })

  it('ilgisiz/boş → görmez (farklı user, bölüm eşleşmez, oturumsuz)', () => {
    expect(fifRecordInScope({ userId: 'u1', isManage: false, deptIds: ['deptY'] }, kayit)).toBe(false)
    expect(fifRecordInScope({ userId: null, isManage: false, deptIds: [] }, kayit)).toBe(false)
  })
})
