import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guncelleServisPersonelDurum: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  guncelleServisPersonelDurum: mocks.guncelleServisPersonelDurum,
}))

import { PATCH } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 'pd1' }) }

describe('PATCH /api/servis-yonetimi/personel-durum/[id]', () => {
  it('servis.edit izni ister (servis.create DEĞİL — ayrı anahtar)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ neden: 'x' }) }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.edit')
    expect(mocks.guncelleServisPersonelDurum).not.toHaveBeenCalled()
  })

  it('servis.edit izni olan kullanıcı güncelleyebilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.guncelleServisPersonelDurum.mockResolvedValue({ id: 'pd1' })
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ neden: 'düzeltme' }) }), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.guncelleServisPersonelDurum).toHaveBeenCalledWith('pd1', { neden: 'düzeltme' }, 'user-42')
  })
})
