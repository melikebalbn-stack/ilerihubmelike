import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  logAuditEvent: vi.fn(async (_p: unknown) => ({ ok: true })),
  operasyonelServisListesiGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
vi.mock('@/lib/servis-yonetimi/operasyonel-servis-listesi', () => ({
  operasyonelServisListesiGetir: mocks.operasyonelServisListesiGetir,
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }), userId: allowed ? 'user-1' : null }
}

const ORNEK_SONUC = {
  tarih: '2026-09-22',
  gecmisTarihSecildi: false,
  satirlar: [
    {
      personnelId: 'p1',
      sicilNo: '111',
      adSoyad: 'Ahmet Yılmaz',
      bolum: 'Üretim',
      guzergahKod: 'G1',
      guzergahAd: 'Güzergah 1',
      durakKod: 'D1',
      durakAd: 'Durak 1',
      sabahSaati: '07:15',
      telefon: '5551112233',
    },
  ],
}

beforeEach(() => {
  mocks.requireAllPermissions.mockReset()
  mocks.logAuditEvent.mockClear()
  mocks.operasyonelServisListesiGetir.mockReset()
  mocks.operasyonelServisListesiGetir.mockResolvedValue(ORNEK_SONUC)
})

describe('GET .../operasyonel-servis-listesi/export — yetkilendirme', () => {
  it('servis.export ister (servis.view DEĞİL)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x'))
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.export'])
  })

  it('servis.export izni yoksa 403 döner, dosya üretilmez', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
  })
})

describe('GET .../operasyonel-servis-listesi/export — dosya üretimi', () => {
  it('yetkili kullanıcı için 200 + doğru içerik/dosya adı başlıkları', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="Operasyonel-Servis-Listesi-2026-09-22.xlsx"',
    )
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
  })

  it('geçersiz tarih 400 döner, sorgu hiç çalışmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?tarih=gecersiz'))
    expect(res.status).toBe(400)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
  })

  it('filtreler liste ucuyla AYNI operasyonelServisListesiGetir() fonksiyonuna iletilir (rule 6)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x?guzergahId=g1&firmaId=f1'))
    expect(mocks.operasyonelServisListesiGetir).toHaveBeenCalledWith({ guzergahId: 'g1', firmaId: 'f1' })
  })

  it('gecmisTarihSecildi=true iken üretilen Excel içeriğinde uyarı notu satırı bulunur', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.operasyonelServisListesiGetir.mockResolvedValue({
      tarih: '2020-01-01',
      gecmisTarihSecildi: true,
      satirlar: [],
    })

    const res = await GET(new NextRequest('http://localhost/x?tarih=2020-01-01'))
    expect(res.status).toBe(200)

    const XLSX = await import('xlsx')
    const buf = Buffer.from(await res.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    expect(String(rows[0][0])).toContain('01.01.2020')
    expect(String(rows[0][0])).toContain('itibarıyla')
    // Başlık satırı notun ardından (boş ayraçtan sonra) gelmeli.
    expect(rows[2][0]).toBe('SİCİL')
  })

  it('gecmisTarihSecildi=false iken Excel içinde uyarı notu OLMAZ, ilk satır doğrudan başlık', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x'))

    const XLSX = await import('xlsx')
    const buf = Buffer.from(await res.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    expect(rows[0][0]).toBe('SİCİL')
  })
})

// ----------------------------------------------------------------------------
// 🔴 KRİTİK: servis.view VAR ama servis.export YOK (idari-isler senaryosu) —
// listeyi görebilmeli, export'ta 403 almalı. Yetki matrisinden doğrulanmış
// ayrımın route katmanında da gerçekten uygulandığının kanıtı.
// ----------------------------------------------------------------------------
describe('GET .../operasyonel-servis-listesi/export — servis.view/servis.export ayrımı', () => {
  it('yalnız servis.view izni olan kullanıcı (idari-isler) export ucundan 403 alır', async () => {
    // idari-isler: servis.view VAR, servis.export YOK — requireAllPermissions bu
    // ayrımı gerçek yetki matrisinden yapıyor; burada yalnız route'un doğru
    // anahtarı (servis.export) istediğini ve reddedilince 403 döndüğünü
    // kanıtlıyoruz — mockun kendisi "servis.export" anahtarına özel deny
    // dönerek bu spesifik senaryoyu simüle ediyor.
    mocks.requireAllPermissions.mockImplementation(async (keys: string[]) =>
      keys.includes('servis.export') ? permissionResult(false) : permissionResult(true),
    )

    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
  })
})

describe('GET .../operasyonel-servis-listesi/export — denetim (fail-closed)', () => {
  it('başarılı indirmede SERVIS_EXPORT denetimi yazılır (rapor=OPERASYONEL_SERVIS_LISTESI_EXCEL)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1)
    const arg = mocks.logAuditEvent.mock.calls[0][0] as { action: string; actorId: string; targetType: string; details: Record<string, unknown> }
    expect(arg).toMatchObject({ action: 'SERVIS_EXPORT', actorId: 'user-1', targetType: 'SERVIS' })
    expect(arg.details).toMatchObject({ rapor: 'OPERASYONEL_SERVIS_LISTESI_EXCEL', format: 'XLSX' })
    // KVKK: denetim içinde kişi adı/sicil/telefon yok
    expect(JSON.stringify(arg.details)).not.toMatch(/Ahmet|Yılmaz|5551112233/)
  })

  it('🔴 denetim yazılamazsa dosya VERİLMEZ (500, Content-Disposition yok)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(true))
    mocks.logAuditEvent.mockResolvedValueOnce({ ok: false })
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Disposition')).toBeNull()
  })

  it('yetki reddinde denetim yazılmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(permissionResult(false))
    await GET(new NextRequest('http://localhost/x'))
    expect(mocks.logAuditEvent).not.toHaveBeenCalled()
  })
})
