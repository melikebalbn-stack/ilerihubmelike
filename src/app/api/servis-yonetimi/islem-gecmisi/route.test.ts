import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  islemGecmisiFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
  prisma: { servisIslemGecmisi: { findMany: mocks.islemGecmisiFindMany } },
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) }
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/servis-yonetimi/islem-gecmisi', () => {
  it('servis.history izni ister', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x?hedefTipi=FIRMA&hedefId=f1'))
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.history')
    expect(mocks.islemGecmisiFindMany).not.toHaveBeenCalled()
  })

  it('geçersiz hedefTipi ile 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?hedefTipi=BASKA_SEY&hedefId=f1'))
    expect(res.status).toBe(400)
    expect(mocks.islemGecmisiFindMany).not.toHaveBeenCalled()
  })

  it('hedefTipi eksikse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?hedefId=f1'))
    expect(res.status).toBe(400)
  })

  it('hedefId eksikse 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?hedefTipi=FIRMA'))
    expect(res.status).toBe(400)
  })

  it('geçerli tek hedefTipi ile listeler', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.islemGecmisiFindMany.mockResolvedValue([{ id: '1', islem: 'OLUSTURMA' }])
    const res = await GET(new NextRequest('http://localhost/x?hedefTipi=FIRMA&hedefId=f1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(mocks.islemGecmisiFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { hedefTipi: { in: ['FIRMA'] }, hedefId: 'f1' },
      orderBy: { tarih: 'desc' },
    }))
  })

  it('virgülle ayrılmış birden fazla hedefTipi kabul eder (ör. PERSONEL_ATAMA + PERSONEL_ATAMA_DILIM)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.islemGecmisiFindMany.mockResolvedValue([])
    await GET(new NextRequest('http://localhost/x?hedefTipi=PERSONEL_ATAMA,PERSONEL_ATAMA_DILIM&hedefId=pa1'))
    expect(mocks.islemGecmisiFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { hedefTipi: { in: ['PERSONEL_ATAMA', 'PERSONEL_ATAMA_DILIM'] }, hedefId: 'pa1' },
    }))
  })
})
