import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  atamaFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
  prisma: { servisPersonelAtama: { findMany: mocks.atamaFindMany } },
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

describe('GET /api/servis-yonetimi/export/personel-atama-listesi', () => {
  it('servis.export izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mocks.atamaFindMany).not.toHaveBeenCalled()
  })

  it('servis.export izni olan kullanıcı xlsx dosyası alır (doğru header\'lar)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([
      {
        baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, aktif: true,
        personnel: { adSoyad: 'Ahmet Yılmaz', sicilNo: '1234' },
        guzergah: { kod: 'G1', ad: 'Güzergah 1' },
        durak: { kod: 'D1', ad: 'Durak 1' },
        dilimler: [{ dilim: { kod: 'S1', yon: 'GIDIS' } }],
      },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="Personel-Atama-Listesi-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    )
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
  })

  it('KVKK: Personnel select\'i YALNIZ adSoyad+sicilNo içerir — telefon/adres/bölüm alanı sorgulanmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    await GET()
    const callArgs = mocks.atamaFindMany.mock.calls[0][0]
    expect(callArgs.select.personnel).toEqual({ select: { adSoyad: true, sicilNo: true } })
  })

  it('tüm atamaları (aktif önce, sonra pasif; aktif+pasif TÜMÜ) sorgular, filtresiz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    await GET()
    const callArgs = mocks.atamaFindMany.mock.calls[0][0]
    expect(callArgs.where).toBeUndefined()
    expect(callArgs.orderBy).toEqual([{ aktif: 'desc' }, { baslangicTarihi: 'desc' }])
  })
})
