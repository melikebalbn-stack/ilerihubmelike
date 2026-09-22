import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  operasyonelServisListesiGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/operasyonel-servis-listesi', () => ({
  operasyonelServisListesiGetir: mocks.operasyonelServisListesiGetir,
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) }
}

const BOS_SONUC = { tarih: '2026-09-22', gecmisTarihSecildi: false, satirlar: [] }

beforeEach(() => {
  mocks.requirePermission.mockReset()
  mocks.operasyonelServisListesiGetir.mockReset()
  mocks.operasyonelServisListesiGetir.mockResolvedValue(BOS_SONUC)
})

describe('GET /api/servis-yonetimi/operasyonel-servis-listesi — yetkilendirme', () => {
  it('servis.view ister', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x'))
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
  })

  it('servis.view izni yoksa 403 döner, sorgu hiç çalışmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
  })
})

describe('GET /api/servis-yonetimi/operasyonel-servis-listesi — filtreler', () => {
  it('yetkili kullanıcı için 200 + veri döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.gecmisTarihSecildi).toBe(false)
  })

  it('geçersiz tarih 400 döner, sorgu hiç çalışmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?tarih=boyle-bir-tarih-yok'))
    expect(res.status).toBe(400)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
  })

  it('query parametreleri servis fonksiyonuna doğru filtre nesnesiyle iletilir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    await GET(
      new NextRequest(
        'http://localhost/x?tarih=2026-06-01&guzergahId=g1&firmaId=f1&durakId=d1&bolum=Uretim&yerleskeId=y1',
      ),
    )
    expect(mocks.operasyonelServisListesiGetir).toHaveBeenCalledWith({
      tarih: '2026-06-01',
      guzergahId: 'g1',
      firmaId: 'f1',
      durakId: 'd1',
      bolum: 'Uretim',
      yerleskeId: 'y1',
    })
  })

  it('uygulanan filtreler yanıtta yankılanır (UI ne süzüldüğünü görebilsin)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?guzergahId=g1'))
    const json = await res.json()
    expect(json.data.filtreler).toEqual({ guzergahId: 'g1' })
  })

  it('gecmisTarihSecildi bayrağı JSON yanıtında doğru şekilde geçer', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.operasyonelServisListesiGetir.mockResolvedValue({
      tarih: '2020-01-01',
      gecmisTarihSecildi: true,
      satirlar: [],
    })
    const res = await GET(new NextRequest('http://localhost/x?tarih=2020-01-01'))
    const json = await res.json()
    expect(json.data.gecmisTarihSecildi).toBe(true)
  })
})
