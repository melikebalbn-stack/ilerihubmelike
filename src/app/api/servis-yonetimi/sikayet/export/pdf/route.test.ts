import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  sikayetFindMany: vi.fn(),
}))

// 🔴 require-permission MOCK'LANMIYOR — GERÇEK requireAllPermissions koşsun ki
// AND mantığı fiilen kanıtlansın. Dizili requirePermission OR'dur; guard
// mock'lansaydı "yalnız servis.sikayet.view ile 403" testi OR tuzağını
// YAKALAYAMAZDI. Bunun yerine bir alt katman (oturum + izinler) mock'lanıyor.
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))

// 🔴 sikayet-firma-siniri.ts, sikayet-excel.ts ve gorunum-xlsx.ts
// MOCK'LANMIYOR — gerçek bekçi çalışsın ve gerçek xlsx baytları üretilsin.
vi.mock('@/lib/prisma', () => ({
  prisma: { servisSikayet: { findMany: mocks.sikayetFindMany } },
}))

import { GET } from './route'

function oturumKur(izinler: string[] | null) {
  if (izinler === null) {
    mocks.getServerSession.mockResolvedValue(null)
    return
  }
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

const TAM_YETKI = ['servis.sikayet.view', 'servis.export']

function kayit(i: number, ek: Record<string, unknown> = {}) {
  return {
    id: `c${i}`,
    no: i + 1,
    tarih: new Date('2026-09-01T00:00:00.000Z'),
    bildirimTarihi: new Date('2026-09-02T00:00:00.000Z'),
    kategori: 'GEC_GELME',
    aciklama: `Kayıt ${i}`,
    durum: 'ACIK',
    kaynak: 'IV',
    termin: null,
    aksiyon: null,
    aksiyonTarihi: null,
    kapanisTarihi: null,
    kapanisNotu: null,
    guzergahId: 'g1',
    dilimId: null,
    firmaId: 'f1',
    aracId: null,
    soforId: null,
    durakId: 'dr1',
    guzergah: { kod: 'GZR-01', ad: 'Çerkezköy Hattı' },
    durak: { id: 'dr1', kod: 'DRK-01', ad: 'Merkez' },
    plaka: '59 ABC 123',
    soforAdSoyad: 'Sürücü Bir',
    firmaAd: 'Taşeron A.Ş.',
    sorumluAdSoyad: 'İV Sorumlusu',
    planlananSaat: '07:30',
    createdAt: new Date('2026-09-02T08:00:00.000Z'),
    ...ek,
  }
}

function istek(sorgu = ''): NextRequest {
  return new NextRequest(`http://localhost/api/servis-yonetimi/sikayet/export${sorgu}`)
}

/** PDF baytlarını metne çevirip aranabilir hâle getirir (sıkıştırma kapalı
 *  değil, bu yüzden metin arama yerine YAPISAL iddialar kullanılıyor). */
async function pdfBaytlari(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer())
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sikayetFindMany.mockResolvedValue([])
})

// ----------------------------------------------------------------------------
// 🔴 Yetki — GERÇEK requireAllPermissions (AND), Excel ucuyla AYNI
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export/pdf — yetkilendirme (AND)', () => {
  it('servis.sikayet.view VE servis.export birlikte varsa 200 döner', async () => {
    oturumKur(TAM_YETKI)
    expect((await GET(istek())).status).toBe(200)
  })

  it('🔴 YALNIZ servis.sikayet.view varsa 403 (OR olsaydı 200 dönerdi)', async () => {
    oturumKur(['servis.sikayet.view'])
    expect((await GET(istek())).status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('🔴 YALNIZ servis.export varsa 403 (AND iki yönlü)', async () => {
    oturumKur(['servis.export'])
    expect((await GET(istek())).status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('oturum yoksa 401 döner', async () => {
    oturumKur(null)
    expect((await GET(istek())).status).toBe(401)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('🔴 servis.view + servis.export YETMEZ — admin rolü PDF de indiremez', async () => {
    oturumKur(['servis.view', 'servis.export'])
    expect((await GET(istek())).status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// Dosya
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export/pdf — dosya', () => {
  beforeEach(() => oturumKur(TAM_YETKI))

  it('pdf MIME tipi ve gerçek PDF baytları döner', async () => {
    mocks.sikayetFindMany.mockResolvedValue([kayit(0)])
    const res = await GET(istek())

    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toBe('no-store')

    const buf = await pdfBaytlari(res)
    expect(buf.length).toBeGreaterThan(0)
    // PDF sihirli baytı
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buf.subarray(-6).toString('latin1')).toContain('EOF')
  })

  it('🔴 Content-Disposition dosya adı SALT ASCII, .pdf ve tarihli', async () => {
    const cd = (await GET(istek())).headers.get('content-disposition')!
    expect(cd).toContain('attachment;')
    // eslint-disable-next-line no-control-regex
    expect(cd).toMatch(/^[\x00-\x7F]*$/)
    expect(cd).toMatch(/filename="[A-Za-z0-9._-]+\.pdf"/)
    expect(cd).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('kayıt yokken de geçerli bir PDF üretir (boş yanıt değil)', async () => {
    const buf = await pdfBaytlari(await GET(istek()))
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('ekrandaki filtreleri sorgu katmanına AYNEN geçirir', async () => {
    await GET(istek('?firmaId=f9&durum=KAPANDI'))
    const arg = mocks.sikayetFindMany.mock.calls[0][0]
    expect(arg.where.firmaId).toBe('f9')
    expect(arg.where.durum).toBe('KAPANDI')
  })
})

// ----------------------------------------------------------------------------
// 🔴 KIRPMA YOK
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export/pdf — kırpma YOK', () => {
  it("250 kayıtta sorgu katmanına `take` GEÇİRİLMEZ ve PDF üretilir", async () => {
    oturumKur(TAM_YETKI)
    mocks.sikayetFindMany.mockResolvedValue(Array.from({ length: 250 }, (_, i) => kayit(i)))

    const res = await GET(istek())
    expect(res.status).toBe(200)
    expect(mocks.sikayetFindMany.mock.calls[0][0]).not.toHaveProperty('take')

    // 250 satır tek sayfaya sığmaz — çok sayfalı bir belge çıkmalı.
    const buf = await pdfBaytlari(res)
    const sayfaSayisi = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    expect(sayfaSayisi).toBeGreaterThan(1)
  })
})

// ----------------------------------------------------------------------------
// 🔴 Firma sınırı bekçisi — GERÇEK bekçi, Excel ucuyla AYNI davranış
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export/pdf — firma sınırı', () => {
  beforeEach(() => oturumKur(TAM_YETKI))

  it('🔴 sorgu katmanı şikâyetçi seçerse PDF ÜRETİLMEZ (500) ve veri sızmaz', async () => {
    mocks.sikayetFindMany.mockResolvedValue([
      kayit(0, { sikayetciPersonnelId: 'p1', sikayetci: { adSoyad: 'Ali Veli' } }),
    ])

    const res = await GET(istek())
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')

    const govde = await res.text()
    expect(govde).toContain('veri sınırı ihlali')
    expect(govde).not.toContain('Ali Veli')
  })
})
