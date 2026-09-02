import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  guzergahFindUnique: vi.fn(),
  guzergahDurakFindMany: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisGuzergah: { findUnique: mocks.guzergahFindUnique },
    servisGuzergahDurak: { findMany: mocks.guzergahDurakFindMany },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany },
  },
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return allowed
    ? { error: null, userId: 'user-1' }
    : { error: NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 }), userId: null }
}

const context = { params: Promise.resolve({ id: 'g1' }) }

const gecerliGuzergah = {
  id: 'g1', kod: 'G1', ad: 'Güzergah 1', bolge: 'Gebze', aktif: true,
  gecerlilikBaslangici: new Date('2026-01-01'), gecerlilikBitisi: null,
  yerleske: { kod: 'MERKEZ', ad: 'Merkez Yerleşke' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guzergahDurakFindMany.mockResolvedValue([])
  mocks.aracVarsayilanFindMany.mockResolvedValue([])
  mocks.soforVarsayilanFindMany.mockResolvedValue([])
})

describe('GET /api/servis-yonetimi/export/guzergah-detay/[id]', () => {
  it('servis.export izni olmayan kullanıcı 403 alır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new Request('http://localhost/x'), context)
    expect(res.status).toBe(403)
    expect(mocks.guzergahFindUnique).not.toHaveBeenCalled()
  })

  it('güzergah bulunamazsa 404 + mesaj döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindUnique.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/x'), context)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.ok).toBe(false)
  })

  it('servis.export izni olan kullanıcı geçerli bir PDF alır (doğru header\'lar, %PDF magic byte)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindUnique.mockResolvedValue(gecerliGuzergah)

    const res = await GET(new Request('http://localhost/x'), context)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Guzergah-Detay-G1.pdf"')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('yalnız AKTİF durak/saat/araç/şoför atamalarını sorgular (aktif:true filtresi)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindUnique.mockResolvedValue(gecerliGuzergah)

    await GET(new Request('http://localhost/x'), context)

    expect(mocks.guzergahDurakFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guzergahId: 'g1', aktif: true } }),
    )
    expect(mocks.aracVarsayilanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guzergahId: 'g1', aktif: true } }),
    )
    expect(mocks.soforVarsayilanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guzergahId: 'g1', aktif: true } }),
    )
  })

  it('dosya adındaki güvensiz karakterleri temizler', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.guzergahFindUnique.mockResolvedValue({ ...gecerliGuzergah, kod: 'G/1:X' })

    const res = await GET(new Request('http://localhost/x'), context)

    expect(res.headers.get('Content-Disposition')).not.toContain('/')
    expect(res.headers.get('Content-Disposition')).not.toContain(':')
  })
})
