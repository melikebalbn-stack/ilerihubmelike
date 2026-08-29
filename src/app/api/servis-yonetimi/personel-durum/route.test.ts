import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisPersonelDurumlari: vi.fn(),
  createServisPersonelDurum: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisPersonelDurumlari: mocks.listServisPersonelDurumlari,
  createServisPersonelDurum: mocks.createServisPersonelDurum,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/personel-durum — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-durum'))
    expect(res.status).toBe(403)
    expect(mocks.listServisPersonelDurumlari).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisPersonelDurumlari.mockResolvedValue([{ id: 'pd1' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-durum?durum=aktif'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisPersonelDurumlari).toHaveBeenCalledWith({ personnelId: undefined, aktif: true })
  })

  it('personnelId query param ile filtreler', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisPersonelDurumlari.mockResolvedValue([])
    await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-durum?personnelId=personel-1'))
    expect(mocks.listServisPersonelDurumlari).toHaveBeenCalledWith({ personnelId: 'personel-1', aktif: undefined })
  })
})

describe('POST /api/servis-yonetimi/personel-durum — permission guard', () => {
  const body = { personnelId: 'personel-1', durum: 'SERVIS_KULLANIYOR', baslangicTarihi: '2026-01-01' }

  it('servis.create izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }))
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.create')
    expect(mocks.createServisPersonelDurum).not.toHaveBeenCalled()
  })

  it('servis.create izni olan kullanıcı kayıt oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.createServisPersonelDurum.mockResolvedValue({ id: 'pd1', ...body })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(mocks.createServisPersonelDurum).toHaveBeenCalledWith(body, 'user-42')
  })
})
