import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ServisIslemGecmisi audit'i icin route katmaninin requirePermission'dan
// aldigi userId'yi servise dogru ilettigini dogrular (Grup 2).
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisArac: vi.fn(),
  updateServisArac: vi.fn(),
  pasiflestirServisArac: vi.fn(),
  geriAlServisArac: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisArac: mocks.createServisArac,
  updateServisArac: mocks.updateServisArac,
  pasiflestirServisArac: mocks.pasiflestirServisArac,
  geriAlServisArac: mocks.geriAlServisArac,
  listServisAraclar: vi.fn(),
}))

import { POST as createRoute } from './route'
import { PATCH as updateRoute } from './[id]/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

const context = { params: Promise.resolve({ id: 'a1' }) }

describe('ServisArac route userId → audit', () => {
  it('POST: userId createServisArac’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisArac.mockResolvedValue({ id: 'a1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ plaka: '41ABC123' }) }))
    expect(mocks.createServisArac).toHaveBeenCalledWith({ plaka: '41ABC123' }, 'user-42')
  })

  it('PATCH: userId updateServisArac’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.updateServisArac.mockResolvedValue({ id: 'a1' })
    await updateRoute(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify({ plaka: '41ABC123' }) }), context)
    expect(mocks.updateServisArac).toHaveBeenCalledWith('a1', { plaka: '41ABC123' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisArac’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisArac.mockResolvedValue({ id: 'a1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.pasiflestirServisArac).toHaveBeenCalledWith('a1', 'user-42')
  })

  it('geri-al: userId geriAlServisArac’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisArac.mockResolvedValue({ id: 'a1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), context)
    expect(mocks.geriAlServisArac).toHaveBeenCalledWith('a1', 'user-42')
  })
})
