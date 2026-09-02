import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guzergahFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
  prisma: { servisGuzergah: { findMany: mocks.guzergahFindMany } },
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return allowed
    ? { error: null, userId: 'user-1' }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/export/guzergah-listesi', () => {
  it('servis.export izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mocks.guzergahFindMany).not.toHaveBeenCalled()
  })

  it('servis.export izni olan kullanıcı xlsx dosyası alır (doğru header\'lar)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindMany.mockResolvedValue([
      {
        kod: 'G1', ad: 'Güzergah 1', bolge: 'Gebze', aktif: true,
        gecerlilikBaslangici: new Date('2026-01-01'), gecerlilikBitisi: null,
        yerleske: { kod: 'MERKEZ', ad: 'Merkez Yerleşke' },
        _count: { duraklar: 3 },
      },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="Servis-Listesi-\d{4}-\d{2}-\d{2}\.xlsx"$/)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
  })

  it('güzergahları koda göre artan sırayla, aktif+pasif ayrımı olmadan (filtresiz) sorgular', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindMany.mockResolvedValue([])
    await GET()
    expect(mocks.guzergahFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ kod: 'asc' }],
        include: expect.objectContaining({
          yerleske: { select: { kod: true, ad: true } },
          _count: { select: { duraklar: { where: { aktif: true } } } },
        }),
      }),
    )
    const callArgs = mocks.guzergahFindMany.mock.calls[0][0]
    expect(callArgs.where).toBeUndefined()
  })
})
