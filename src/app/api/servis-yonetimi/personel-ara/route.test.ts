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

describe('Servis personel arama route', () => {
  it('servis.tanim.manage ister ve reddedilirse prisma çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara'))
    expect(response.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.tanim.manage')
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })

  it('arama terimiyle yalnız aktif personeli sicilNo/adSoyad üzerinden arar', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue([{ id: 'p1', sicilNo: '123', adSoyad: 'Ali Veli', bolum: 'IT' }])

    const response = await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara?search=ali'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(mocks.personnelFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        aktif: true,
        OR: [
          { adSoyad: { contains: 'ali', mode: 'insensitive' } },
          { sicilNo: { contains: 'ali', mode: 'insensitive' } },
        ],
      }),
    }))
  })

  it('arama terimi yokken yalnız aktif filtresiyle listeler', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.personnelFindMany.mockResolvedValue([])

    await GET(new NextRequest('http://localhost/api/servis-yonetimi/personel-ara'))

    expect(mocks.personnelFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { aktif: true },
    }))
  })
})
