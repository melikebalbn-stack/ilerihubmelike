import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  ozetGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/panel', () => ({ servisPaneliOzetiGetir: mocks.ozetGetir }))

import { GET } from './route'

const izin = (ok: boolean, status = 403) =>
  ok
    ? { error: null, userId: 'u1' }
    : { error: NextResponse.json({ error: 'Yetersiz yetki' }, { status }), userId: null }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/servis-yonetimi/panel', () => {
  it('oturum yok → 401, veri okunmaz', async () => {
    mocks.requirePermission.mockResolvedValue(izin(false, 401))
    expect((await GET()).status).toBe(401)
    expect(mocks.ozetGetir).not.toHaveBeenCalled()
  })

  it('servis.view yok → 403, veri okunmaz', async () => {
    mocks.requirePermission.mockResolvedValue(izin(false))
    expect((await GET()).status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
    expect(mocks.ozetGetir).not.toHaveBeenCalled()
  })

  it('yetkili → 200 ve özet', async () => {
    mocks.requirePermission.mockResolvedValue(izin(true))
    mocks.ozetGetir.mockResolvedValue({ buAy: { toplam: 3 }, veriKalite: { toplamBulgu: 2 } })
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).data.buAy.toplam).toBe(3)
  })

  it('kaynak hata verirse 500 ve Türkçe mesaj', async () => {
    mocks.requirePermission.mockResolvedValue(izin(true))
    mocks.ozetGetir.mockRejectedValue(new Error('db'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    expect(res.status).toBe(500)
    expect((await res.json()).message).toContain('Panel özeti')
  })
})
