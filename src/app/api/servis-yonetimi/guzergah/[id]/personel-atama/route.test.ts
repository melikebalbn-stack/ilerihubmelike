import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisPersonelAtamalari: vi.fn(),
  createServisPersonelAtama: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisPersonelAtamalari: mocks.listServisPersonelAtamalari,
  createServisPersonelAtama: mocks.createServisPersonelAtama,
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

describe('GET /api/servis-yonetimi/guzergah/[id]/personel-atama — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(403)
    expect(mocks.listServisPersonelAtamalari).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisPersonelAtamalari.mockResolvedValue([{ id: 'pa1' }])
    const res = await GET(new NextRequest('http://localhost/x'), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisPersonelAtamalari).toHaveBeenCalledWith('guzergah-1', { aktif: undefined })
  })
})

describe('POST /api/servis-yonetimi/guzergah/[id]/personel-atama — permission guard', () => {
  const body = { personnelId: 'personel-1', baslangicTarihi: '2026-01-01', dilimIdleri: ['dilim-1'] }

  it('servis.create izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.create')
    expect(mocks.createServisPersonelAtama).not.toHaveBeenCalled()
  })

  it('servis.create izni olan kullanıcı atama oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.createServisPersonelAtama.mockResolvedValue({ id: 'pa1', ...body })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(mocks.createServisPersonelAtama).toHaveBeenCalledWith({ ...body, guzergahId: 'guzergah-1' }, 'user-42')
  })
})
