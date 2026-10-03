import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  topluGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/kapasite', async (orijinal) => ({
  ...(await orijinal<typeof import('@/lib/servis-yonetimi/kapasite')>()),
  servisKapasiteTopluGetir: mocks.topluGetir,
}))

import { GET } from './route'

const izin = (ok: boolean, status = 403) =>
  ok
    ? { error: null, userId: 'u1' }
    : { error: NextResponse.json({ error: 'Yetersiz yetki' }, { status }), userId: null }
const istek = (q = '') => new NextRequest(`http://localhost/api/servis-yonetimi/kapasite-toplu${q}`)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/servis-yonetimi/kapasite-toplu', () => {
  it('oturum yok → 401', async () => {
    mocks.requirePermission.mockResolvedValue(izin(false, 401))
    expect((await GET(istek())).status).toBe(401)
    expect(mocks.topluGetir).not.toHaveBeenCalled()
  })

  it('servis.view yok → 403', async () => {
    mocks.requirePermission.mockResolvedValue(izin(false))
    expect((await GET(istek())).status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
    expect(mocks.topluGetir).not.toHaveBeenCalled()
  })

  it('yetkili, tarihsiz → 200 (bugün) ve guzergahId iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(izin(true))
    mocks.topluGetir.mockResolvedValue({ guzergahlar: [] })
    const res = await GET(istek('?guzergahId=g1'))
    expect(res.status).toBe(200)
    expect(mocks.topluGetir.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(mocks.topluGetir.mock.calls[0][1]).toEqual({ guzergahId: 'g1' })
  })

  it('geçerli tarih motora aynen gider', async () => {
    mocks.requirePermission.mockResolvedValue(izin(true))
    mocks.topluGetir.mockResolvedValue({ guzergahlar: [] })
    await GET(istek('?tarih=2026-03-05'))
    expect((mocks.topluGetir.mock.calls[0][0] as Date).toISOString().slice(0, 10)).toBe('2026-03-05')
  })

  it('geçersiz tarih → 400, motor çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue(izin(true))
    const res = await GET(istek('?tarih=2026-02-31'))
    expect(res.status).toBe(400)
    expect(mocks.topluGetir).not.toHaveBeenCalled()
  })
})
