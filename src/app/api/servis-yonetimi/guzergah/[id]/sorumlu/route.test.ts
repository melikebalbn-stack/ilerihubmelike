import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisSorumlulari: vi.fn(),
  createServisSorumlusu: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisSorumlulari: mocks.listServisSorumlulari,
  createServisSorumlusu: mocks.createServisSorumlusu,
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

const context = { params: Promise.resolve({ id: 'guzergah-1' }) }

describe('GET /api/servis-yonetimi/guzergah/[id]/sorumlu — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(403)
    expect(mocks.listServisSorumlulari).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisSorumlulari.mockResolvedValue([{ id: 's1' }])
    const res = await GET(new NextRequest('http://localhost/x'), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisSorumlulari).toHaveBeenCalledWith('guzergah-1', { aktif: undefined })
  })
})

describe('POST /api/servis-yonetimi/guzergah/[id]/sorumlu — permission guard', () => {
  const body = { personnelId: 'personel-1', rol: 'ANA', baslangicTarihi: '2026-01-01' }

  it('servis.sorumlu.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    expect(res.status).toBe(403)
    expect(mocks.createServisSorumlusu).not.toHaveBeenCalled()
  })

  it('servis.sorumlu.manage izni olan kullanıcı atama oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.createServisSorumlusu.mockResolvedValue({ id: 's1', ...body })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(mocks.createServisSorumlusu).toHaveBeenCalledWith({ ...body, guzergahId: 'guzergah-1' }, 'user-42')
  })
})
