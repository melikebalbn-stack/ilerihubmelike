import { describe, expect, it, vi } from 'vitest'
import {
  FIF_KSS_KOLTUK_KODLARI, kssKoltukKullanicilari, kullaniciKssKoltugundaMi, fifZinciriCoz,
} from './fif-zincir'

/**
 * KSS KOLTUK bazlı (Kalite kararı): koltuk kodu → OrgEmployee (personnelId dolu)
 * → aktif User. Kişi id'si / ad kodda YOK; `fif.kss` izni kullanılmaz.
 * Sahte db — gerçek DB'ye bağlanmaz.
 */

type Koltuk = { personnelId: string | null; code: string; aktifKoltuk?: boolean }
type Kullanici = { id: string; personnelId: string | null; isActive: boolean; name: string }

function sahteDb(koltuklar: Koltuk[], kullanicilar: Kullanici[], bolumler: Record<string, { mudurId: string | null; mudurYardimcisiId: string | null }> = {}) {
  const koltukEsles = (where: { personnelId?: unknown; orgUnit: { code: { in: string[] }; isActive: boolean } }) =>
    koltuklar.filter((k) =>
      where.orgUnit.code.in.includes(k.code) && (k.aktifKoltuk ?? true) === where.orgUnit.isActive &&
      (typeof where.personnelId === 'string' ? k.personnelId === where.personnelId : k.personnelId !== null))
  return {
    orgEmployee: {
      findMany: vi.fn(async ({ where }) => koltukEsles(where).map((k) => ({ personnelId: k.personnelId }))),
      findFirst: vi.fn(async ({ where }) => (koltukEsles(where)[0] ? { id: 'oe' } : null)),
    },
    user: {
      findMany: vi.fn(async ({ where }) => kullanicilar
        .filter((u) => u.isActive === where.isActive && u.personnelId && where.personnelId.in.includes(u.personnelId))
        .map((u) => ({ id: u.id, name: u.name, email: null, personnel: null }))),
      findFirst: vi.fn(async ({ where }) => {
        const u = kullanicilar.find((x) =>
          (where.id ? x.id === where.id : x.personnelId === where.personnelId) && x.isActive === where.isActive)
        return u ? { id: u.id, personnelId: u.personnelId, name: u.name, email: null, personnel: null } : null
      }),
    },
    departmentDefinition: { findUnique: vi.fn(async ({ where }) => bolumler[where.id] ?? null) },
  }
}

const SKS = FIF_KSS_KOLTUK_KODLARI[0]
const KM = FIF_KSS_KOLTUK_KODLARI[1]

describe('fif-zincir — KSS koltukları', () => {
  it('koltuk kodları yalnız OrgUnit.code (kişi id/ad yok): Sistem Kalite Sorumlusu + Kalite Müdürü', () => {
    expect([...FIF_KSS_KOLTUK_KODLARI]).toEqual(['ORG-TF-P0085', 'ORG-TF-P0079'])
  })

  it('iki koltuktaki aktif kullanıcıların HEPSİ döner; pasif kullanıcı ve boş koltuk dönmez', async () => {
    const db = sahteDb(
      [{ personnelId: 'p1', code: SKS }, { personnelId: 'p2', code: KM }, { personnelId: null, code: SKS }, { personnelId: 'p3', code: 'ORG-TF-BASKA' }],
      [
        { id: 'u1', personnelId: 'p1', isActive: true, name: 'A' },
        { id: 'u2', personnelId: 'p2', isActive: true, name: 'B' },
        { id: 'u3', personnelId: 'p3', isActive: true, name: 'C' }, // başka koltuk
        { id: 'u9', personnelId: 'p1', isActive: false, name: 'Pasif' },
      ],
    )
    const r = await kssKoltukKullanicilari(db as never)
    expect(r.map((k) => k.userId)).toEqual(['u1', 'u2'])
    expect(r.every((k) => k.kaynak === 'KSS_KOLTUK')).toBe(true)
  })

  it('koltuklar boşsa liste boş (DB\'ye ikinci sorgu atılmaz)', async () => {
    const db = sahteDb([], [])
    expect(await kssKoltukKullanicilari(db as never)).toEqual([])
    expect(db.user.findMany).not.toHaveBeenCalled()
  })

  it('kullaniciKssKoltugundaMi: koltuktaki aktif kullanıcı → true; başka koltuk / pasif / oturumsuz → false', async () => {
    const db = sahteDb(
      [{ personnelId: 'p1', code: KM }, { personnelId: 'p3', code: 'ORG-TF-BASKA' }],
      [
        { id: 'u1', personnelId: 'p1', isActive: true, name: 'A' },
        { id: 'u3', personnelId: 'p3', isActive: true, name: 'C' },
        { id: 'u9', personnelId: 'p1', isActive: false, name: 'Pasif' },
      ],
    )
    expect(await kullaniciKssKoltugundaMi(db as never, 'u1')).toBe(true)
    expect(await kullaniciKssKoltugundaMi(db as never, 'u3')).toBe(false)
    expect(await kullaniciKssKoltugundaMi(db as never, 'u9')).toBe(false)
    expect(await kullaniciKssKoltugundaMi(db as never, null)).toBe(false)
  })

  it('pasif koltuk (OrgUnit.isActive=false) KSS sayılmaz', async () => {
    const db = sahteDb([{ personnelId: 'p1', code: SKS, aktifKoltuk: false }], [{ id: 'u1', personnelId: 'p1', isActive: true, name: 'A' }])
    expect(await kullaniciKssKoltugundaMi(db as never, 'u1')).toBe(false)
    expect(await kssKoltukKullanicilari(db as never)).toEqual([])
  })
})

describe('fif-zincir — fifZinciriCoz FAIL-CLOSED', () => {
  it('KSS koltuklarında kimse yoksa "Onaya Gönder" ilerlemez', async () => {
    const r = await fifZinciriCoz(sahteDb([], []) as never, { sorumluBolumId: null, yayinlayanBolumId: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.sebep).toContain('KSS')
  })

  it('koltukta aktif KSS varsa zincir çözülür (kssler listesi)', async () => {
    const db = sahteDb(
      [{ personnelId: 'p1', code: SKS }],
      [{ id: 'u1', personnelId: 'p1', isActive: true, name: 'A' }, { id: 'uM', personnelId: 'pM', isActive: true, name: 'Müdür' }],
      { d2: { mudurId: 'pM', mudurYardimcisiId: null } },
    )
    const r = await fifZinciriCoz(db as never, { sorumluBolumId: null, yayinlayanBolumId: 'd2' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kssler.map((k) => k.userId)).toEqual(['u1'])
      expect(r.yayinlayanOnaylayan?.userId).toBe('uM')
    }
  })

  it('yayınlayan bölümün müdürü çözülemezse FAIL-CLOSED', async () => {
    const db = sahteDb([{ personnelId: 'p1', code: SKS }], [{ id: 'u1', personnelId: 'p1', isActive: true, name: 'A' }], { d2: { mudurId: null, mudurYardimcisiId: null } })
    const r = await fifZinciriCoz(db as never, { sorumluBolumId: null, yayinlayanBolumId: 'd2' })
    expect(r.ok).toBe(false)
  })
})
