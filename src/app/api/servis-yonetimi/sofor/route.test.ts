import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listServisSoforler: vi.fn(),
  createServisSofor: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisSoforler: mocks.listServisSoforler,
  createServisSofor: mocks.createServisSofor,
}))

import { GET, POST } from './route'

beforeEach(() => vi.clearAllMocks())

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }), userId: null }
}

describe('ServisSofor collection route', () => {
  it('GET için servis.view ister ve reddedilirse servisi çağırmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/sofor'))
    expect(response.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
    expect(mocks.listServisSoforler).not.toHaveBeenCalled()
  })

  it('GET aktif filtresiyle şoförleri listeler', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.listServisSoforler.mockResolvedValue([{ id: 's1', adSoyad: 'Test Şoför' }])
    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/sofor?durum=aktif'))
    expect(response.status).toBe(200)
    expect(mocks.listServisSoforler).toHaveBeenCalledWith({ aktif: true })
  })

  it('POST için servis.tanim.manage ister ve reddedilirse servisi çağırmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const response = await POST(new NextRequest('http://localhost/api/servis-yonetimi/sofor', { method: 'POST' }))
    expect(response.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.tanim.manage')
    expect(mocks.createServisSofor).not.toHaveBeenCalled()
  })

  it('POST geçerli gövdeyle şoför oluşturur', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const body = { adSoyad: 'Test Şoför', telefon: '0532 123 45 67', firmaId: 'f1' }
    mocks.createServisSofor.mockResolvedValue({ id: 's1', ...body })
    const response = await POST(new NextRequest('http://localhost/api/servis-yonetimi/sofor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    expect(response.status).toBe(201)
    expect(mocks.createServisSofor).toHaveBeenCalledWith(body, 'user-1')
  })
})
