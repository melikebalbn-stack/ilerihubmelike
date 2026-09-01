import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), servisKapasiteOzetiGetir: vi.fn() }))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/kapasite', () => ({ servisKapasiteOzetiGetir: mocks.servisKapasiteOzetiGetir }))

import { GET } from './route'

const context = { params: Promise.resolve({ id: 'g1' }) }
const permissionResult = (allowed: boolean) => ({
  error: allowed ? null : NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }),
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/servis-yonetimi/guzergah/[id]/kapasite', () => {
  it('servis.view izni yoksa 403 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const response = await GET(new NextRequest('http://localhost/x?dilimId=d1'), context)
    expect(response.status).toBe(403)
    expect(mocks.servisKapasiteOzetiGetir).not.toHaveBeenCalled()
  })

  it('dilimId yoksa 400 döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const response = await GET(new NextRequest('http://localhost/x'), context)
    expect(response.status).toBe(400)
  })

  it('tarih yoksa varsayılan hesap tarihi için undefined geçirir', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.servisKapasiteOzetiGetir.mockResolvedValue({ kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75 })
    const response = await GET(new NextRequest('http://localhost/x?dilimId=d1'), context)
    expect(response.status).toBe(200)
    expect(mocks.servisKapasiteOzetiGetir).toHaveBeenCalledWith('g1', 'd1', undefined)
  })

  it('geçerli tarihi UTC date olarak geçirir, geçersiz tarihi reddeder', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.servisKapasiteOzetiGetir.mockResolvedValue({ kapasite: 0, atananPersonelSayisi: 0, bosKoltuk: 0, dolulukOrani: 0 })
    await GET(new NextRequest('http://localhost/x?dilimId=d1&tarih=2026-09-01'), context)
    expect(mocks.servisKapasiteOzetiGetir).toHaveBeenCalledWith('g1', 'd1', new Date('2026-09-01T00:00:00.000Z'))

    const response = await GET(new NextRequest('http://localhost/x?dilimId=d1&tarih=2026-02-30'), context)
    expect(response.status).toBe(400)
  })
})
