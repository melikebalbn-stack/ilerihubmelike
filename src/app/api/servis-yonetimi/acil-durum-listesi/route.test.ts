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

import { GET } from './route'
import { AcilDurumListesiError } from '@/lib/servis-yonetimi/acil-durum-listesi'

function izinSonucu(izinli: boolean) {
  return izinli
    ? { session: {}, userId: 'u1', error: null }
    : { session: null, userId: null, error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) }
}

function bosBlok() {
  return { durum: 'ATANMAMIS' as const, kayitlar: [] }
}

const ORNEK_SONUC = {
  tarih: '2026-09-22',
  guzergah: { id: 'g1', kod: 'G1', ad: 'Güzergah 1', yerleskeKod: 'Y1', yerleskeAd: 'Yerleşke 1' },
  dilim: { id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS' },
  seferTanimli: true,
  duraklar: bosBlok(),
  arac: { ana: bosBlok(), yedek: bosBlok() },
  sofor: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [
        { soforId: 's1', adSoyad: 'Dahili Şoför', telefon: '555', dahiliMi: true, personnelId: 'p-sofor' },
        { soforId: 's2', adSoyad: 'Dış Şoför', telefon: '666', dahiliMi: false, personnelId: null },
      ],
    },
    yedek: bosBlok(),
  },
  sorumlu: {
    ana: {
      durum: 'VERI_VAR' as const,
      kayitlar: [{ personnelId: 'p-sorumlu', sicilNo: '999', adSoyad: 'Sorumlu', telefon: '777' }],
    },
    yedek: bosBlok(),
  },
  firmalar: bosBlok(),
  yolcular: {
    durum: 'VERI_VAR' as const,
    kayitlar: [
      { personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet', durakKod: 'D1', durakAd: 'Durak 1', telefon: '5551' },
      { personnelId: 'p2', sicilNo: '222', adSoyad: 'Ayşe', durakKod: 'D1', durakAd: 'Durak 1', telefon: '5552' },
    ],
  },
}

const URL_TAM = 'http://localhost/x?guzergahId=g1&dilimId=d1'

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.acilDurumListesiGetir.mockResolvedValue(ORNEK_SONUC)
  mocks.personnelAccessLogCreateMany.mockResolvedValue({ count: 4 })
  mocks.logAuditEvent.mockResolvedValue({ ok: true })
})

// ----------------------------------------------------------------------------
// 🔴 Yetki: servis.view VE servis.kvkk.view — ikisi birden (Ders 55)
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/acil-durum-listesi — yetkilendirme', () => {
  it('servis.view VE servis.kvkk.view birlikte istenir (AND mantığı)', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true))
    await GET(new NextRequest(URL_TAM))
    expect(mocks.requireAllPermissions).toHaveBeenCalledWith(['servis.view', 'servis.kvkk.view'])
  })

  it('🔴 servis.view VAR ama servis.kvkk.view YOK → 403 (normal servis ekranını gören bu ekranı GÖREMEZ)', async () => {
    // requireAllPermissions AND uygular; eksik anahtar varsa error döner.
    mocks.requireAllPermissions.mockResolvedValue(izinSonucu(false))
    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(403)
    expect(mocks.acilDurumListesiGetir).not.toHaveBeenCalled()
    expect(mocks.personnelAccessLogCreateMany).not.toHaveBeenCalled()
  })

  it('hiçbir izni olmayan kullanıcı → 403', async () => {
    mocks.requireAllPermissions.mockResolvedValue(izinSonucu(false))
    const res = await GET(new NextRequest('http://localhost/x?guzergahId=g1&dilimId=d1'))
    expect(res.status).toBe(403)
    expect(mocks.acilDurumListesiGetir).not.toHaveBeenCalled()
  })
})

describe('GET /api/servis-yonetimi/acil-durum-listesi — parametreler', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('guzergahId eksikse 400, sorgu çalışmaz', async () => {
    const res = await GET(new NextRequest('http://localhost/x?dilimId=d1'))
    expect(res.status).toBe(400)
    expect(mocks.acilDurumListesiGetir).not.toHaveBeenCalled()
  })

  it('dilimId eksikse 400', async () => {
    const res = await GET(new NextRequest('http://localhost/x?guzergahId=g1'))
    expect(res.status).toBe(400)
  })

  it('boşluktan ibaret parametre geçersiz sayılır → 400', async () => {
    const res = await GET(new NextRequest('http://localhost/x?guzergahId=%20%20&dilimId=d1'))
    expect(res.status).toBe(400)
  })

  it('güzergâh/dilim bulunamazsa 404 döner', async () => {
    mocks.acilDurumListesiGetir.mockRejectedValue(new AcilDurumListesiError('Güzergâh bulunamadı.'))
    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/servis-yonetimi/acil-durum-listesi — pozitif', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('200 döner ve blok yapısı (durum + kayitlar) olduğu gibi korunur', async () => {
    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.data.arac.ana.durum).toBe('ATANMAMIS')
    expect(json.data.arac.ana.kayitlar).toEqual([])
    expect(json.data.sofor.ana.durum).toBe('VERI_VAR')
    expect(json.data.yolcular.kayitlar).toHaveLength(2)
    expect(json.data.seferTanimli).toBe(true)
  })

  it('sorgu parametreleri Adım 1 fonksiyonuna iletilir', async () => {
    await GET(new NextRequest(URL_TAM))
    expect(mocks.acilDurumListesiGetir).toHaveBeenCalledWith({ guzergahId: 'g1', dilimId: 'd1' })
  })
})

