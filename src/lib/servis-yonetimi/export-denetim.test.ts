import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  logAuditEvent: vi.fn(),
}))
vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))

import {
  AUDIT_ACTION_EXPORT,
  SERVIS_EXPORT_YETKILERI,
  exportDenetimiHatasi,
  exportDenetimiYaz,
  exportYetkisiIste,
} from './export-denetim'

beforeEach(() => vi.resetAllMocks())

describe('export-denetim', () => {
  it('yetki: servis.view VE servis.export (AND — requireAllPermissions)', async () => {
    mocks.requireAllPermissions.mockResolvedValue({ error: null, userId: 'u1' })
    await exportYetkisiIste()
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.export'])
    expect(SERVIS_EXPORT_YETKILERI).toEqual(['servis.view', 'servis.export'])
  })

  it('denetim: SERVIS hedef tipi, rapor adı, format, satır sayısı, filtre', async () => {
    mocks.logAuditEvent.mockResolvedValue({ ok: true })
    const ok = await exportDenetimiYaz('u1', { rapor: 'KAPASITE_EXCEL', format: 'XLSX', satirSayisi: 7, filtre: { tarih: '2026-10-03' } })
    expect(ok).toBe(true)
    expect(mocks.logAuditEvent).toHaveBeenCalledWith({
      action: AUDIT_ACTION_EXPORT,
      actorId: 'u1',
      targetType: 'SERVIS',
      targetId: 'KAPASITE_EXCEL',
      details: { rapor: 'KAPASITE_EXCEL', format: 'XLSX', satirSayisi: 7, filtre: { tarih: '2026-10-03' } },
    })
  })

  it('hedefId verilirse targetId o olur', async () => {
    mocks.logAuditEvent.mockResolvedValue({ ok: true })
    await exportDenetimiYaz('u1', { rapor: 'GUZERGAH_DETAY_PDF', format: 'PDF', satirSayisi: 1, hedefId: 'g1' })
    expect(mocks.logAuditEvent.mock.calls[0][0].targetId).toBe('g1')
  })

  it('🔴 audit {ok:false} → false (çağıran dosya vermemeli)', async () => {
    mocks.logAuditEvent.mockResolvedValue({ ok: false, hata: 'x' })
    expect(await exportDenetimiYaz('u1', { rapor: 'R', format: 'PDF', satirSayisi: 0 })).toBe(false)
  })

  it('hata yanıtı 500 ve Türkçe mesaj', async () => {
    const res = exportDenetimiHatasi()
    expect(res.status).toBe(500)
    expect((await res.json()).message).toContain('denetim kaydı')
  })
})
