import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisSeferDilimleri: vi.fn(),
  createServisSeferDilimi: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisSeferDilimleri: mocks.listServisSeferDilimleri,
  createServisSeferDilimi: mocks.createServisSeferDilimi,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/sefer-dilimi — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/sefer-dilimi'))
    expect(res.status).toBe(403)
    expect(mocks.listServisSeferDilimleri).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı aktif filtreli listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisSeferDilimleri.mockResolvedValue([{ id: 'sd1', kod: 'V1-GIDIS' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/sefer-dilimi?durum=aktif'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisSeferDilimleri).toHaveBeenCalledWith({ aktif: true })
  })
})

describe('POST /api/servis-yonetimi/sefer-dilimi — permission guard', () => {
  const body = { kod: 'V1-GIDIS', ad: 'Vardiya 1 Gidiş', yon: 'GIDIS', sira: 1 }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/sefer-dilimi', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(403)
    expect(mocks.createServisSeferDilimi).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı dilim oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.createServisSeferDilimi.mockResolvedValue({ id: 'sd1', ...body })
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/sefer-dilimi', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.kod).toBe('V1-GIDIS')
  })
})
