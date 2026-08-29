import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  personnelFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
  prisma: { personnel: { findMany: mocks.personnelFindMany } },
}))

import { GET } from './route'

beforeEach(() => vi.clearAllMocks())

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) }
}

const ornekPersonel = [
  { id: 'p1', sicilNo: '1001', adSoyad: 'Ahmet Işık', bolum: 'Üretim' },
  { id: 'p2', sicilNo: '1002', adSoyad: 'Ali Veli', bolum: 'IT' },
  { id: 'p3', sicilNo: '1003', adSoyad: 'Zeynep Yılmaz', bolum: 'İK' },
]

describe('Servis personel arama route', () => {
  it('servis.tanim.manage veya servis.sorumlu.manage ister ve reddedilirse prisma çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara'))
    expect(response.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith(['servis.tanim.manage', 'servis.sorumlu.manage'])
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })

  it('yalnız aktif personeli çeker, arama filtresi DB yerine JS tarafında uygulanır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=ali'))

    expect(mocks.personnelFindMany).toHaveBeenCalledWith({
      where: { aktif: true },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      orderBy: { adSoyad: 'asc' },
    })
  })

  it('adSoyad üzerinde arar', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=veli'))
    const json = await response.json()

    expect(json.data.map((p: { id: string }) => p.id)).toEqual(['p2'])
  })

  it('sicilNo üzerinde arar', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=1003'))
    const json = await response.json()

    expect(json.data.map((p: { id: string }) => p.id)).toEqual(['p3'])
  })

  it('tr-TR duyarlı arar: büyük "I" ile yazılmış "Işık" küçük "ışık" aramasıyla bulunur (Postgres ILIKE bunu kaçırır)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=ışık'))
    const json = await response.json()

    expect(json.data.map((p: { id: string }) => p.id)).toEqual(['p1'])
  })

  it('tr-TR duyarlı arar: tümü büyük "YILMAZ" küçük "yılmaz" aramasıyla bulunur', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=YILMAZ'))
    const json = await response.json()

    expect(json.data.map((p: { id: string }) => p.id)).toEqual(['p3'])
  })

  it('arama terimi yokken tüm aktif personeli (ilk 50) döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue(ornekPersonel)

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara'))
    const json = await response.json()

    expect(json.data).toHaveLength(3)
  })
})