// ----------------------------------------------------------------------------
// 🔴 KVKK erişim izi — iki mekanizma
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/acil-durum-listesi — erişim izi', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('PersonnelAccessLog: yolcular + sorumlu + DAHİLİ şoför için satır yazılır, dış firma şoförü hariç', async () => {
    await GET(new NextRequest(URL_TAM))

    expect(mocks.personnelAccessLogCreateMany).toHaveBeenCalledTimes(1)
    const data = mocks.personnelAccessLogCreateMany.mock.calls[0][0].data
    expect(data.map((d: { personnelId: string }) => d.personnelId).sort()).toEqual(
      ['p-sofor', 'p-sorumlu', 'p1', 'p2'].sort(),
    )
    // Dış firma şoförünün (personnelId null) satırı YOK.
    expect(data).toHaveLength(4)
    for (const satir of data) {
      expect(satir.accessType).toBe('VIEW_ACIL_DURUM')
      expect(satir.accessedBy).toBe('u1')
    }
  })

  it('PersonnelAccessLog satırlarına IP adresi yazılır', async () => {
    const req = new NextRequest(URL_TAM, { headers: { 'x-forwarded-for': '10.0.0.5' } })
    await GET(req)
    const data = mocks.personnelAccessLogCreateMany.mock.calls[0][0].data
    expect(data[0].ipAddress).toBe('10.0.0.5')
  })

  it('logAuditEvent: erişim olayı güzergâh/dilim bağlamıyla yazılır, KİŞİSEL VERİ yazılmaz', async () => {
    await GET(new NextRequest(URL_TAM))

    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1)
    const cagri = mocks.logAuditEvent.mock.calls[0][0]
    expect(cagri.action).toBe('SERVIS_ACIL_DURUM_GORUNTULENDI')
    expect(cagri.actorId).toBe('u1')
    expect(cagri.details).toMatchObject({
      guzergahId: 'g1',
      guzergahKod: 'G1',
      dilimId: 'd1',
      erisilenPersonelSayisi: 4,
      yolcuSayisi: 2,
    })
    // KVKK: ad/telefon gibi kişisel veri details'e GİRMEZ.
    expect(JSON.stringify(cagri.details)).not.toContain('Ahmet')
    expect(JSON.stringify(cagri.details)).not.toContain('5551')
  })

  it('erişilen personel yoksa PersonnelAccessLog çağrısı HİÇ yapılmaz (boş createMany atılmaz)', async () => {
    mocks.acilDurumListesiGetir.mockResolvedValue({
      ...ORNEK_SONUC,
      sofor: { ana: bosBlok(), yedek: bosBlok() },
      sorumlu: { ana: bosBlok(), yedek: bosBlok() },
      yolcular: bosBlok(),
    })

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    expect(mocks.personnelAccessLogCreateMany).not.toHaveBeenCalled()
    // Olay logu yine de yazılır — "kim baktı" bilgisi liste boş olsa da gerekli.
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------------------------------------------
// 🔴 Log yazımı sonucu BOZMAZ — acil ekranda log hatası veriyi engellemez
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/acil-durum-listesi — log hatası dayanıklılığı', () => {
  beforeEach(() => mocks.requireAllPermissions.mockResolvedValue(izinSonucu(true)))

  it('PersonnelAccessLog yazımı patlarsa endpoint YİNE 200 ve tam veri döner', async () => {
    mocks.personnelAccessLogCreateMany.mockRejectedValue(new Error('DB yazılamadı'))

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.yolcular.kayitlar).toHaveLength(2)
  })

  it('denetim olayı yazımı patlarsa endpoint YİNE 200 döner', async () => {
    mocks.logAuditEvent.mockRejectedValue(new Error('audit patladı'))

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
  })

  it('İKİ log mekanizması da patlasa endpoint YİNE 200 döner', async () => {
    mocks.personnelAccessLogCreateMany.mockRejectedValue(new Error('DB yazılamadı'))
    mocks.logAuditEvent.mockRejectedValue(new Error('audit patladı'))

    const res = await GET(new NextRequest(URL_TAM))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
