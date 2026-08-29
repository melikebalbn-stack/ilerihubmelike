import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  pasiflestirServisFirma: vi.fn(),
  geriAlServisFirma: vi.fn(),
  pasiflestirServisYerleske: vi.fn(),
  geriAlServisYerleske: vi.fn(),
  pasiflestirServisGuzergah: vi.fn(),
  geriAlServisGuzergah: vi.fn(),
  pasiflestirServisDurak: vi.fn(),
  geriAlServisDurak: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: mocks.requirePermission,
}))

vi.mock('@/lib/servis-yonetimi/service', () => ({
  pasiflestirServisFirma: mocks.pasiflestirServisFirma,
  geriAlServisFirma: mocks.geriAlServisFirma,
  pasiflestirServisYerleske: mocks.pasiflestirServisYerleske,
  geriAlServisYerleske: mocks.geriAlServisYerleske,
  pasiflestirServisGuzergah: mocks.pasiflestirServisGuzergah,
  geriAlServisGuzergah: mocks.geriAlServisGuzergah,
  pasiflestirServisDurak: mocks.pasiflestirServisDurak,
  geriAlServisDurak: mocks.geriAlServisDurak,
}))

import { POST as firmaPasiflestir } from './firma/[id]/pasiflestir/route'
import { POST as firmaGeriAl } from './firma/[id]/geri-al/route'
import { POST as yerleskePasiflestir } from './yerleske/[id]/pasiflestir/route'
import { POST as yerleskeGeriAl } from './yerleske/[id]/geri-al/route'
import { POST as guzergahPasiflestir } from './guzergah/[id]/pasiflestir/route'
import { POST as guzergahGeriAl } from './guzergah/[id]/geri-al/route'
import { POST as durakPasiflestir } from './durak/[id]/pasiflestir/route'
import { POST as durakGeriAl } from './durak/[id]/geri-al/route'

type PostHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>

const request = new Request('http://localhost/api/servis-yonetimi/test', { method: 'POST' })
const context = { params: Promise.resolve({ id: 'test-id' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requirePermission.mockResolvedValue({ error: null })
  for (const mock of Object.values(mocks).slice(1)) mock.mockResolvedValue({ id: 'test-id' })
})

describe('Servis tanım pasifleştirme/geri-al permission anahtarları', () => {
  it.each([
    ['firma', firmaPasiflestir],
    ['yerleşke', yerleskePasiflestir],
    ['güzergâh', guzergahPasiflestir],
    ['durak', durakPasiflestir],
  ] as [string, PostHandler][])('%s pasifleştirme servis.passive ister', async (_entity, handler) => {
    await handler(request, context)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
  })

  it.each([
    ['firma', firmaGeriAl],
    ['yerleşke', yerleskeGeriAl],
    ['güzergâh', guzergahGeriAl],
    ['durak', durakGeriAl],
  ] as [string, PostHandler][])('%s geri-al servis.restore ister', async (_entity, handler) => {
    await handler(request, context)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.restore')
  })
})
