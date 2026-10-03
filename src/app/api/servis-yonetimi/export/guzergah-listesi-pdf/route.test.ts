import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  logAuditEvent: vi.fn(async (_p: unknown) => ({ ok: true })),
  toplu: vi.fn(),
  guzergahFindMany: vi.fn(),
}))
vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
vi.mock('@/lib/prisma', () => ({ prisma: { servisGuzergah: { findMany: mocks.guzergahFindMany } } }))
vi.mock('@/lib/servis-yonetimi/kapasite', async (orijinal) => ({
  ...(await orijinal<typeof import('@/lib/servis-yonetimi/kapasite')>()),
  servisKapasiteTopluGetir: mocks.toplu,
}))

import { GET } from './route'

const izin = (ok: boolean, status = 403) =>
  ok
    ? { error: null, userId: 'u1' }
    : { error: NextResponse.json({ error: 'Yetersiz yetki' }, { status }), userId: null }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.logAuditEvent.mockResolvedValue({ ok: true })
  mocks.guzergahFindMany.mockResolvedValue([
    { id: 'g1', kod: 'G1', ad: 'İstanbul', bolge: null, aktif: true, yerleske: { kod: 'M', ad: 'Merkez' }, _count: { duraklar: 3 } },
    { id: 'g2', kod: 'G2', ad: 'Eski', bolge: null, aktif: false, yerleske: { kod: 'M', ad: 'Merkez' }, _count: { duraklar: 0 } },
  ])
  mocks.toplu.mockResolvedValue({
    tarih: '2026-10-03',
    guzergahlar: [{
      guzergahId: 'g1', kod: 'G1', ad: 'İstanbul', araclar: ['34 ABC 123'],
      ozet: { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 },
    }],
  })
})

describe('GET /api/servis-yonetimi/export/guzergah-listesi-pdf', () => {
  it('oturum yok → 401', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(false, 401))
    expect((await GET()).status).toBe(401)
    expect(mocks.guzergahFindMany).not.toHaveBeenCalled()
  })

  it('🔴 servis.view VE servis.export aranır; eksikse 403, veri okunmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(false))
    expect((await GET()).status).toBe(403)
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.export'])
    expect(mocks.guzergahFindMany).not.toHaveBeenCalled()
    expect(mocks.logAuditEvent).not.toHaveBeenCalled()
  })

  it('yetkili → gerçek PDF, ASCII dosya adı, aktif+pasif tüm güzergâhlar, denetim yazılır', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(true))
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Guzergah-Listesi-2026-10-03.pdf"')
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(mocks.logAuditEvent.mock.calls[0][0]).toMatchObject({
      action: 'SERVIS_EXPORT', actorId: 'u1', targetType: 'SERVIS',
      details: { rapor: 'GUZERGAH_LISTESI_PDF', format: 'PDF', satirSayisi: 2 },
    })
  })

  it('🔴 denetim yazılamazsa dosya verilmez (500)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(true))
    mocks.logAuditEvent.mockResolvedValue({ ok: false })
    const res = await GET()
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Disposition')).toBeNull()
  })
})
