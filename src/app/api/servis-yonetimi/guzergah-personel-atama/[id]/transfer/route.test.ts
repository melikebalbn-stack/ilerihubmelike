import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  transferServisPersonelAtama: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  transferServisPersonelAtama: mocks.transferServisPersonelAtama,
}))

import { POST } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

const context = { params: Promise.resolve({ id: 'pa1' }) }
const gecerliBody = { guzergahId: 'g2', durakId: 'd2', dilimIdleri: ['dilim-1'], transferTarihi: '2026-03-01' }

function req(body: unknown = gecerliBody) {
  return new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/servis-yonetimi/guzergah-personel-atama/[id]/transfer', () => {
  it('servis.passive izni yoksa 403 alır, servis.create hiç kontrol edilmez', async () => {
    mocks.requirePermission.mockResolvedValueOnce(permissionResult(false))
    const res = await POST(req(), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledTimes(1)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
    expect(mocks.transferServisPersonelAtama).not.toHaveBeenCalled()
  })

  it('servis.passive var ama servis.create yoksa 403 alır', async () => {
    mocks.requirePermission
      .mockResolvedValueOnce(permissionResult(true))
      .mockResolvedValueOnce(permissionResult(false))
    const res = await POST(req(), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenNthCalledWith(1, 'servis.passive')
    expect(mocks.requirePermission).toHaveBeenNthCalledWith(2, 'servis.create')
    expect(mocks.transferServisPersonelAtama).not.toHaveBeenCalled()
  })

  it('her iki izne de sahip kullanıcı transfer yapabilir', async () => {
    mocks.requirePermission
      .mockResolvedValueOnce(permissionResult(true, 'user-9'))
      .mockResolvedValueOnce(permissionResult(true, 'user-9'))
    mocks.transferServisPersonelAtama.mockResolvedValue({ id: 'pa2' })

    const res = await POST(req(), context)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.transferServisPersonelAtama).toHaveBeenCalledWith('pa1', gecerliBody, 'user-9')
  })

  it('servis fonksiyonu hata fırlatırsa 400 + mesaj döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.transferServisPersonelAtama.mockRejectedValue(new Error('Bu atama zaten pasif, transfer edilemez.'))

    const res = await POST(req(), context)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.message).toBe('Bu atama zaten pasif, transfer edilemez.')
  })
})
