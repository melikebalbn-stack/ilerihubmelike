import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guzergahDurakSaatiSil: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  guzergahDurakSaatiSil: mocks.guzergahDurakSaatiSil,
}))

import { POST } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 's1' }) }

describe('POST /api/servis-yonetimi/guzergah-durak-saat/[id]/pasiflestir', () => {
  it('servis.passive izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
    expect(mocks.guzergahDurakSaatiSil).not.toHaveBeenCalled()
  })

  it('servis.passive izni olan kullanıcı saati pasifleştirebilir, userId iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.guzergahDurakSaatiSil.mockResolvedValue({ id: 's1', aktif: false })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.guzergahDurakSaatiSil).toHaveBeenCalledWith('s1', 'user-42')
  })
})
