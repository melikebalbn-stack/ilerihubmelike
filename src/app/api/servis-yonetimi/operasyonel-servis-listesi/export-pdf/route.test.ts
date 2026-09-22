import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  operasyonelServisListesiGetir: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/operasyonel-servis-listesi', () => ({
  operasyonelServisListesiGetir: mocks.operasyonelServisListesiGetir,
}))

// Gerçek PDF üreticiyi ÇALIŞTIRIYORUZ (mock'lamıyoruz) — vi.fn(actual) ile
// SARILIYOR: hem gerçek %PDF- baytları üretilir hem de çağrı argümanları
// (özellikle geçmiş tarih notu) doğrudan denetlenebilir. Excel testindeki
// "sheet'i gerçekten oku" disiplininin PDF karşılığı.
vi.mock('@/lib/pdf/operasyonel-servis-listesi-pdf', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pdf/operasyonel-servis-listesi-pdf')>()
  return { generateOperasyonelServisListesiPdfBuffer: vi.fn(actual.generateOperasyonelServisListesiPdfBuffer) }
})

import { GET } from './route'
import { generateOperasyonelServisListesiPdfBuffer } from '@/lib/pdf/operasyonel-servis-listesi-pdf'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) }
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
  mocks.requirePermission.mockReset()
  mocks.operasyonelServisListesiGetir.mockReset()
  mocks.operasyonelServisListesiGetir.mockResolvedValue(ORNEK_SONUC)
  vi.mocked(generateOperasyonelServisListesiPdfBuffer).mockClear()
})

describe('GET .../operasyonel-servis-listesi/export-pdf — yetkilendirme', () => {
  it('servis.export ister (Excel ile aynı anahtar)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x'))
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.export')
  })

  it('servis.export izni yoksa 403 döner, PDF üretilmez', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
    expect(generateOperasyonelServisListesiPdfBuffer).not.toHaveBeenCalled()
  })
})

describe('GET .../operasyonel-servis-listesi/export-pdf — dosya üretimi', () => {
  it('yetkili kullanıcı için 200 + gerçek PDF (%PDF- magic byte) + doğru başlıklar', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="Operasyonel-Servis-Listesi-2026-09-22.pdf"',
    )

    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('geçersiz tarih 400 döner, sorgu ve PDF üretimi hiç çalışmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    const res = await GET(new NextRequest('http://localhost/x?tarih=gecersiz'))
    expect(res.status).toBe(400)
    expect(mocks.operasyonelServisListesiGetir).not.toHaveBeenCalled()
    expect(generateOperasyonelServisListesiPdfBuffer).not.toHaveBeenCalled()
  })

  it('filtreler liste/Excel uçlarıyla AYNI operasyonelServisListesiGetir() fonksiyonuna iletilir (rule 6)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x?guzergahId=g1&firmaId=f1'))
    expect(mocks.operasyonelServisListesiGetir).toHaveBeenCalledWith({ guzergahId: 'g1', firmaId: 'f1' })
  })

  it('gecmisTarihSecildi=true iken uyarı notu PDF üretim ÇAĞRISINA gerçekten geçer', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    mocks.operasyonelServisListesiGetir.mockResolvedValue({
      tarih: '2020-01-01',
      gecmisTarihSecildi: true,
      satirlar: [],
    })

    const res = await GET(new NextRequest('http://localhost/x?tarih=2020-01-01'))
    expect(res.status).toBe(200)

    expect(generateOperasyonelServisListesiPdfBuffer).toHaveBeenCalledTimes(1)
    const cagriArg = vi.mocked(generateOperasyonelServisListesiPdfBuffer).mock.calls[0][0]
    expect(cagriArg.not).toContain('01.01.2020')
    expect(cagriArg.not).toContain('itibarıyla')
  })

  it('gecmisTarihSecildi=false iken PDF üretim çağrısına not iletilmez', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    await GET(new NextRequest('http://localhost/x'))

    const cagriArg = vi.mocked(generateOperasyonelServisListesiPdfBuffer).mock.calls[0][0]
    expect(cagriArg.not).toBeUndefined()
  })
})
