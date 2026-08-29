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

import { DELETE } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 's1' }) }

describe('DELETE /api/servis-yonetimi/guzergah-durak-saat/[id]', () => {
  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), context)
    expect(res.status).toBe(403)
    expect(mocks.guzergahDurakSaatiSil).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı saati silebilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahDurakSaatiSil.mockResolvedValue({ id: 's1' })
    const res = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.guzergahDurakSaatiSil).toHaveBeenCalledWith('s1')
  })
})
