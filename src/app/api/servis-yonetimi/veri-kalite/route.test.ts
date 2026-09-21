import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  personnelFindMany: vi.fn(),
  personelAtamaFindMany: vi.fn(),
  personelAtamaGroupBy: vi.fn(),
  guzergahFindMany: vi.fn(),
  seferDilimiFindMany: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  atamaDilimFindMany: vi.fn(),
  aracFindMany: vi.fn(),
  soforFindMany: vi.fn(),
  durakFindMany: vi.fn(),
  guzergahDurakSaatFindMany: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))

// veri-kalite.ts MOCK'LANMIYOR — gerçek Promise.allSettled davranışını uçtan
// uca (route → veriKaliteRaporuGetir → prisma) test etmek için yalnız
// prisma mock'lanıyor. Bu, "bir kontrol patlarsa 500 dönmez" sözleşmesinin
// route katmanında da gerçekten korunduğunu kanıtlar.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    personnel: { findMany: mocks.personnelFindMany },
    servisPersonelAtama: { findMany: mocks.personelAtamaFindMany, groupBy: mocks.personelAtamaGroupBy },
    servisGuzergah: { findMany: mocks.guzergahFindMany },
    servisSeferDilimi: { findMany: mocks.seferDilimiFindMany },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany },
    servisPersonelAtamaDilim: { findMany: mocks.atamaDilimFindMany },
    servisArac: { findMany: mocks.aracFindMany },
    servisSofor: { findMany: mocks.soforFindMany },
    servisDurak: { findMany: mocks.durakFindMany },
    servisGuzergahDurakSaat: { findMany: mocks.guzergahDurakSaatFindMany },
  },
}))

import { GET } from './route'

function permissionResult(allowed: boolean) {
  return { error: allowed ? null : NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) }
}

// Tüm kontroller boş/başarılı sonuç dönsün diye ortak varsayılan mock kurulumu.
function tumKontrolleriBosSonuclaKur() {
  mocks.personnelFindMany.mockResolvedValue([])
  mocks.personelAtamaFindMany.mockResolvedValue([])
  mocks.personelAtamaGroupBy.mockResolvedValue([])
  mocks.guzergahFindMany.mockResolvedValue([])
  mocks.seferDilimiFindMany.mockResolvedValue([])
  mocks.aracVarsayilanFindMany.mockResolvedValue([])
  mocks.soforVarsayilanFindMany.mockResolvedValue([])
  mocks.atamaDilimFindMany.mockResolvedValue([])
  mocks.aracFindMany.mockResolvedValue([])
  mocks.soforFindMany.mockResolvedValue([])
  mocks.durakFindMany.mockResolvedValue([])
  mocks.guzergahDurakSaatFindMany.mockResolvedValue([])
}

const BEKLENEN_16_KOD = [
  'aktif-personel-servis-yok',
  'pasif-personel-servis-aktif',
  'mukerrer-aktif-servis',
  'servis-var-arac-yok',
  'servis-var-sofor-yok',
  'guzergah-sefer-dilimi-tanimsiz',
  'kapasitesi-eksik-arac',
  'koordinatsiz-durak',
  'vardiya-uyumsuzlugu',
  'cakisan-atamalar',
  'adres-degismis-servis-yeniden-degerlendirilmemis',
  'suresi-bitmis-gecici-atama',
  'kapasite-asimi',
  'tarih-cakismasi-arac-sofor',
  'aktif-arac-pasif-firma',
  'dis-firma-soforu-firmasiz',
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/veri-kalite — yetkilendirme', () => {
  it('servis.view izni ister', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()
    await GET()
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.view')
  })

  it('servis.view izni yoksa 403 döner, hiçbir kontrol çalışmaz', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(false))
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/servis-yonetimi/veri-kalite — pozitif', () => {
  it('yetkili kullanıcı için 200 + beklenen 16 kontrol/placeholder yapısı döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.map((s: { kod: string }) => s.kod)).toEqual(BEKLENEN_16_KOD)
    expect(
      json.data.every(
        (s: { adet: number; kayitlar: unknown[]; kirpildi: boolean }) =>
          s.adet === 0 && s.kayitlar.length === 0 && s.kirpildi === false,
      ),
    ).toBe(true)
  })

  it('atlanan/TODO maddeler (8, 10, 12) kapsamDisi + not alanlarıyla, hata fırlatmadan döner', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()

    const res = await GET()
    const json = await res.json()

    const vardiya = json.data.find((s: { kod: string }) => s.kod === 'vardiya-uyumsuzlugu')
    const adres = json.data.find((s: { kod: string }) => s.kod === 'adres-degismis-servis-yeniden-degerlendirilmemis')
    const kapasite = json.data.find((s: { kod: string }) => s.kod === 'kapasite-asimi')

    for (const satir of [vardiya, adres, kapasite]) {
      expect(satir.kapsamDisi).toBe(true)
      expect(typeof satir.not).toBe('string')
      expect(satir.not.length).toBeGreaterThan(0)
      expect(satir.hata).toBeUndefined()
    }
  })
})

