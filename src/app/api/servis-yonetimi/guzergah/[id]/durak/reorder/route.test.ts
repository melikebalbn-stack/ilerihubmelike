import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  siraDegistirServisGuzergahDurak: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  siraDegistirServisGuzergahDurak: mocks.siraDegistirServisGuzergahDurak,
}))

import { POST } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 'guzergah-1' }) }

describe('POST /api/servis-yonetimi/guzergah/[id]/durak/reorder', () => {
  it('servis.tanim.manage izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakId: 'gd1', yon: 'YUKARI' }),
    }), context)
    expect(res.status).toBe(403)
    expect(mocks.siraDegistirServisGuzergahDurak).not.toHaveBeenCalled()
  })

  it('geçersiz yön değeriyle 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakId: 'gd1', yon: 'YANA' }),
    }), context)
    expect(res.status).toBe(400)
    expect(mocks.siraDegistirServisGuzergahDurak).not.toHaveBeenCalled()
  })

  it('geçerli istekte servisi doğru parametrelerle çağırır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.siraDegistirServisGuzergahDurak.mockResolvedValue([{ id: 'gd1', sira: 1 }])
    const res = await POST(new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ guzergahDurakId: 'gd1', yon: 'ASAGI' }),
    }), context)
    expect(res.status).toBe(200)
    expect(mocks.siraDegistirServisGuzergahDurak).toHaveBeenCalledWith('guzergah-1', 'gd1', 'ASAGI')
  })
})
