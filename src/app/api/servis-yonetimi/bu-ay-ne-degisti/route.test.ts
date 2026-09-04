import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  buAyNeDegistiGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/bu-ay-ne-degisti', () => ({ buAyNeDegistiGetir: mocks.buAyNeDegistiGetir }))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return allowed
    ? { error: null, userId: 'user-1' }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

function req(qs: string) {
  return new NextRequest(`http://localhost/api/servis-yonetimi/bu-ay-ne-degisti${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/bu-ay-ne-degisti', () => {
  it('servis.view izni olmayan kullanıcı 403 alır, servis fonksiyonu hiç çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(req('?yil=2026&ay=7'))
    expect(res.status).toBe(403)
    expect(mocks.buAyNeDegistiGetir).not.toHaveBeenCalled()
  })

  it('yil parametresi eksikse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req('?ay=7'))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(mocks.buAyNeDegistiGetir).not.toHaveBeenCalled()
  })

  it('ay parametresi eksikse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req('?yil=2026'))
    expect(res.status).toBe(400)
    expect(mocks.buAyNeDegistiGetir).not.toHaveBeenCalled()
  })

  it('her ikisi de eksikse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req(''))
    expect(res.status).toBe(400)
  })

  it('yil sayısal değilse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req('?yil=abc&ay=7'))
    expect(res.status).toBe(400)
    expect(mocks.buAyNeDegistiGetir).not.toHaveBeenCalled()
  })

  it('yil makul aralığın dışındaysa (örn. 1800) 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req('?yil=1800&ay=7'))
    expect(res.status).toBe(400)
  })

  it('ay 0 veya 13 gibi geçersiz bir değerse 400 döner ("olmayan ay")', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    expect((await GET(req('?yil=2026&ay=0'))).status).toBe(400)
    expect((await GET(req('?yil=2026&ay=13'))).status).toBe(400)
  })

  it('ay sayısal değilse (örn. "temmuz") 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(req('?yil=2026&ay=temmuz'))
    expect(res.status).toBe(400)
  })

  it('geçerli yetki + parametreyle servis fonksiyonunu doğru yil/ay ile çağırır, sonucu data altında döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const sahteSonuc = { yil: 2026, ay: 7, yeniServisKullanicilari: [] }
    mocks.buAyNeDegistiGetir.mockResolvedValue(sahteSonuc)

    const res = await GET(req('?yil=2026&ay=7'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data).toEqual(sahteSonuc)
    expect(mocks.buAyNeDegistiGetir).toHaveBeenCalledWith(2026, 7)
  })

  it('servis fonksiyonu hata fırlatırsa 500 + mesaj döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.buAyNeDegistiGetir.mockRejectedValue(new Error('beklenmedik hata'))

    const res = await GET(req('?yil=2026&ay=7'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
  })
})
