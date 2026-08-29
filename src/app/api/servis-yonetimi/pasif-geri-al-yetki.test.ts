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
  pasiflestirServisArac: vi.fn(),
  geriAlServisArac: vi.fn(),
  pasiflestirServisSofor: vi.fn(),
  geriAlServisSofor: vi.fn(),
  pasiflestirServisSeferDilimi: vi.fn(),
  geriAlServisSeferDilimi: vi.fn(),
  pasiflestirServisGuzergahDurak: vi.fn(),
  geriAlServisGuzergahDurak: vi.fn(),
  pasiflestirServisGuzergahAracVarsayilan: vi.fn(),
  geriAlServisGuzergahAracVarsayilan: vi.fn(),
  pasiflestirServisGuzergahSoforVarsayilan: vi.fn(),
  geriAlServisGuzergahSoforVarsayilan: vi.fn(),
  pasiflestirServisSorumlusu: vi.fn(),
  geriAlServisSorumlusu: vi.fn(),
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
  pasiflestirServisArac: mocks.pasiflestirServisArac,
  geriAlServisArac: mocks.geriAlServisArac,
  pasiflestirServisSofor: mocks.pasiflestirServisSofor,
  geriAlServisSofor: mocks.geriAlServisSofor,
  pasiflestirServisSeferDilimi: mocks.pasiflestirServisSeferDilimi,
  geriAlServisSeferDilimi: mocks.geriAlServisSeferDilimi,
  pasiflestirServisGuzergahDurak: mocks.pasiflestirServisGuzergahDurak,
  geriAlServisGuzergahDurak: mocks.geriAlServisGuzergahDurak,
  pasiflestirServisGuzergahAracVarsayilan: mocks.pasiflestirServisGuzergahAracVarsayilan,
  geriAlServisGuzergahAracVarsayilan: mocks.geriAlServisGuzergahAracVarsayilan,
  pasiflestirServisGuzergahSoforVarsayilan: mocks.pasiflestirServisGuzergahSoforVarsayilan,
  geriAlServisGuzergahSoforVarsayilan: mocks.geriAlServisGuzergahSoforVarsayilan,
  pasiflestirServisSorumlusu: mocks.pasiflestirServisSorumlusu,
  geriAlServisSorumlusu: mocks.geriAlServisSorumlusu,
}))

import { POST as firmaPasiflestir } from './firma/[id]/pasiflestir/route'
import { POST as firmaGeriAl } from './firma/[id]/geri-al/route'
import { POST as yerleskePasiflestir } from './yerleske/[id]/pasiflestir/route'
import { POST as yerleskeGeriAl } from './yerleske/[id]/geri-al/route'
import { POST as guzergahPasiflestir } from './guzergah/[id]/pasiflestir/route'
import { POST as guzergahGeriAl } from './guzergah/[id]/geri-al/route'
import { POST as durakPasiflestir } from './durak/[id]/pasiflestir/route'
import { POST as durakGeriAl } from './durak/[id]/geri-al/route'
import { POST as aracPasiflestir } from './arac/[id]/pasiflestir/route'
import { POST as aracGeriAl } from './arac/[id]/geri-al/route'
import { POST as soforPasiflestir } from './sofor/[id]/pasiflestir/route'
import { POST as soforGeriAl } from './sofor/[id]/geri-al/route'
import { POST as seferDilimiPasiflestir } from './sefer-dilimi/[id]/pasiflestir/route'
import { POST as seferDilimiGeriAl } from './sefer-dilimi/[id]/geri-al/route'
import { POST as guzergahDurakPasiflestir } from './guzergah-durak/[id]/pasiflestir/route'
import { POST as guzergahDurakGeriAl } from './guzergah-durak/[id]/geri-al/route'
import { POST as aracVarsayilanPasiflestir } from './guzergah-arac-varsayilan/[id]/pasiflestir/route'
import { POST as aracVarsayilanGeriAl } from './guzergah-arac-varsayilan/[id]/geri-al/route'
import { POST as soforVarsayilanPasiflestir } from './guzergah-sofor-varsayilan/[id]/pasiflestir/route'
import { POST as soforVarsayilanGeriAl } from './guzergah-sofor-varsayilan/[id]/geri-al/route'
import { POST as sorumluPasiflestir } from './guzergah-sorumlu/[id]/pasiflestir/route'
import { POST as sorumluGeriAl } from './guzergah-sorumlu/[id]/geri-al/route'

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
    ['araç', aracPasiflestir],
    ['şoför', soforPasiflestir],
    ['sefer dilimi', seferDilimiPasiflestir],
    ['güzergâh-durak', guzergahDurakPasiflestir],
    ['güzergâh-araç varsayılanı', aracVarsayilanPasiflestir],
    ['güzergâh-şoför varsayılanı', soforVarsayilanPasiflestir],
    ['servis sorumlusu', sorumluPasiflestir],
  ] as [string, PostHandler][])('%s pasifleştirme servis.passive ister', async (_entity, handler) => {
    await handler(request, context)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
  })

  it.each([
    ['firma', firmaGeriAl],
    ['yerleşke', yerleskeGeriAl],
    ['güzergâh', guzergahGeriAl],
    ['durak', durakGeriAl],
    ['araç', aracGeriAl],
    ['şoför', soforGeriAl],
    ['sefer dilimi', seferDilimiGeriAl],
    ['güzergâh-durak', guzergahDurakGeriAl],
    ['güzergâh-araç varsayılanı', aracVarsayilanGeriAl],
    ['güzergâh-şoför varsayılanı', soforVarsayilanGeriAl],
    ['servis sorumlusu', sorumluGeriAl],
  ] as [string, PostHandler][])('%s geri-al servis.restore ister', async (_entity, handler) => {
    await handler(request, context)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.restore')
  })
})
