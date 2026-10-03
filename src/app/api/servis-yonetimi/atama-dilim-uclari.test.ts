import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// B5 uçları — GERÇEK requirePermission ile: 401 (oturum yok), 403 (servis.edit yok — diğer servis
// anahtarları YETMEZ), 200 (servis.edit), 409 onay kodları, 400 kullanıcı hataları.
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  onizle: vi.fn(),
  ata: vi.fn(),
  guncelle: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/servis-yonetimi/atama-dilim', async (orijinal) => ({
  ...(await orijinal<typeof import('@/lib/servis-yonetimi/atama-dilim')>()),
  topluDilimOnizle: mocks.onizle,
  topluDilimAta: mocks.ata,
  atamaDilimleriniGuncelle: mocks.guncelle,
}))

import { AtamaDilimHatasi } from '@/lib/servis-yonetimi/atama-dilim'
import { POST as ONIZLE } from './guzergah/[id]/personel-atama/dilim-onizle/route'
import { POST as ATA } from './guzergah/[id]/personel-atama/dilim-ata/route'
import { PATCH as TEK } from './guzergah-personel-atama/[id]/dilimler/route'

const ctx = { params: Promise.resolve({ id: 'g1' }) }
const istek = (govde: unknown, ham?: string) =>
  new NextRequest('http://localhost/x', { method: 'POST', body: ham ?? JSON.stringify(govde), headers: { 'Content-Type': 'application/json' } })

const UCLAR = [
  { ad: 'dilim-onizle', cagir: (r: NextRequest) => ONIZLE(r, ctx), fn: () => mocks.onizle },
  { ad: 'dilim-ata', cagir: (r: NextRequest) => ATA(r, ctx), fn: () => mocks.ata },
  { ad: 'atama/[id]/dilimler (PATCH)', cagir: (r: NextRequest) => TEK(r, ctx), fn: () => mocks.guncelle },
]

function oturum(izinler: string[] | null) {
  if (izinler === null) return mocks.getServerSession.mockResolvedValue(null)
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.onizle.mockResolvedValue({ atamaSayisi: 2 })
  mocks.ata.mockResolvedValue({ topluIslemId: 't1', degisen: 2, degismeyen: 0 })
  mocks.guncelle.mockResolvedValue({ topluIslemId: null, degisen: 1, degismeyen: 0, sonraki: ['d1'] })
})

describe.each(UCLAR)('$ad — yetki', (uc) => {
  it('oturum yok → 401, servis katmanı çağrılmaz', async () => {
    oturum(null)
    expect((await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'] }))).status).toBe(401)
    expect(uc.fn()).not.toHaveBeenCalled()
  })

  it.each([
    [[]],
    [['servis.view']],
    [['servis.view', 'servis.create', 'servis.passive', 'servis.restore', 'servis.tanim.manage', 'servis.export']],
  ])('🔴 servis.edit yok (%j) → 403', async (izinler) => {
    oturum(izinler)
    expect((await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'] }))).status).toBe(403)
    expect(uc.fn()).not.toHaveBeenCalled()
  })

  it('servis.edit → 200', async () => {
    oturum(['servis.edit'])
    const res = await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'], ekle: ['d1'] }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('bozuk JSON gövde → 400, servis çağrılmaz', async () => {
    oturum(['servis.edit'])
    expect((await uc.cagir(istek(null, '{bozuk'))).status).toBe(400)
    expect(uc.fn()).not.toHaveBeenCalled()
  })

  it('doğrulama hatası → 400 + Türkçe mesaj', async () => {
    oturum(['servis.edit'])
    uc.fn().mockRejectedValue(new AtamaDilimHatasi('"ESKİ" dilimi pasif, atama yapılamaz.'))
    const res = await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d3'], ekle: ['d3'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('"ESKİ" dilimi pasif')
  })

  it('🔴 onay gereken durum → 409 + kod + ayrıntı (istemci uyarı gösterip onayla yeniden gönderir)', async () => {
    oturum(['servis.edit'])
    uc.fn().mockRejectedValue(new AtamaDilimHatasi('aşım', 'ASIM_ONAYI_GEREKLI', { etki: [{ dilimKod: 'SABAH', fazla: 1 }] }))
    const res = await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'], ekle: ['d1'] }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', ayrinti: { etki: [{ fazla: 1 }] } })
  })

  it('beklenmeyen hata → 500 genel mesaj (iç hata sızmaz)', async () => {
    oturum(['servis.edit'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    uc.fn().mockRejectedValue(new Error('SELECT * FROM gizli'))
    const res = await uc.cagir(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'], ekle: ['d1'] }))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('gizli')
  })
})

describe('istek gövdesi servis katmanına doğru iletilir', () => {
  it('dilim-ata: asimOnayi yalnız true ise true; kullanıcı kimliği iletilir', async () => {
    oturum(['servis.edit'])
    await ATA(istek({ atamaIdleri: ['a1', 5, 'a2'], dilimIdleri: ['d1'], asimOnayi: 'evet' }), ctx)
    expect(mocks.ata).toHaveBeenCalledWith('g1', { atamaIdleri: ['a1', 'a2'], dilimIdleri: ['d1'], asimOnayi: false }, 'u1')
    await ATA(istek({ atamaIdleri: ['a1'], dilimIdleri: ['d1'], asimOnayi: true }), ctx)
    expect(mocks.ata.mock.calls[1][1].asimOnayi).toBe(true)
  })

  it('PATCH: ekle/cikar/asimOnayi/dilimsizOnayi', async () => {
    oturum(['servis.edit'])
    await TEK(istek({ ekle: ['d1'], cikar: ['d2'], dilimsizOnayi: true }), ctx)
    expect(mocks.guncelle).toHaveBeenCalledWith('g1', { ekle: ['d1'], cikar: ['d2'], asimOnayi: false, dilimsizOnayi: true }, 'u1')
  })
})
