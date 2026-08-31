import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ServisGuzergahDurak (+ Saat) route katmanının userId'yi servise doğru
// ilettiğini doğrular — bu route'lar 3 farklı klasöre dağılmış durumda
// (guzergah/[id]/durak, guzergah-durak/[id]/*, guzergah-durak-saat/[id]).
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisGuzergahDurak: vi.fn(),
  pasiflestirServisGuzergahDurak: vi.fn(),
  geriAlServisGuzergahDurak: vi.fn(),
  guzergahDurakSaatiKaydet: vi.fn(),
  guzergahDurakSaatiSil: vi.fn(),
  geriAlGuzergahDurakSaat: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisGuzergahDurak: mocks.createServisGuzergahDurak,
  pasiflestirServisGuzergahDurak: mocks.pasiflestirServisGuzergahDurak,
  geriAlServisGuzergahDurak: mocks.geriAlServisGuzergahDurak,
  guzergahDurakSaatiKaydet: mocks.guzergahDurakSaatiKaydet,
  guzergahDurakSaatiSil: mocks.guzergahDurakSaatiSil,
  geriAlGuzergahDurakSaat: mocks.geriAlGuzergahDurakSaat,
  listServisGuzergahDuraklar: vi.fn(),
}))

import { POST as createRoute } from '../guzergah/[id]/durak/route'
import { POST as pasiflestirRoute } from './[id]/pasiflestir/route'
import { POST as geriAlRoute } from './[id]/geri-al/route'
import { POST as saatKaydetRoute } from './[id]/saat/route'
import { POST as saatPasiflestirRoute } from '../guzergah-durak-saat/[id]/pasiflestir/route'
import { POST as saatGeriAlRoute } from '../guzergah-durak-saat/[id]/geri-al/route'

function permissionResult(userId = 'user-42') {
  return { error: null, userId }
}

beforeEach(() => vi.clearAllMocks())

describe('ServisGuzergahDurak (+ Saat) route userId → audit', () => {
  it('POST /guzergah/[id]/durak: userId createServisGuzergahDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.createServisGuzergahDurak.mockResolvedValue({ id: 'gd1' })
    await createRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ durakId: 'durak-1' }) }), { params: Promise.resolve({ id: 'guzergah-1' }) })
    expect(mocks.createServisGuzergahDurak).toHaveBeenCalledWith('guzergah-1', { durakId: 'durak-1' }, 'user-42')
  })

  it('pasiflestir: userId pasiflestirServisGuzergahDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.pasiflestirServisGuzergahDurak.mockResolvedValue({ id: 'gd1', aktif: false })
    await pasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'gd1' }) })
    expect(mocks.pasiflestirServisGuzergahDurak).toHaveBeenCalledWith('gd1', 'user-42')
  })

  it('geri-al: userId geriAlServisGuzergahDurak’a iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlServisGuzergahDurak.mockResolvedValue({ id: 'gd1', aktif: true })
    await geriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'gd1' }) })
    expect(mocks.geriAlServisGuzergahDurak).toHaveBeenCalledWith('gd1', 'user-42')
  })

  it('saat kaydet: userId guzergahDurakSaatiKaydet’e iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.guzergahDurakSaatiKaydet.mockResolvedValue({ id: 's1' })
    await saatKaydetRoute(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ dilimId: 'dilim-1', saat: '08:30' }) }), { params: Promise.resolve({ id: 'gd1' }) })
    expect(mocks.guzergahDurakSaatiKaydet).toHaveBeenCalledWith('gd1', { dilimId: 'dilim-1', saat: '08:30' }, 'user-42')
  })

  it('saat pasiflestir: userId guzergahDurakSaatiSil’e iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.guzergahDurakSaatiSil.mockResolvedValue({ id: 's1', aktif: false })
    await saatPasiflestirRoute(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) })
    expect(mocks.guzergahDurakSaatiSil).toHaveBeenCalledWith('s1', 'user-42')
  })

  it('saat geri-al: userId geriAlGuzergahDurakSaat’e iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult())
    mocks.geriAlGuzergahDurakSaat.mockResolvedValue({ id: 's1', aktif: true })
    await saatGeriAlRoute(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) })
    expect(mocks.geriAlGuzergahDurakSaat).toHaveBeenCalledWith('s1', 'user-42')
  })
})
