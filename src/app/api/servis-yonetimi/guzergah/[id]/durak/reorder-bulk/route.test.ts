import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  yenidenSiralaServisGuzergahDuraklar: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  yenidenSiralaServisGuzergahDuraklar: mocks.yenidenSiralaServisGuzergahDuraklar,
}))

import { POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 'guzergah-1' }) }

describe('POST /api/servis-yonetimi/guzergah/[id]/durak/reorder-bulk', () => {
  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakIdleri: ['a', 'b'] }),
    }), context)
    expect(res.status).toBe(403)
    expect(mocks.yenidenSiralaServisGuzergahDuraklar).not.toHaveBeenCalled()
  })

  it('dizi olmayan gövdeyle 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakIdleri: 'a' }),
    }), context)
    expect(res.status).toBe(400)
    expect(mocks.yenidenSiralaServisGuzergahDuraklar).not.toHaveBeenCalled()
  })

  it('geçerli istekte servisi sıralı id listesiyle çağırır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.yenidenSiralaServisGuzergahDuraklar.mockResolvedValue([{ id: 'b', sira: 1 }, { id: 'a', sira: 2 }])
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakIdleri: ['b', 'a'] }),
    }), context)
    expect(res.status).toBe(200)
    expect(mocks.yenidenSiralaServisGuzergahDuraklar).toHaveBeenCalledWith('guzergah-1', ['b', 'a'])
  })
})