// ----------------------------------------------------------------------------
// 🔴 EN ÖNEMLİ SÖZLEŞME NOKTASI: bir kontrol patlarsa endpoint 500 DÖNMEZ.
// Promise.allSettled'ın anlamı route katmanında da korunur — yalnız patlayan
// kontrolün kendi satırı hata bilgisiyle döner, diğer 15 satır sağlam kalır.
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/veri-kalite — kısmi hata (Promise.allSettled sözleşmesi)', () => {
  it('bir kontrol (personnel.findMany) patlarsa 200 döner, yalnız o satırda hata olur, diğer 15 satır sağlam kalır', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()
    // aktifPersonelServisYok'un ilk çağrısı patlar (personnel.findMany).
    // Not: pasifPersonelServisAktif de personnel.findMany kullanıyor ama farklı
    // bir çağrı — mockRejectedValueOnce yalnız İLK çağrıyı patlatır, ikinci
    // çağrı (pasifPersonelServisAktif) normal boş sonucu alır.
    mocks.personnelFindMany.mockReset()
    mocks.personnelFindMany.mockRejectedValueOnce(new Error('DB bağlantı hatası'))
    mocks.personnelFindMany.mockResolvedValue([])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(16)

    const patlayan = json.data.find((s: { kod: string }) => s.kod === 'aktif-personel-servis-yok')
    expect(patlayan.hata).toBe('DB bağlantı hatası')
    expect(patlayan.adet).toBe(0)
    expect(patlayan.kayitlar).toEqual([])

    const digerleri = json.data.filter((s: { kod: string }) => s.kod !== 'aktif-personel-servis-yok')
    expect(digerleri.every((s: { hata?: string }) => s.hata === undefined)).toBe(true)
    expect(digerleri).toHaveLength(15)
  })
})

// ----------------------------------------------------------------------------
// Yanıt boyutu sınırı: adet gerçek toplamı verir, kayitlar KAYIT_LIMIT'e (200)
// kırpılır, kırpılan satırda kirpildi=true döner.
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/veri-kalite — yanıt boyutu sınırı (kırpma)', () => {
  it('sınırın üstünde kayıt varken adet gerçek toplamı verir, kayitlar 200e kırpılır, kirpildi=true olur', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()

    const cokFazlaDurak = Array.from({ length: 250 }, (_, i) => ({
      id: `d${i}`,
      kod: `DURAK-${i}`,
      ad: `Durak ${i}`,
      il: null,
      ilce: null,
      aktif: true,
      guzergahlar: [],
    }))
    mocks.durakFindMany.mockResolvedValue(cokFazlaDurak)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    const durakSatiri = json.data.find((s: { kod: string }) => s.kod === 'koordinatsiz-durak')
    expect(durakSatiri.adet).toBe(250) // gerçek toplam, kırpılmamış
    expect(durakSatiri.kayitlar).toHaveLength(200) // kırpılmış liste
    expect(durakSatiri.kirpildi).toBe(true)

    // sınırın altındaki bir satır kırpılmaz.
    const geriKalanlar = json.data.filter((s: { kod: string }) => s.kod !== 'koordinatsiz-durak')
    expect(geriKalanlar.every((s: { kirpildi: boolean }) => s.kirpildi === false)).toBe(true)
  })

  it('sınıra tam eşit sayıda kayıt varsa kırpılmaz (200 dahil, > 200 kırpılır)', async () => {
    mocks.requirePermission.mockResolvedValue(permissionResult(true))
    tumKontrolleriBosSonuclaKur()

    const tamSinirdaDurak = Array.from({ length: 200 }, (_, i) => ({
      id: `d${i}`,
      kod: `DURAK-${i}`,
      ad: `Durak ${i}`,
      il: null,
      ilce: null,
      aktif: true,
      guzergahlar: [],
    }))
    mocks.durakFindMany.mockResolvedValue(tamSinirdaDurak)

    const res = await GET()
    const json = await res.json()
    const durakSatiri = json.data.find((s: { kod: string }) => s.kod === 'koordinatsiz-durak')

    expect(durakSatiri.adet).toBe(200)
    expect(durakSatiri.kayitlar).toHaveLength(200)
    expect(durakSatiri.kirpildi).toBe(false)
  })
})
