import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  pasiflestirServisFirma: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({ pasiflestirServisFirma: mocks.pasiflestirServisFirma }))

import { POST } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'f1' }) }

describe('POST /api/servis-yonetimi/firma/[id]/pasiflestir', () => {
  it('servis.passive izni ister', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
    expect(mocks.pasiflestirServisFirma).not.toHaveBeenCalled()
  })

  it('işlemi yapan kullanıcının id’sini pasiflestirServisFirma’ya (audit için) iletir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.pasiflestirServisFirma.mockResolvedValue({ id: 'f1', aktif: false })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(res.status).toBe(200)
    expect(mocks.pasiflestirServisFirma).toHaveBeenCalledWith('f1', 'user-42')
  })
})
