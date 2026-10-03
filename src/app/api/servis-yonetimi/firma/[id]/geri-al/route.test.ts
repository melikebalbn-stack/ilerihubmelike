import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  geriAlServisFirma: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({ geriAlServisFirma: mocks.geriAlServisFirma }))

import { POST } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'f1' }) }

describe('POST /api/servis-yonetimi/firma/[id]/geri-al', () => {
  it('servis.restore izni ister', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.restore')
    expect(mocks.geriAlServisFirma).not.toHaveBeenCalled()
  })

  it('işlemi yapan kullanıcının id’sini geriAlServisFirma’ya (audit için) iletir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.geriAlServisFirma.mockResolvedValue({ id: 'f1', aktif: true })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(res.status).toBe(200)
    expect(mocks.geriAlServisFirma).toHaveBeenCalledWith('f1', 'user-42', { zincirGeriAl: false })
  })

  it('🔴 { zincirGeriAl: true } → birlikte pasifleşenler de geri alınır (seçenek servise iletilir)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.geriAlServisFirma.mockResolvedValue({ id: 'f1', aktif: true })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ zincirGeriAl: true }) }), context)
    expect(res.status).toBe(200)
    expect(mocks.geriAlServisFirma).toHaveBeenCalledWith('f1', 'user-42', { zincirGeriAl: true })
  })

  it.each([['"true"', { zincirGeriAl: 'true' }], ['1', { zincirGeriAl: 1 }], ['onay alanı', { onay: true }]])(
    'zincirGeriAl yalnız boolean true sayılır: %s → false',
    async (_ad, govde) => {
      mocks.requirePermission.mockResolvedValue(permissionResult(true))
      mocks.geriAlServisFirma.mockResolvedValue({ id: 'f1' })
      await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(govde) }), context)
      expect(mocks.geriAlServisFirma).toHaveBeenCalledWith('f1', 'user-1', { zincirGeriAl: false })
    },
  )
})
