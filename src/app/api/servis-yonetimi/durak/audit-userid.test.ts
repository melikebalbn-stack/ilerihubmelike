import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ServisIslemGecmisi audit'i icin route katmaninin requirePermission'dan
// aldigi userId'yi servise dogru ilettigini dogrular (Firma pilotundaki
// aynı desen — bu grupta userId hic iletilmiyordu).
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisDurak: vi.fn(),
  updateServisDurak: vi.fn(),
  pasiflestirServisDurak: vi.fn(),
  geriAlServisDurak: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisDurak: mocks.createServisDurak,
  updateServisDurak: mocks.updateServisDurak,
  pasiflestirServisDurak: mocks.pasiflestirServisDurak,
  geriAlServisDurak: mocks.geriAlServisDurak,
  listServisDuraklar: vi.fn(),
}))

import { POST as createRoute } from './route'
import { PATCH as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'd1' }) }

describe('ServisDurak route userId → audit', () => {
  it('POST: userId createServisDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisDurak.mockResolvedValue({ id: 'd1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ kod: 'X', ad: 'Y' }) }))
    expect(mocks.createServisDurak).toHaveBeenCalledWith({ kod: 'X', ad: 'Y' }, 'user-42')
  })

  it('PATCH: userId updateServisDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisDurak.mockResolvedValue({ id: 'd1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ kod: 'X', ad: 'Y' }) }), context)
    expect(mocks.updateServisDurak).toHaveBeenCalledWith('d1', { kod: 'X', ad: 'Y' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisDurak.mockResolvedValue({ id: 'd1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisDurak).toHaveBeenCalledWith('d1', 'user-42')
  })

  it('geri-al: userId geriAlServisDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisDurak.mockResolvedValue({ id: 'd1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisDurak).toHaveBeenCalledWith('d1', 'user-42')
  })
})
