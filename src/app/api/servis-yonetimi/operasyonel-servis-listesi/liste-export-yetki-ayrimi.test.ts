// 🔴 KRİTİK NEGATİF TEST (Ders 55) — servis.view izni OLAN ama servis.export
// izni OLMAYAN kullanıcı (idari-isler rolü tam bu durumda, bkz. yetki
// matrisi): listeyi GÖREBİLMELİ (200), export ucunda 403 ALMALI. İki route
// burada BİRLİKTE çağrılıp ayrım tek testte açıkça kanıtlanıyor.
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

import { GET as listeGET } from './route'
import { GET as exportGET } from './export/route'
import { GET as exportPdfGET } from './export-pdf/route'

beforeEach(() => {
  mocks.requirePermission.mockReset()
  mocks.operasyonelServisListesiGetir.mockReset()
  mocks.operasyonelServisListesiGetir.mockResolvedValue({ tarih: '2026-09-22', gecmisTarihSecildi: false, satirlar: [] })

  // idari-isler simülasyonu: servis.view VAR, servis.export YOK.
  mocks.requirePermission.mockImplementation(async (key: string) =>
    key === 'servis.view'
      ? { error: null }
      : { error: NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) },
  )
})

describe('servis.view var / servis.export yok — liste ile export ayrımı', () => {
  it('liste ucu 200 döner, Excel export ucu AYNI kullanıcı için 403 döner', async () => {
    const listeRes = await listeGET(new NextRequest('http://localhost/x'))
    expect(listeRes.status).toBe(200)

    const exportRes = await exportGET(new NextRequest('http://localhost/x'))
    expect(exportRes.status).toBe(403)
  })

  it('liste ucu 200 döner, PDF export ucu AYNI kullanıcı için 403 döner', async () => {
    const listeRes = await listeGET(new NextRequest('http://localhost/x'))
    expect(listeRes.status).toBe(200)

    const exportPdfRes = await exportPdfGET(new NextRequest('http://localhost/x'))
    expect(exportPdfRes.status).toBe(403)
  })
})
