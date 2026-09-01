import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  alternatifServisOnerileriGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/alternatif-servis', () => ({
  alternatifServisOnerileriGetir: mocks.alternatifServisOnerileriGetir,
}))

import { GET } from './route'

function permissionResult(allowed: boolean, userId = 'user-1') {
  return allowed
    ? { error: null, userId }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const context = { params: Promise.resolve({ id: 'pa1' }) }

describe('GET /api/servis-yonetimi/guzergah-personel-atama/[id]/alternatif-oneriler', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(403)
    expect(mocks.alternatifServisOnerileriGetir).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı öneri listesini görür', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.alternatifServisOnerileriGetir.mockResolvedValue([{ guzergahId: 'g2', kategori: 'ORTAK_DURAK_BOS_KOLTUK' }])
    const res = await GET(new NextRequest('http://localhost/x'), context)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.toplam).toBe(1)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
    expect(mocks.alternatifServisOnerileriGetir).toHaveBeenCalledWith('pa1')
  })

  it('servis fonksiyonu hata fırlatırsa 400 + mesaj döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.alternatifServisOnerileriGetir.mockRejectedValue(new Error('Personel ataması bulunamadı.'))
    const res = await GET(new NextRequest('http://localhost/x'), context)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.message).toBe('Personel ataması bulunamadı.')
  })
})
