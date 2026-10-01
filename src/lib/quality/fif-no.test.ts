import { describe, it, expect } from 'vitest'
import { fifNoPrefix, parseFifNo, sonrakiFifNo, fifNoYili } from './fif-no'
import { fifInput, FIF_ZORUNLU_ALANLAR } from './fif-validators'
import { fifRecordInScope } from './fif-access'
import { hardDeleteEdilebilir } from './fif-durum'
import { FifDurum } from '@/generated/prisma'

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

describe('fif-no — sonrakiFifNo (SAYISAL en büyük, Paket 3)', () => {
  it('boş yıl → 001', () => {
    expect(sonrakiFifNo(2026, [])).toBe('FIF-2026-001')
  })
  it('999 → 1000 (metin sıralaması 999\'u büyük sanıyordu)', () => {
    expect(sonrakiFifNo(2026, ['FIF-2026-999', 'FIF-2026-998'])).toBe('FIF-2026-1000')
  })
  it('1000 varken 999 metin olarak büyük görünse de 1001 üretir', () => {
    expect(sonrakiFifNo(2026, ['FIF-2026-999', 'FIF-2026-1000'])).toBe('FIF-2026-1001')
  })
  it('başka yıl, null ve biçim dışı numaralar yok sayılır', () => {
    expect(sonrakiFifNo(2026, ['FIF-2027-050', null, 'FIF-2026-abc', 'FIF-2026-007'])).toBe('FIF-2026-008')
  })
  it('numaralama yılı İstanbul yılı: 31.12 23:30 UTC = 01.01 İstanbul', () => {
    expect(fifNoYili(new Date('2026-12-31T23:30:00.000Z'))).toBe(2027)
    expect(fifNoYili(new Date('2026-12-31T20:30:00.000Z'))).toBe(2026)
  })
})

describe('fif-validators — Faz 1 zorunluluk (tek kaynak)', () => {
  const gecerli = { tur: 'DUZELTICI', sorumluBolumId: 'dept1', uygunsuzlukTanimi: 'Tespit' }

  it('zorunlu üçlü sağlanınca geçer', () => {
    expect(fifInput.safeParse(gecerli).success).toBe(true)
  })

  it('sorumluBolumId olmadan da TASLAK olarak GEÇER (zorunluluk Onaya Gönder\'de)', () => {
    const { sorumluBolumId, ...eksik } = gecerli
    void sorumluBolumId
    expect(fifInput.safeParse(eksik).success).toBe(true)
  })

  it('tespit boş da GEÇER (TASLAK serbest kayıt)', () => {
    expect(fifInput.safeParse({ ...gecerli, uygunsuzlukTanimi: '   ' }).success).toBe(true)
  })
  it('hiç alan olmadan boş taslak GEÇER (tur default DUZELTICI)', () => {
    const r = fifInput.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.tur).toBe('DUZELTICI')
  })

  it('geçersiz tür reddeder', () => {
    expect(fifInput.safeParse({ ...gecerli, tur: 'BASKA' }).success).toBe(false)
  })

  it('opsiyonel alanlar boş bırakılabilir; boş string → null normalize', () => {
    const r = fifInput.safeParse({ ...gecerli, standartMadde: '', kokNedenAnalizi: '' })
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.standartMadde).toBeNull() }
  })

  it('Paket 3: denetlemeAdi / uygulamaSorumlusuUserId / ekTerminNedeni istekten ALINMAZ (atılır)', () => {
    const r = fifInput.safeParse({ ...gecerli, denetlemeAdi: 'eski', uygulamaSorumlusuUserId: 'u9', ekTerminNedeni: 'eski', kaynakId: 'k1' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect('denetlemeAdi' in r.data).toBe(false)
      expect('ekTerminNedeni' in r.data).toBe(false)
      expect('uygulamaSorumlusuUserId' in r.data).toBe(false)
      expect(r.data.kaynakId).toBe('k1')
    }
  })

  it('FIF_ZORUNLU_ALANLAR: tür + sorumlu bölüm + yayınlayan bölüm + tespit (Onaya Gönder, tek kaynak)', () => {
    expect([...FIF_ZORUNLU_ALANLAR]).toEqual(['tur', 'sorumluBolumId', 'yayinlayanBolumId', 'uygunsuzlukTanimi'])
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

describe('fif-durum — hardDeleteEdilebilir (TASLAK boş)', () => {
  it('TASLAK + alt kayıt yok → hard delete edilebilir', () => {
    expect(hardDeleteEdilebilir(FifDurum.TASLAK, false)).toBe(true)
  })
  it('TASLAK ama alt kayıt var → hard delete EDİLEMEZ (IPTAL akışı)', () => {
    expect(hardDeleteEdilebilir(FifDurum.TASLAK, true)).toBe(false)
  })
  it('TASLAK dışı durum → hard delete EDİLEMEZ', () => {
    for (const d of [FifDurum.ONAY_BEKLIYOR, FifDurum.FAALIYET, FifDurum.KAPANDI, FifDurum.IPTAL]) {
      expect(hardDeleteEdilebilir(d, false)).toBe(false)
    }
  })
})

describe('fif-access — IPTAL kaydı kapsam dışı DEĞİL (detay salt-okunur açılabilir)', () => {
  it('kendi açtığı IPTAL kaydı kapsamda (fifRecordInScope durumdan bağımsız)', () => {
    const ctx = { userId: 'u1', isManage: false, deptIds: [] }
    const iptalKayit = { createdById: 'u1', hazirlayanUserId: null, sorumluBolumId: 'x', yayinlayanBolumId: null }
    expect(fifRecordInScope(ctx, iptalKayit)).toBe(true)
  })
})
