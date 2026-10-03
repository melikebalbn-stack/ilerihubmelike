import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// C0/C1 uçları — GERÇEK requirePermission ile: Yeni Atama (servis.create), Transfer ve Transfer önizleme
// (servis.passive VE servis.create — ikisi de AYRI AYRI zorunlu), 409 aşım onayı, 400 hatalar.
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  olustur: vi.fn(),
  transfer: vi.fn(),
  onizle: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisPersonelAtama: mocks.olustur,
  listServisPersonelAtamalari: vi.fn(),
  transferServisPersonelAtama: mocks.transfer,
  transferKapasiteOnizle: mocks.onizle,
}))

import { AtamaDilimHatasi } from '@/lib/servis-yonetimi/kapasite-asim'
import { POST as YENI } from './guzergah/[id]/personel-atama/route'
import { POST as TRANSFER } from './guzergah-personel-atama/[id]/transfer/route'
import { POST as ONIZLE } from './guzergah-personel-atama/[id]/transfer-onizle/route'

const ctx = { params: Promise.resolve({ id: 'x1' }) }
const istek = (govde: unknown) =>
  new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(govde), headers: { 'Content-Type': 'application/json' } })
const oturum = (izinler: string[] | null) => {
  if (izinler === null) return mocks.getServerSession.mockResolvedValue(null)
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}
const ASIM = new AtamaDilimHatasi('aşım', 'ASIM_ONAYI_GEREKLI', { etki: [{ dilimKod: 'SABAH_GIDIŞ', fazla: 1 }] })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.olustur.mockResolvedValue({ id: 'a1' })
  mocks.transfer.mockResolvedValue({ id: 'a2' })
  mocks.onizle.mockResolvedValue({ etki: [], asimVar: false })
})

describe('Yeni Atama (POST guzergah/[id]/personel-atama)', () => {
  it('oturum yok → 401; servis.create yok → 403', async () => {
    oturum(null)
    expect((await YENI(istek({}), ctx)).status).toBe(401)
    oturum(['servis.view', 'servis.edit'])
    expect((await YENI(istek({}), ctx)).status).toBe(403)
    expect(mocks.olustur).not.toHaveBeenCalled()
  })

  it('🔴 aşım onayı gerekli → 409 + kod + etki (istemci uyarıp asimOnayi:true ile yeniden gönderir)', async () => {
    oturum(['servis.create'])
    mocks.olustur.mockRejectedValue(ASIM)
    const res = await YENI(istek({ personnelId: 'p', dilimIdleri: ['d1'] }), ctx)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ ok: false, kod: 'ASIM_ONAYI_GEREKLI', ayrinti: { etki: [{ fazla: 1 }] } })
  })

  it('asimOnayi gövdeyle servis katmanına iletilir; doğrulama hatası 400 kalır', async () => {
    oturum(['servis.create'])
    await YENI(istek({ personnelId: 'p', dilimIdleri: ['d1'], asimOnayi: true }), ctx)
    expect(mocks.olustur.mock.calls[0][0]).toMatchObject({ asimOnayi: true, guzergahId: 'x1' })
    mocks.olustur.mockRejectedValue(new Error('Pasif personel servise atanamaz.'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await YENI(istek({}), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('Pasif personel')
  })
})

describe.each([
  { ad: 'transfer', cagir: TRANSFER, fn: () => mocks.transfer },
  { ad: 'transfer-onizle', cagir: ONIZLE, fn: () => mocks.onizle },
])('$ad — yetki (passive VE create ayrı ayrı)', ({ cagir, fn }) => {
  it('oturum yok → 401', async () => {
    oturum(null)
    expect((await cagir(istek({}), ctx)).status).toBe(401)
    expect(fn()).not.toHaveBeenCalled()
  })

  it.each([[['servis.passive']], [['servis.create']], [['servis.view', 'servis.edit']]])('🔴 eksik anahtar (%j) → 403', async (izinler) => {
    oturum(izinler)
    expect((await cagir(istek({}), ctx)).status).toBe(403)
    expect(fn()).not.toHaveBeenCalled()
  })

  it('passive + create → 200', async () => {
    oturum(['servis.passive', 'servis.create'])
    expect((await cagir(istek({ guzergahId: 'g2', dilimIdleri: ['d1'], transferTarihi: '2026-10-03' }), ctx)).status).toBe(200)
  })
})

describe('transfer — hata eşlemesi', () => {
  it('🔴 aşım onayı gerekli → 409 (eski atama kapanmadı)', async () => {
    oturum(['servis.passive', 'servis.create'])
    mocks.transfer.mockRejectedValue(ASIM)
    const res = await TRANSFER(istek({ guzergahId: 'g2', dilimIdleri: ['d1'], transferTarihi: '2026-10-03' }), ctx)
    expect(res.status).toBe(409)
    expect((await res.json()).kod).toBe('ASIM_ONAYI_GEREKLI')
  })

  it('doğrulama hatası 400 + Türkçe mesaj; asimOnayi iletilir', async () => {
    oturum(['servis.passive', 'servis.create'])
    mocks.transfer.mockRejectedValue(new Error('Bu durak, seçilen güzergahın bir durağı değil.'))
    const res = await TRANSFER(istek({ guzergahId: 'g2', dilimIdleri: [], transferTarihi: 'x', asimOnayi: true }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('güzergahın bir durağı değil')
    expect(mocks.transfer.mock.calls[0][1]).toMatchObject({ asimOnayi: true })
  })

  it('önizleme: hata 400, başarılıda etki + asimVar', async () => {
    oturum(['servis.passive', 'servis.create'])
    mocks.onizle.mockResolvedValue({ etki: [{ dilimKod: 'SABAH_GIDIŞ', once: 8, sonra: 9 }], asimVar: false })
    const ok = await ONIZLE(istek({}), ctx)
    expect((await ok.json()).data.etki[0]).toMatchObject({ once: 8, sonra: 9 })
    mocks.onizle.mockRejectedValue(new Error('Pasif güzergaha transfer yapılamaz.'))
    expect((await ONIZLE(istek({}), ctx)).status).toBe(400)
  })
})
