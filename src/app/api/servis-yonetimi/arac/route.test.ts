import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisAraclar: vi.fn(),
  createServisArac: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisAraclar: mocks.listServisAraclar,
  createServisArac: mocks.createServisArac,
}))

import { GET, POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/arac — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/arac'))
    expect(res.status).toBe(403)
    expect(mocks.listServisAraclar).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı aktif filtreli listeyi görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisAraclar.mockResolvedValue([{ id: 'a1', plaka: '41ABC123' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/arac?durum=aktif'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.toplam).toBe(1)
    expect(mocks.listServisAraclar).toHaveBeenCalledWith({ aktif: true })
  })
})

describe('POST /api/servis-yonetimi/arac — permission guard', () => {
  const body = { plaka: '41ABC123', kapasite: 16, firmaId: 'firma-1' }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/arac', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    expect(res.status).toBe(403)
    expect(mocks.createServisArac).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı araç oluşturabilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.createServisArac.mockResolvedValue({ id: 'a1', ...body })
    const res = await POST(new NextRequest('http://localhost/api/servis-yonetimi/arac', {
      method: 'POST',
      body: JSON.stringify(body),
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.plaka).toBe('41ABC123')
  })
})
