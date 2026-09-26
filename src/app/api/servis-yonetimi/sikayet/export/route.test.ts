import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

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

async function sayfaSatirlari(res: Response): Promise<unknown[][]> {
  const buf = Buffer.from(await res.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sikayetFindMany.mockResolvedValue([])
})

// ----------------------------------------------------------------------------
// 🔴 Yetki — GERÇEK requireAllPermissions (AND)
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export — yetkilendirme (AND)', () => {
  it('servis.sikayet.view VE servis.export birlikte varsa 200 döner', async () => {
    oturumKur(TAM_YETKI)
    expect((await GET(istek())).status).toBe(200)
  })

  it('🔴 YALNIZ servis.sikayet.view varsa 403 (OR olsaydı 200 dönerdi)', async () => {
    oturumKur(['servis.sikayet.view'])
    const res = await GET(istek())
    expect(res.status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('🔴 YALNIZ servis.export varsa 403 (AND iki yönlü)', async () => {
    oturumKur(['servis.export'])
    const res = await GET(istek())
    expect(res.status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('oturum yoksa 401 döner', async () => {
    oturumKur(null)
    const res = await GET(istek())
    expect(res.status).toBe(401)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })

  it('🔴 servis.view + servis.export YETMEZ — admin rolü şikâyet dosyasını indiremez', async () => {
    // seed-servis-role-mapping.ts: admin'de servis.view+servis.export VAR,
    // servis.sikayet.view YOK. Ekranda göremediği veriyi indirememeli.
    oturumKur(['servis.view', 'servis.export'])
    const res = await GET(istek())
    expect(res.status).toBe(403)
    expect(mocks.sikayetFindMany).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// Dosya
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export — dosya', () => {
  beforeEach(() => oturumKur(TAM_YETKI))

  it('xlsx MIME tipi ve gerçek xlsx baytları döner', async () => {
    mocks.sikayetFindMany.mockResolvedValue([kayit(0)])
    const res = await GET(istek())

    expect(res.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(res.headers.get('cache-control')).toBe('no-store')

    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(0)
    // xlsx = zip, "PK" magic byte
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
    expect(XLSX.read(buf, { type: 'buffer' }).SheetNames.length).toBeGreaterThan(0)
  })

  it('🔴 Content-Disposition dosya adı SALT ASCII ve tarihli', async () => {
    const cd = (await GET(istek())).headers.get('content-disposition')!
    expect(cd).toContain('attachment;')
    // eslint-disable-next-line no-control-regex
    expect(cd).toMatch(/^[\x00-\x7F]*$/)
    expect(cd).toMatch(/filename="[A-Za-z0-9._-]+\.xlsx"/)
    expect(cd).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('Türkçe başlıkları ve etiketleri taşır', async () => {
    mocks.sikayetFindMany.mockResolvedValue([kayit(0)])
    const duz = (await sayfaSatirlari(await GET(istek()))).flat().map(String)
    expect(duz).toContain('Bildirim Tarihi')
    expect(duz).toContain('Kapanış Notu')
    expect(duz).toContain('Geç gelme') // kategori etiketi çevrilmiş
    expect(duz.some(h => h.includes('Reddedilen şikâyetler firma performansına sayılmaz'))).toBe(true)
  })

  it('ekrandaki filtreleri sorgu katmanına AYNEN geçirir', async () => {
    await GET(istek('?firmaId=f9&durum=KAPANDI&bildirimBaslangic=2026-09-01'))
    const arg = mocks.sikayetFindMany.mock.calls[0][0]
    expect(arg.where.firmaId).toBe('f9')
    expect(arg.where.durum).toBe('KAPANDI')
    expect(arg.where.bildirimTarihi.gte).toEqual(new Date('2026-09-01'))
  })
})

// ----------------------------------------------------------------------------
// 🔴 KIRPMA YOK — davranışsal koruma
// ----------------------------------------------------------------------------
const COK_KAYIT = 250

describe('GET .../sikayet/export — kırpma YOK', () => {
  it(`${COK_KAYIT} kaydın HEPSİ dosyada (200'e kesilmez)`, async () => {
    oturumKur(TAM_YETKI)
    mocks.sikayetFindMany.mockResolvedValue(Array.from({ length: COK_KAYIT }, (_, i) => kayit(i)))

    const satirlar = await sayfaSatirlari(await GET(istek()))
    const veriSatirlari = satirlar.filter(s => s.some(h => /^Kayıt \d+$/.test(String(h))))

    expect(veriSatirlari).toHaveLength(COK_KAYIT)
    expect(veriSatirlari.length).toBeGreaterThan(200)
    // Son kayıt gerçekten dosyada — 200'den sonrası düşmemiş.
    expect(satirlar.flat().map(String)).toContain(`Kayıt ${COK_KAYIT - 1}`)
  })

  it('sorgu katmanına `take` GEÇİRİLMEZ (limit DB tarafında da yok)', async () => {
    oturumKur(TAM_YETKI)
    await GET(istek())
    expect(mocks.sikayetFindMany.mock.calls[0][0]).not.toHaveProperty('take')
  })
})

// ----------------------------------------------------------------------------
// 🔴 Firma sınırı bekçisi — GERÇEK bekçi, fail-closed
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export — firma sınırı', () => {
  beforeEach(() => oturumKur(TAM_YETKI))

  it('temiz veride dosya üretilir', async () => {
    mocks.sikayetFindMany.mockResolvedValue([kayit(0)])
    expect((await GET(istek())).status).toBe(200)
  })

  it('🔴 sorgu katmanı şikâyetçi seçerse dosya ÜRETİLMEZ (500) ve veri sızmaz', async () => {
    mocks.sikayetFindMany.mockResolvedValue([
      kayit(0, { sikayetciPersonnelId: 'p1', sikayetci: { adSoyad: 'Ali Veli' } }),
    ])

    const res = await GET(istek())
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')

    const govde = await res.text()
    expect(govde).toContain('veri sınırı ihlali')
    // Sızan değer yanıta DÜŞMEMELİ — ne ad ne id.
    expect(govde).not.toContain('Ali Veli')
    expect(govde).not.toContain('sikayetciPersonnelId')
  })
})

// ----------------------------------------------------------------------------
// Adım 5F — güzergâh kolonu
// ----------------------------------------------------------------------------
describe('GET .../sikayet/export — güzergâh kolonu', () => {
  beforeEach(() => oturumKur(TAM_YETKI))

  it('güzergâh kolonu dosyada VAR ve DOLU (ham UUID değil)', async () => {
    mocks.sikayetFindMany.mockResolvedValue([kayit(0)])
    const duz = (await sayfaSatirlari(await GET(istek()))).flat().map(String)

    expect(duz).toContain('Güzergâh')
    expect(duz).toContain('GZR-01 — Çerkezköy Hattı')
    // Ham id dosyaya SIZMAMALI
    expect(duz).not.toContain('g1')
  })

  it('sorgu katmanından guzergah kod/ad İSTENİYOR', async () => {
    await GET(istek())
    expect(mocks.sikayetFindMany.mock.calls[0][0].select.guzergah).toEqual({
      select: { kod: true, ad: true },
    })
  })
})
