import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guncelleServisPersonelAtama: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  guncelleServisPersonelAtama: mocks.guncelleServisPersonelAtama,
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

const context = { params: Promise.resolve({ id: 'pa1' }) }

describe('PATCH /api/servis-yonetimi/guzergah-personel-atama/[id]', () => {
  it('servis.edit izni ister (servis.create DEĞİL — ayrı anahtar)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ bitisTarihi: '2026-02-01' }) }), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.edit')
    expect(mocks.guncelleServisPersonelAtama).not.toHaveBeenCalled()
  })

  it('servis.edit izni olan kullanıcı güncelleyebilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true, 'user-42'))
    mocks.guncelleServisPersonelAtama.mockResolvedValue({ id: 'pa1' })
    const res = await PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ bitisTarihi: '2026-02-01' }) }), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.guncelleServisPersonelAtama).toHaveBeenCalledWith('pa1', { bitisTarihi: '2026-02-01' }, 'user-42')
  })
})
