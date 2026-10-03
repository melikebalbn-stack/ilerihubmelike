import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  logAuditEvent: vi.fn(async (_p: unknown) => ({ ok: true })),
  toplu: vi.fn(),
}))
vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
vi.mock('@/lib/servis-yonetimi/kapasite', async (orijinal) => ({
  ...(await orijinal<typeof import('@/lib/servis-yonetimi/kapasite')>()),
  servisKapasiteTopluGetir: mocks.toplu,
}))

import { GET } from './route'

const izin = (ok: boolean, status = 403) =>
  ok
    ? { error: null, userId: 'u1' }
    : { error: NextResponse.json({ error: 'Yetersiz yetki' }, { status }), userId: null }
const istek = (q = '') => new NextRequest(`http://localhost/api/servis-yonetimi/export/kapasite${q}`)
const TOPLU = {
  tarih: '2026-03-05', guzergahlar: [], dilimSatirlari: [], asimlar: [],
  toplam: { guzergahSayisi: 0, atanmisPersonel: 0, toplamKoltuk: 0, netBosKoltuk: 0, asimSayisi: 0, asimKisi: 0, aracsizGuzergahSayisi: 0, dolmakUzereSayisi: 0 },
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.logAuditEvent.mockResolvedValue({ ok: true })
  mocks.toplu.mockResolvedValue(TOPLU)
})

describe('GET /api/servis-yonetimi/export/kapasite', () => {
  it('oturum yok → 401; veri okunmaz, denetim yazılmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(false, 401))
    expect((await GET(istek())).status).toBe(401)
    expect(mocks.toplu).not.toHaveBeenCalled()
    expect(mocks.logAuditEvent).not.toHaveBeenCalled()
  })

  it('🔴 servis.view VE servis.export aranır; eksikse 403', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(false))
    expect((await GET(istek())).status).toBe(403)
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.export'])
    expect(mocks.toplu).not.toHaveBeenCalled()
  })

  it('yetkili → xlsx, ASCII dosya adı, denetim yazılır', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(true))
    const res = await GET(istek('?tarih=2026-03-05'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Kapasite-Raporu-2026-03-05.xlsx"')
    const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
    expect(wb.SheetNames).toContain('Güzergâh Kapasitesi')
    expect(mocks.logAuditEvent.mock.calls[0][0]).toMatchObject({
      action: 'SERVIS_EXPORT', actorId: 'u1', targetType: 'SERVIS',
      details: { rapor: 'KAPASITE_EXCEL', format: 'XLSX', satirSayisi: 0, filtre: { tarih: '2026-03-05' } },
    })
  })

  it('🔴 denetim yazılamazsa dosya verilmez (500)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(true))
    mocks.logAuditEvent.mockResolvedValue({ ok: false })
    const res = await GET(istek())
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Disposition')).toBeNull()
  })

  it('geçersiz tarih → 400, motor ve denetim çalışmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izin(true))
    expect((await GET(istek('?tarih=2026-13-01'))).status).toBe(400)
    expect(mocks.toplu).not.toHaveBeenCalled()
    expect(mocks.logAuditEvent).not.toHaveBeenCalled()
  })
})
