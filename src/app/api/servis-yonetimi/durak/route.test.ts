import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisDuraklar: vi.fn(),
  createServisDurak: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisDuraklar: mocks.listServisDuraklar,
  createServisDurak: mocks.createServisDurak,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/durak — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/durak'))
    expect(res.status).toBe(403)
    expect(mocks.listServisDuraklar).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı aktif filtreli listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisDuraklar.mockResolvedValue([{ id: 'd1', kod: 'DRK-01' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/durak?durum=aktif'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisDuraklar).toHaveBeenCalledWith({ aktif: true })
  })
})

describe('POST /api/servis-yonetimi/durak — permission guard', () => {
  const body = { kod: 'DRK-01', ad: 'İstasyon Şube' }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/durak', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(403)
    expect(mocks.createServisDurak).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı durak oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.createServisDurak.mockResolvedValue({ id: 'd1', ...body })
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/durak', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.kod).toBe('DRK-01')
  })
})
