import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisGuzergahlar: vi.fn(),
  createServisGuzergah: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisGuzergahlar: mocks.listServisGuzergahlar,
  createServisGuzergah: mocks.createServisGuzergah,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/guzergah — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/guzergah'))
    expect(res.status).toBe(403)
    expect(mocks.listServisGuzergahlar).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisGuzergahlar.mockResolvedValue([{ id: 'g1', kod: 'DAR-1' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/guzergah?durum=aktif'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisGuzergahlar).toHaveBeenCalledWith({ aktif: true })
  })
})

describe('POST /api/servis-yonetimi/guzergah — permission guard', () => {
  const body = { kod: 'DAR-1', ad: 'Darıca', yerleskeId: 'yer-1' }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/guzergah', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(403)
    expect(mocks.createServisGuzergah).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı güzergâh oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.createServisGuzergah.mockResolvedValue({ id: 'g1', ...body })
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/guzergah', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.kod).toBe('DAR-1')
  })
})
