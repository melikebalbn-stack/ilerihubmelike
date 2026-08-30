import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ServisIslemGecmisi audit'i icin route katmaninin requirePermission'dan
// aldigi userId'yi servise dogru ilettigini dogrular (Firma pilotundaki
// aynı desen — bu grupta userId hic iletilmiyordu).
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisGuzergah: vi.fn(),
  updateServisGuzergah: vi.fn(),
  pasiflestirServisGuzergah: vi.fn(),
  geriAlServisGuzergah: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisGuzergah: mocks.createServisGuzergah,
  updateServisGuzergah: mocks.updateServisGuzergah,
  pasiflestirServisGuzergah: mocks.pasiflestirServisGuzergah,
  geriAlServisGuzergah: mocks.geriAlServisGuzergah,
  listServisGuzergahlar: vi.fn(),
}))

import { POST as createRoute } from './route'
import { PUT as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'g1' }) }

describe('ServisGuzergah route userId → audit', () => {
  it('POST: userId createServisGuzergah’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisGuzergah.mockResolvedValue({ id: 'g1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ kod: 'X', ad: 'Y', yerleskeId: 'y1' }) }))
    expect(mocks.createServisGuzergah).toHaveBeenCalledWith({ kod: 'X', ad: 'Y', yerleskeId: 'y1' }, 'user-42')
  })

  it('PUT: userId updateServisGuzergah’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisGuzergah.mockResolvedValue({ id: 'g1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ kod: 'X', ad: 'Y', yerleskeId: 'y1' }) }), context)
    expect(mocks.updateServisGuzergah).toHaveBeenCalledWith('g1', { kod: 'X', ad: 'Y', yerleskeId: 'y1' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisGuzergah’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisGuzergah.mockResolvedValue({ id: 'g1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisGuzergah).toHaveBeenCalledWith('g1', 'user-42')
  })

  it('geri-al: userId geriAlServisGuzergah’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisGuzergah.mockResolvedValue({ id: 'g1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisGuzergah).toHaveBeenCalledWith('g1', 'user-42')
  })
})
