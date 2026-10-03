import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { BagliKayitHatasi } from '@/lib/servis-yonetimi/bagimlilik'

// A4 — pasifleştirme uçları: bağlı aktif kayıt → 409 + liste; onay bayrağı
// yalnız `{ "onay": true }`; yetki (servis.passive) ilk ifade; 401/403'te servis çağrılmaz.
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  firma: vi.fn(),
  yerleske: vi.fn(),
  guzergah: vi.fn(),
  arac: vi.fn(),
  sofor: vi.fn(),
  dilim: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  pasiflestirServisFirma: mocks.firma,
  pasiflestirServisYerleske: mocks.yerleske,
  pasiflestirServisGuzergah: mocks.guzergah,
  pasiflestirServisArac: mocks.arac,
  pasiflestirServisSofor: mocks.sofor,
  pasiflestirServisSeferDilimi: mocks.dilim,
}))

import { POST as firmaPost } from './firma/[id]/pasiflestir/route'
import { POST as yerleskePost } from './yerleske/[id]/pasiflestir/route'
import { POST as guzergahPost } from './guzergah/[id]/pasiflestir/route'
import { POST as aracPost } from './arac/[id]/pasiflestir/route'
import { POST as soforPost } from './sofor/[id]/pasiflestir/route'
import { POST as dilimPost } from './sefer-dilimi/[id]/pasiflestir/route'

const UCLAR = [
  { ad: 'firma', post: firmaPost, servis: mocks.firma },
  { ad: 'yerleşke', post: yerleskePost, servis: mocks.yerleske },
  { ad: 'güzergâh', post: guzergahPost, servis: mocks.guzergah },
  { ad: 'araç', post: aracPost, servis: mocks.arac },
  { ad: 'şoför', post: soforPost, servis: mocks.sofor },
  { ad: 'sefer dilimi', post: dilimPost, servis: mocks.dilim },
]

const BAG = [{ tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145'] }]
const context = { params: Promise.resolve({ id: 'k1' }) }
const istek = (govde?: unknown, ham?: string) =>
  new NextRequest('http://localhost/x', {
    method: 'POST',
    ...(ham !== undefined ? { body: ham } : govde !== undefined ? { body: JSON.stringify(govde) } : {}),
  })

beforeEach(() => vi.clearAllMocks())

describe.each(UCLAR)('POST pasiflestir — $ad', ({ post, servis }) => {
  it('servis.passive istenir; 403 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }), userId: null })
    const res = await post(istek(), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.passive')
    expect(servis).not.toHaveBeenCalled()
  })

  it('401 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }), userId: null })
    expect((await post(istek(), context)).status).toBe(401)
    expect(servis).not.toHaveBeenCalled()
  })

  it('gövdesiz istek (eski istemci): onay=false ile çağrılır', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockResolvedValue({ id: 'k1', aktif: false })
    const res = await post(istek(), context)
    expect(res.status).toBe(200)
    expect(servis).toHaveBeenCalledWith('k1', 'user-1', { onay: false })
  })

  it('{ onay: true } → onay=true', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockResolvedValue({ id: 'k1', aktif: false })
    await post(istek({ onay: true }), context)
    expect(servis).toHaveBeenCalledWith('k1', 'user-1', { onay: true })
  })

  it.each([['"true"', { onay: 'true' }], ['1', { onay: 1 }], ['yok', { baska: true }]])(
    '🔴 onay yalnız boolean true sayılır: %s → onay=false',
    async (_ad, govde) => {
      mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
      servis.mockResolvedValue({ id: 'k1' })
      await post(istek(govde), context)
      expect(servis).toHaveBeenCalledWith('k1', 'user-1', { onay: false })
    },
  )

  it('bozuk JSON gövde: hata vermez, onay=false', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockResolvedValue({ id: 'k1' })
    const res = await post(istek(undefined, '{bozuk'), context)
    expect(res.status).toBe(200)
    expect(servis).toHaveBeenCalledWith('k1', 'user-1', { onay: false })
  })

  it('🔴 bağlı aktif kayıt: 409 + kod + Türkçe mesaj + bağımlılık listesi', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockRejectedValue(new BagliKayitHatasi('Bağlı aktif kayıtlar var (2 aktif araç).', BAG))
    const res = await post(istek(), context)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Bağlı aktif kayıtlar var (2 aktif araç).', bagimliliklar: BAG,
    })
  })

  it('diğer servis hataları mevcut davranışla 400 + mesaj', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
    servis.mockRejectedValue(new Error('Kayıt zaten pasif.'))
    const res = await post(istek(), context)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, message: 'Kayıt zaten pasif.' })
  })
})
