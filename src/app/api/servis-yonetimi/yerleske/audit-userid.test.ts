import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ServisIslemGecmisi audit'i icin route katmaninin requirePermission'dan
// aldigi userId'yi servise dogru ilettigini dogrular (Firma pilotundaki
// aynı desen — bu grupta userId hic iletilmiyordu).
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisYerleske: vi.fn(),
  updateServisYerleske: vi.fn(),
  pasiflestirServisYerleske: vi.fn(),
  geriAlServisYerleske: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisYerleske: mocks.createServisYerleske,
  updateServisYerleske: mocks.updateServisYerleske,
  pasiflestirServisYerleske: mocks.pasiflestirServisYerleske,
  geriAlServisYerleske: mocks.geriAlServisYerleske,
  listServisYerleskeler: vi.fn(),
}))

import { POST as createRoute } from './route'
import { PATCH as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'y1' }) }

describe('ServisYerleske route userId → audit', () => {
  it('POST: userId createServisYerleske’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisYerleske.mockResolvedValue({ id: 'y1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ kod: 'X', ad: 'Y' }) }))
    expect(mocks.createServisYerleske).toHaveBeenCalledWith({ kod: 'X', ad: 'Y' }, 'user-42')
  })

  it('PATCH: userId updateServisYerleske’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisYerleske.mockResolvedValue({ id: 'y1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ kod: 'X', ad: 'Y' }) }), context)
    expect(mocks.updateServisYerleske).toHaveBeenCalledWith('y1', { kod: 'X', ad: 'Y' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisYerleske’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisYerleske.mockResolvedValue({ id: 'y1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisYerleske).toHaveBeenCalledWith('y1', 'user-42')
  })

  it('geri-al: userId geriAlServisYerleske’ye iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisYerleske.mockResolvedValue({ id: 'y1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisYerleske).toHaveBeenCalledWith('y1', 'user-42')
  })
})
