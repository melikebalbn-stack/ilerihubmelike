import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisSeferDilimi: vi.fn(),
  updateServisSeferDilimi: vi.fn(),
  pasiflestirServisSeferDilimi: vi.fn(),
  geriAlServisSeferDilimi: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisSeferDilimi: mocks.createServisSeferDilimi,
  updateServisSeferDilimi: mocks.updateServisSeferDilimi,
  pasiflestirServisSeferDilimi: mocks.pasiflestirServisSeferDilimi,
  geriAlServisSeferDilimi: mocks.geriAlServisSeferDilimi,
  listServisSeferDilimleri: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { servisSeferDilimi: { findUnique: vi.fn() } } }))

import { POST as createRoute } from './route'
import { PATCH as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'sd1' }) }

describe('ServisSeferDilimi route userId → audit', () => {
  it('POST: userId createServisSeferDilimi’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisSeferDilimi.mockResolvedValue({ id: 'sd1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ kod: 'X' }) }))
    expect(mocks.createServisSeferDilimi).toHaveBeenCalledWith({ kod: 'X' }, 'user-42')
  })

  it('PATCH: userId updateServisSeferDilimi’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisSeferDilimi.mockResolvedValue({ id: 'sd1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ kod: 'X' }) }), context)
    expect(mocks.updateServisSeferDilimi).toHaveBeenCalledWith('sd1', { kod: 'X' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisSeferDilimi’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisSeferDilimi.mockResolvedValue({ id: 'sd1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisSeferDilimi).toHaveBeenCalledWith('sd1', 'user-42')
  })

  it('geri-al: userId geriAlServisSeferDilimi’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisSeferDilimi.mockResolvedValue({ id: 'sd1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisSeferDilimi).toHaveBeenCalledWith('sd1', 'user-42')
  })
})
