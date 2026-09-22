import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAllPermissions: vi.fn(),
  acilDurumListesiGetir: vi.fn(),
  personnelAccessLogCreateMany: vi.fn(),
  logAuditEvent: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requireAllPermissions: mocks.requireAllPermissions }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }))
vi.mock('@/lib/prisma', () => ({
  prisma: { personnelAccessLog: { createMany: mocks.personnelAccessLogCreateMany } },
}))
vi.mock('@/lib/servis-yonetimi/acil-durum-listesi', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/servis-yonetimi/acil-durum-listesi')>()
  return { ...actual, acilDurumListesiGetir: mocks.acilDurumListesiGetir }
})
// PDF üreticisi MOCK'LANMIYOR — gerçek %PDF- baytları üretilsin (madde 29'daki
// desen: mock'la geçme, gerçek çıktıyı doğrula).

import { GET } from './route'
import { AcilDurumListesiError } from '@/lib/servis-yonetimi/acil-durum-listesi'

function izinSonucu(izinli: boolean) {
  return izinli
    ? { session: {}, userId: 'u1', error: null }
    : { session: null, userId: null, error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) }
}

const bosBlok = () => ({ durum: 'ATANMAMIS' as const, kayitlar: [] })

const ORNEK_SONUC = {
  tarih: '2026-09-22',
  guzergah: { id: 'g1', kod: 'G1', ad: 'Güzergah 1', yerleskeKod: 'Y1', yerleskeAd: 'Yerleşke 1' },
  dilim: { id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS' },
  seferTanimli: true,
  duraklar: {
    durum: 'VERI_VAR' as const,
    kayitlar: [{ sira: 1, durakId: 'dr1', durakKod: 'D1', durakAd: 'Durak 1', il: 'Kocaeli', ilce: 'Gebze', saat: '07:15' }],
  },
  arac: {
    ana: { durum: 'VERI_VAR' as const, kayitlar: [{ aracId: 'a1', plaka: '41 AB 1', kapasite: 27, firmaId: 'f1', firmaAd: 'Firma A' }] },
    yedek: bosBlok(),
  },
  sofor: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [{ soforId: 's1', adSoyad: 'Dahili Şoför', telefon: '5551', dahiliMi: true, personnelId: 'p-sofor' }],
    },
    yedek: bosBlok(),
  },
  sorumlu: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [{ personnelId: 'p-sorumlu', sicilNo: '999', adSoyad: 'Sorumlu', telefon: '5559' }],
    },
    yedek: bosBlok(),
  },
  firmalar: {
    durum: 'VERI_VAR' as const,
    kayitlar: [{ firmaId: 'f1', ad: 'Firma A', yetkiliAdi: 'Yetkili', telefon: '5550', eposta: 'a@x.com' }],
  },
  yolcular: {
    durum: 'VERI_VAR' as const,
    kayitlar: [
      { personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet', durakKod: 'D1', durakAd: 'Durak 1', telefon: '5552' },
    ],
  },
}

const URL_TAM = 'http://localhost/x?guzergahId=g1&dilimId=d1'

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.acilDurumListesiGetir.mockResolvedValue(ORNEK_SONUC)
  mocks.personnelAccessLogCreateMany.mockResolvedValue({ count: 3 })
  mocks.logAuditEvent.mockResolvedValue({ ok: true })
})

describe('GET .../acil-durum-listesi/export-pdf — yetkilendirme', () => {
  it('ekranla AYNI iki anahtarı birden ister (servis.export DEĞİL)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true))
    await GET(new NextRequest(URL_TAM))
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.kvkk.view'])
  })

  it('yetkisiz kullanıcı 403 alır, PDF üretilmez ve log yazılmaz', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izinSonucu(false))
    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(403)
    expect(mocks.acilDurumListesiGetir).not.toHaveBeenCalled()
    expect(mocks.personnelAccessLogCreateMany).not.toHaveBeenCalled()
  })
})

describe('GET .../acil-durum-listesi/export-pdf — dosya', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('gerçek PDF üretir (%PDF- magic byte) + doğru başlıklar', async () => {
    const res = await GET(new NextRequest(URL_TAM))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('Acil-Durum-Listesi-G1-SABAH_GIDIS-2026-09-22.pdf')

    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('parametre eksikse 400, güzergâh/dilim yoksa 404', async () => {
    const res400 = await GET(new NextRequest('http://localhost/x?guzergahId=g1'))
    expect(res400.status).toBe(400)

    mocks.acilDurumListesiGetir.mockRejectedValue(new AcilDurumListesiError('Güzergâh bulunamadı.'))
    const res404 = await GET(new NextRequest(URL_TAM))
    expect(res404.status).toBe(404)
  })

  it('ATANMAMIŞ bloklar olsa da PDF üretilir (boş veri hata değil)', async () => {
    mocks.acilDurumListesiGetir.mockResolvedValue({
      ...ORNEK_SONUC,
      arac: { ana: bosBlok(), yedek: bosBlok() },
      sofor: { ana: bosBlok(), yedek: bosBlok() },
      sorumlu: { ana: bosBlok(), yedek: bosBlok() },
      firmalar: bosBlok(),
      yolcular: bosBlok(),
      duraklar: bosBlok(),
    })

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

// ----------------------------------------------------------------------------
// 🔴 Ders 76 — "gerçekten yazıldı" testi
// ----------------------------------------------------------------------------
describe('GET .../acil-durum-listesi/export-pdf — erişim izi', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('PDF indirmede de PersonnelAccessLog yazılır — AYRI accessType (EXPORT_ACIL_DURUM)', async () => {
    await GET(new NextRequest(URL_TAM))

    expect(mocks.personnelAccessLogCreateMany).toHaveBeenCalledTimes(1)
    const data = mocks.personnelAccessLogCreateMany.mock.calls[0][0].data
    expect(data.map((d: { personnelId: string }) => d.personnelId).sort()).toEqual(
      ['p-sofor', 'p-sorumlu', 'p1'].sort(),
    )
    for (const satir of data) {
      expect(satir.accessType).toBe('EXPORT_ACIL_DURUM')
      expect(satir.accessedBy).toBe('u1')
    }
  })

  it('denetim olayı PDF eylemiyle ve SERVIS hedefiyle yazılır', async () => {
    await GET(new NextRequest(URL_TAM))

    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1)
    const cagri = mocks.logAuditEvent.mock.calls[0][0]
    expect(cagri.action).toBe('SERVIS_ACIL_DURUM_PDF_INDIRILDI')
    expect(cagri.targetType).toBe('SERVIS')
    expect(cagri.targetId).toBe('g1')
    expect(cagri.details).toMatchObject({ erisilenPersonelSayisi: 3 })
    // KVKK: kişisel veri details'e girmez.
    expect(JSON.stringify(cagri.details)).not.toContain('Ahmet')
  })

  it('log yazımı patlasa bile PDF YİNE döner (acil ekranda log hatası veriyi engellemez)', async () => {
    mocks.personnelAccessLogCreateMany.mockRejectedValue(new Error('DB yazılamadı'))
    mocks.logAuditEvent.mockRejectedValue(new Error('audit patladı'))

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
