import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  logAuditEvent: vi.fn(async (_p: unknown) => ({ ok: true })),
  atamaFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
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
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(false))
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mocks.atamaFindMany).not.toHaveBeenCalled()
  })

  it('servis.export izni olan kullanıcı xlsx dosyası alır (doğru header\'lar)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
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
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    await GET()
    const callArgs = mocks.atamaFindMany.mock.calls[0][0]
    expect(callArgs.select.personnel).toEqual({ select: { adSoyad: true, sicilNo: true } })
  })

  it('tüm atamaları (aktif önce, sonra pasif; aktif+pasif TÜMÜ) sorgular, filtresiz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    await GET()
    const callArgs = mocks.atamaFindMany.mock.calls[0][0]
    expect(callArgs.where).toBeUndefined()
    expect(callArgs.orderBy).toEqual([{ aktif: 'desc' }, { baslangicTarihi: 'desc' }])
  })
})

describe('GET /api/servis-yonetimi/export/personel-atama-listesi — denetim (fail-closed)', () => {
  it('başarılı indirmede SERVIS_EXPORT denetimi yazılır (rapor=PERSONEL_ATAMA_LISTESI_EXCEL)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1)
    const arg = mocks.logAuditEvent.mock.calls[0][0] as { action: string; actorId: string; targetType: string; details: Record<string, unknown> }
    expect(arg).toMatchObject({ action: 'SERVIS_EXPORT', actorId: 'user-1', targetType: 'SERVIS' })
    expect(arg.details).toMatchObject({ rapor: 'PERSONEL_ATAMA_LISTESI_EXCEL', format: 'XLSX' })
    // KVKK: denetim içinde kişi adı/sicil/telefon yok
    expect(JSON.stringify(arg.details)).not.toMatch(/Ahmet|Yılmaz|5551112233/)
  })

  it('🔴 denetim yazılamazsa dosya VERİLMEZ (500, Content-Disposition yok)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.atamaFindMany.mockResolvedValue([])
    mocks.logAuditEvent.mockResolvedValueOnce({ ok: false })
    const res = await GET()
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Disposition')).toBeNull()
  })

  it('yetki reddinde denetim yazılmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(false))
    await GET()
    expect(mocks.logAuditEvent).not.toHaveBeenCalled()
  })
})
