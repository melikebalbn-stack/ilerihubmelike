import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  updateServisFirma: vi.fn(),
  firmaFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({ updateServisFirma: mocks.updateServisFirma }))
vi.mock('@/lib/prisma', () => ({ prisma: { servisFirma: { findUnique: mocks.firmaFindUnique } } }))

import { PATCH } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'f1' }) }

describe('PATCH /api/servis-yonetimi/firma/[id]', () => {
  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ ad: 'Yeni' }) }), context)
    expect(res.status).toBe(403)
    expect(mocks.updateServisFirma).not.toHaveBeenCalled()
  })

  it('işlemi yapan kullanıcının id’sini updateServisFirma’ya (audit için) iletir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.updateServisFirma.mockResolvedValue({ id: 'f1', ad: 'Yeni' })
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ ad: 'Yeni' }) }), context)
    expect(res.status).toBe(200)
    expect(mocks.updateServisFirma).toHaveBeenCalledWith('f1', { ad: 'Yeni' }, 'user-42')
  })
})
