import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guzergahDurakSaatiKaydet: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  guzergahDurakSaatiKaydet: mocks.guzergahDurakSaatiKaydet,
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

const context = { params: Promise.resolve({ id: 'gd1' }) }

describe('POST /api/servis-yonetimi/guzergah-durak/[id]/saat', () => {
  const body = { dilimId: 'dilim-1', saat: '08:30' }

  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    expect(res.status).toBe(403)
    expect(mocks.guzergahDurakSaatiKaydet).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı saat kaydedebilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahDurakSaatiKaydet.mockResolvedValue({ id: 's1', ...body })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.guzergahDurakSaatiKaydet).toHaveBeenCalledWith('gd1', body, 'user-1')
  })
})
