import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisSofor: vi.fn(),
  updateServisSofor: vi.fn(),
  pasiflestirServisSofor: vi.fn(),
  geriAlServisSofor: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisSofor: mocks.createServisSofor,
  updateServisSofor: mocks.updateServisSofor,
  pasiflestirServisSofor: mocks.pasiflestirServisSofor,
  geriAlServisSofor: mocks.geriAlServisSofor,
  listServisSoforler: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { servisSofor: { findUnique: vi.fn() } } }))

import { POST as createRoute } from './route'
import { PATCH as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 's1' }) }

describe('ServisSofor route userId → audit', () => {
  it('POST: userId createServisSofor’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisSofor.mockResolvedValue({ id: 's1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ adSoyad: 'Test' }) }))
    expect(mocks.createServisSofor).toHaveBeenCalledWith({ adSoyad: 'Test' }, 'user-42')
  })

  it('PATCH: userId updateServisSofor’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisSofor.mockResolvedValue({ id: 's1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ adSoyad: 'Test' }) }), context)
    expect(mocks.updateServisSofor).toHaveBeenCalledWith('s1', { adSoyad: 'Test' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisSofor’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisSofor.mockResolvedValue({ id: 's1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisSofor).toHaveBeenCalledWith('s1', 'user-42')
  })

  it('geri-al: userId geriAlServisSofor’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisSofor.mockResolvedValue({ id: 's1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisSofor).toHaveBeenCalledWith('s1', 'user-42')
  })
})
