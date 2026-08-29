import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisGuzergahDuraklar: vi.fn(),
  createServisGuzergahDurak: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisGuzergahDuraklar: mocks.listServisGuzergahDuraklar,
  createServisGuzergahDurak: mocks.createServisGuzergahDurak,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 'guzergah-1' }) }

describe('GET /api/servis-yonetimi/guzergah/[id]/durak — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/guzergah/guzergah-1/durak'), context)
    expect(res.status).toBe(403)
    expect(mocks.listServisGuzergahDuraklar).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisGuzergahDuraklar.mockResolvedValue([{ id: 'gd1', sira: 1 }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/guzergah/guzergah-1/durak'), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisGuzergahDuraklar).toHaveBeenCalledWith('guzergah-1')
  })
})

describe('POST /api/servis-yonetimi/guzergah/[id]/durak — permission guard', () => {
  const body = { durakId: 'durak-1' }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/guzergah/guzergah-1/durak', {
      method: 'POST',
      body: JSON.stringify(body),
    }), context)
    expect(res.status).toBe(403)
    expect(mocks.createServisGuzergahDurak).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı durak ekleyebilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.createServisGuzergahDurak.mockResolvedValue({ id: 'gd1', ...body, sira: 1 })
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/guzergah/guzergah-1/durak', {
      method: 'POST',
      body: JSON.stringify(body),
    }), context)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(mocks.createServisGuzergahDurak).toHaveBeenCalledWith('guzergah-1', body)
  })
})
