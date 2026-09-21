import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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

import {
  aktifPersonelServisYok,
  pasifPersonelServisAktif,
  mukerrerAktifServis,
  servisVarAracYok,
  servisVarSoforYok,
  guzergahSeferDilimiTanimsiz,
  kapasitesiEksikArac,
  koordinatsizDurak,
  cakisanAtamalar,
  suresiBitmisGeciciAtama,
  tarihCakismasiAracSofor,
  aktifAracPasifFirma,
  disFirmaSoforuFirmasiz,
  veriKaliteRaporuGetir,
} from './veri-kalite'

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
})

// ----------------------------------------------------------------------------
// 1. Aktif personel / servis yok — hariç tutma mantığı en kritik nokta
// ----------------------------------------------------------------------------
describe('aktifPersonelServisYok', () => {
  it('pozitif: anomali varsa listeler', async () => {
    mocks.personnelFindMany.mockResolvedValue([{ id: 'p1', sicilNo: '1', adSoyad: 'Ahmet', bolum: 'Üretim' }])
    const sonuc = await aktifPersonelServisYok()
    expect(sonuc.kod).toBe('aktif-personel-servis-yok')
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar).toEqual([{ id: 'p1', sicilNo: '1', adSoyad: 'Ahmet', bolum: 'Üretim' }])
  })

  it('negatif: anomali yoksa boş döner', async () => {
    mocks.personnelFindMany.mockResolvedValue([])
    const sonuc = await aktifPersonelServisYok()
    expect(sonuc.adet).toBe(0)
    expect(sonuc.kayitlar).toEqual([])
  })

  it('KENDI_GELIYOR/KULLANMIYOR/SIRKET_ARACI hariç tutma filtresi doğru kurulur (durum != SERVIS_KULLANIYOR)', async () => {
    mocks.personnelFindMany.mockResolvedValue([])
    await aktifPersonelServisYok()
    expect(mocks.personnelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          aktif: true,
          servisAtamalari: { none: { aktif: true } },
          servisDurumlari: { none: { aktif: true, durum: { not: 'SERVIS_KULLANIYOR' } } },
        },
      }),
    )
  })
})

describe('pasifPersonelServisAktif', () => {
  it('pozitif: pasif personelin aktif ataması varsa listeler', async () => {
    mocks.personnelFindMany.mockResolvedValue([{ id: 'p2', sicilNo: '2', adSoyad: 'Ayşe', bolum: 'İK' }])
    const sonuc = await pasifPersonelServisAktif()
    expect(sonuc.adet).toBe(1)
  })

  it('negatif: boş döner', async () => {
    mocks.personnelFindMany.mockResolvedValue([])
    const sonuc = await pasifPersonelServisAktif()
    expect(sonuc.adet).toBe(0)
  })

  it('where doğru kurulur (aktif=false + servisAtamalari.some.aktif=true)', async () => {
    mocks.personnelFindMany.mockResolvedValue([])
    await pasifPersonelServisAktif()
    expect(mocks.personnelFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aktif: false, servisAtamalari: { some: { aktif: true } } } }),
    )
  })
})

// ----------------------------------------------------------------------------
// 3. Mükerrer aktif servis — tarihten bağımsız
// ----------------------------------------------------------------------------
describe('mukerrerAktifServis', () => {
  it('pozitif: aynı personelin 2 aktif ataması (tarihleri kesişmese bile) yakalanır', async () => {
    mocks.personelAtamaGroupBy.mockResolvedValue([{ personnelId: 'p1', _count: { _all: 2 } }])
    mocks.personelAtamaFindMany.mockResolvedValue([
      { id: 'a1', personnelId: 'p1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-02-01'), guzergah: { kod: 'G1', ad: 'Güzergah 1' } },
      { id: 'a2', personnelId: 'p1', baslangicTarihi: new Date('2026-06-01'), bitisTarihi: null, guzergah: { kod: 'G2', ad: 'Güzergah 2' } },
    ])
    mocks.personnelFindMany.mockResolvedValue([{ id: 'p1', sicilNo: '1', adSoyad: 'Ahmet', bolum: 'Üretim' }])

    const sonuc = await mukerrerAktifServis()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ personnelId: 'p1', aktifAtamaSayisi: 2 })
  })

  it('negatif: kimsenin 2+ aktif ataması yoksa boş döner, findMany hiç çağrılmaz', async () => {
    mocks.personelAtamaGroupBy.mockResolvedValue([])
    const sonuc = await mukerrerAktifServis()
    expect(sonuc.adet).toBe(0)
    expect(mocks.personelAtamaFindMany).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// 4 / 5. Servis var / araç-şoför yok
// ----------------------------------------------------------------------------
// Taban küme artık ServisGuzergahDurakSaat'ten türetilen "gerçekten hizmet
// verilen" (guzergahId, dilimId) çiftleri — çapraz çarpım DEĞİL.
describe('servisVarAracYok', () => {
  it('pozitif: hizmet verilen çiftte aktif ANA araç yoksa anomali, etkilenenPersonelSayisi hesaplanır', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'd1', kod: 'SABAH', ad: 'Sabah' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.aracVarsayilanFindMany.mockResolvedValue([]) // hiç aktif ANA araç yok
    mocks.atamaDilimFindMany.mockResolvedValue([
      { dilimId: 'd1', atama: { guzergahId: 'g1', personnelId: 'p1' } },
      { dilimId: 'd1', atama: { guzergahId: 'g1', personnelId: 'p2' } },
    ])

    const sonuc = await servisVarAracYok()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ guzergahId: 'g1', dilimId: 'd1', etkilenenPersonelSayisi: 2 })
  })

  it('pozitif: 0 etkilenen personelli çift de listelenir (filtrelenmez)', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'd1', kod: 'SABAH', ad: 'Sabah' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.aracVarsayilanFindMany.mockResolvedValue([])
    mocks.atamaDilimFindMany.mockResolvedValue([])

    const sonuc = await servisVarAracYok()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ etkilenenPersonelSayisi: 0 })
  })

  it('negatif: hizmet verilen çift için aktif ANA araç varsa boş döner', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'd1', kod: 'SABAH', ad: 'Sabah' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.aracVarsayilanFindMany.mockResolvedValue([{ guzergahId: 'g1', dilimId: 'd1' }])

    const sonuc = await servisVarAracYok()
    expect(sonuc.adet).toBe(0)
    expect(mocks.atamaDilimFindMany).not.toHaveBeenCalled()
  })

  it('negatif (düzeltmenin asıl kanıtı): güzergah o dilime HİÇ hizmet vermiyorsa (saat kaydı yok) araç eksikliği hiç kontrol edilmez — yanlış pozitif üretmez', async () => {
    // g1 yalnız sabah çalışıyor (d1); akşam dilimi (d2) için hiç saat tanımı yok.
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([
      { id: 'd1', kod: 'SABAH', ad: 'Sabah' },
      { id: 'd2', kod: 'AKSAM', ad: 'Akşam' },
    ])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.aracVarsayilanFindMany.mockResolvedValue([{ guzergahId: 'g1', dilimId: 'd1' }]) // sabah için araç var

    const sonuc = await servisVarAracYok()
    // (g1, d2) çapraz çarpımda olurdu ama hizmet verilmediği için hiç değerlendirilmez.
    expect(sonuc.adet).toBe(0)
  })
})

describe('servisVarSoforYok', () => {
  it('pozitif: hizmet verilen çiftte aktif ANA şoför yoksa anomali', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'd1', kod: 'SABAH', ad: 'Sabah' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])
    mocks.atamaDilimFindMany.mockResolvedValue([])

    const sonuc = await servisVarSoforYok()
    expect(sonuc.adet).toBe(1)
  })

  it('negatif: aktif ANA şoför varsa boş döner', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'd1', kod: 'SABAH', ad: 'Sabah' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([{ guzergahId: 'g1', dilimId: 'd1' }])

    const sonuc = await servisVarSoforYok()
    expect(sonuc.adet).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// Düzeltme 1(c): güzergah var ama hiç sefer dilimi tanımlı değil — ayrı bulgu
// ----------------------------------------------------------------------------
describe('guzergahSeferDilimiTanimsiz', () => {
  it('pozitif: hiç ServisGuzergahDurakSaat kaydı olmayan aktif güzergah yakalanır', async () => {
    mocks.guzergahFindMany.mockResolvedValue([
      { id: 'g1', kod: 'G1', ad: 'Güzergah 1' },
      { id: 'g2', kod: 'G2', ad: 'Güzergah 2' },
    ])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])

    const sonuc = await guzergahSeferDilimiTanimsiz()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ guzergahId: 'g2' })
  })

  it('negatif: her aktif güzergahın en az bir saat kaydı varsa boş döner', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'G1', ad: 'Güzergah 1' }])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([
      { dilimId: 'd1', dilim: { aktif: true }, guzergahDurak: { guzergahId: 'g1' } },
    ])

    const sonuc = await guzergahSeferDilimiTanimsiz()
    expect(sonuc.adet).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// 6. Kapasitesi eksik araç
// ----------------------------------------------------------------------------
describe('kapasitesiEksikArac', () => {
  it('pozitif: kapasite <= 0 olan araç yakalanır', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41 AB 123', kapasite: 0, firma: { ad: 'Firma A' } }])
    const sonuc = await kapasitesiEksikArac()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ plaka: '41 AB 123', kapasite: 0, firmaAd: 'Firma A' })
  })

  it('negatif: boş döner', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    const sonuc = await kapasitesiEksikArac()
    expect(sonuc.adet).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// 7. Koordinatsız durak
// ----------------------------------------------------------------------------
describe('koordinatsizDurak', () => {
  it('pozitif: enlem veya boylam boş durak yakalanır, aktif+aktif güzergaha bağlı bilgisiyle', async () => {
    mocks.durakFindMany.mockResolvedValue([
      { id: 'd1', kod: 'GEBZE_DEVELI-02', ad: 'M. Paşa', il: 'Kocaeli', ilce: 'Gebze', aktif: true, guzergahlar: [{ id: 'gd1' }] },
    ])
    const sonuc = await koordinatsizDurak()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ aktif: true, aktifGuzergahaBagli: true })
  })

  it('pozitif: aktif güzergaha bağlı OLMAYAN eksik-koordinat durak da listelenir ama aktifGuzergahaBagli=false', async () => {
    mocks.durakFindMany.mockResolvedValue([
      { id: 'd2', kod: 'X-01', ad: 'Kullanılmayan Durak', il: null, ilce: null, aktif: true, guzergahlar: [] },
    ])
    const sonuc = await koordinatsizDurak()
    expect(sonuc.kayitlar[0]).toMatchObject({ aktifGuzergahaBagli: false })
  })

  it('negatif: boş döner', async () => {
    mocks.durakFindMany.mockResolvedValue([])
    const sonuc = await koordinatsizDurak()
    expect(sonuc.adet).toBe(0)
  })

  it('sorgu aktif+güzergahı aktif ServisGuzergahDurak varlığını kontrol edecek şekilde kurulur', async () => {
    mocks.durakFindMany.mockResolvedValue([])
    await koordinatsizDurak()
    const cagriArg = mocks.durakFindMany.mock.calls[0][0]
    expect(cagriArg.select.guzergahlar).toEqual({
      where: { aktif: true, guzergah: { aktif: true } },
      select: { id: true },
      take: 1,
    })
  })
})

// ----------------------------------------------------------------------------
// 9. Çakışan atamalar — 3'ten farkı: tarih kesişimi gerçekten aranır
// ----------------------------------------------------------------------------
describe('cakisanAtamalar', () => {
  it('pozitif: tarih aralığı kesişen 2 aktif atama yakalanır', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([
      { id: 'a1', personnelId: 'p1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-06-01'), guzergah: { kod: 'G1' } },
      { id: 'a2', personnelId: 'p1', baslangicTarihi: new Date('2026-03-01'), bitisTarihi: null, guzergah: { kod: 'G2' } },
    ])
    mocks.personnelFindMany.mockResolvedValue([{ id: 'p1', sicilNo: '1', adSoyad: 'Ahmet', bolum: 'Üretim' }])

    const sonuc = await cakisanAtamalar()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ personnelId: 'p1', cakisanCiftSayisi: 1 })
  })

  it('negatif: 2 aktif atama var ama tarihleri kesişmiyorsa (madde 3 yakalar, 9 yakalamaz) boş döner', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([
      { id: 'a1', personnelId: 'p1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-02-01'), guzergah: { kod: 'G1' } },
      { id: 'a2', personnelId: 'p1', baslangicTarihi: new Date('2026-06-01'), bitisTarihi: null, guzergah: { kod: 'G2' } },
    ])

    const sonuc = await cakisanAtamalar()
    expect(sonuc.adet).toBe(0)
    expect(mocks.personnelFindMany).not.toHaveBeenCalled()
  })

  it('negatif: tek aktif atama varsa boş döner', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([
      { id: 'a1', personnelId: 'p1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, guzergah: { kod: 'G1' } },
    ])
    const sonuc = await cakisanAtamalar()
    expect(sonuc.adet).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// 11. Süresi bitmiş geçici atama
// ----------------------------------------------------------------------------
describe('suresiBitmisGeciciAtama', () => {
  it('pozitif: bitisTarihi geçmişte olan aktif atama yakalanır', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([
      {
        id: 'a1',
        baslangicTarihi: new Date('2026-01-01'),
        bitisTarihi: new Date('2026-02-01'),
        personnel: { id: 'p1', sicilNo: '1', adSoyad: 'Ahmet', bolum: 'Üretim' },
        guzergah: { kod: 'G1', ad: 'Güzergah 1' },
      },
    ])
    const sonuc = await suresiBitmisGeciciAtama()
    expect(sonuc.adet).toBe(1)
  })

  it('negatif: boş döner', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([])
    const sonuc = await suresiBitmisGeciciAtama()
    expect(sonuc.adet).toBe(0)
  })

  it('sorgu bitisTarihi lt bugün ve aktif=true filtresiyle kurulur (NULL bitisTarihi doğal olarak dışarıda kalır)', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([])
    await suresiBitmisGeciciAtama()
    const cagriArg = mocks.personelAtamaFindMany.mock.calls[0][0]
    expect(cagriArg.where.aktif).toBe(true)
    expect(cagriArg.where.bitisTarihi).toHaveProperty('lt')
  })
})

// ----------------------------------------------------------------------------
// 13. Tarih çakışması (araç/şoför)
// ----------------------------------------------------------------------------
describe('tarihCakismasiAracSofor', () => {
  it('pozitif: aynı araç, aynı dilim, farklı güzergah, kesişen tarih → yakalanır', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { id: 'v1', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G1' }, dilim: { kod: 'SABAH' } },
      { id: 'v2', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g2', baslangicTarihi: new Date('2026-03-01'), bitisTarihi: null, arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G2' }, dilim: { kod: 'SABAH' } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])

    const sonuc = await tarihCakismasiAracSofor()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ tur: 'ARAC', aracPlaka: '41 AB 1' })
  })

  it("negatif: aynı araç aynı dilim ama AYNI güzergah ise (DB kısıtı zaten izin verir) çakışma sayılmaz", async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { id: 'v1', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G1' }, dilim: { kod: 'SABAH' } },
      { id: 'v2', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g1', baslangicTarihi: new Date('2026-03-01'), bitisTarihi: null, arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G1' }, dilim: { kod: 'SABAH' } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])

    const sonuc = await tarihCakismasiAracSofor()
    expect(sonuc.adet).toBe(0)
  })

  it('negatif: farklı güzergah ama tarihleri kesişmiyorsa çakışma sayılmaz', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { id: 'v1', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-02-01'), arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G1' }, dilim: { kod: 'SABAH' } },
      { id: 'v2', aracId: 'arac1', dilimId: 'd1', guzergahId: 'g2', baslangicTarihi: new Date('2026-06-01'), bitisTarihi: null, arac: { plaka: '41 AB 1' }, guzergah: { kod: 'G2' }, dilim: { kod: 'SABAH' } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])

    const sonuc = await tarihCakismasiAracSofor()
    expect(sonuc.adet).toBe(0)
  })

  it('pozitif: şoför boyutunda da aynı mantık çalışır', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([])
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { id: 's1', soforId: 'sofor1', dilimId: 'd1', guzergahId: 'g1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, sofor: { adSoyad: 'Mehmet' }, guzergah: { kod: 'G1' }, dilim: { kod: 'SABAH' } },
      { id: 's2', soforId: 'sofor1', dilimId: 'd1', guzergahId: 'g2', baslangicTarihi: new Date('2026-02-01'), bitisTarihi: null, sofor: { adSoyad: 'Mehmet' }, guzergah: { kod: 'G2' }, dilim: { kod: 'SABAH' } },
    ])

    const sonuc = await tarihCakismasiAracSofor()
    expect(sonuc.adet).toBe(1)
    expect(sonuc.kayitlar[0]).toMatchObject({ tur: 'SOFOR', soforAdSoyad: 'Mehmet' })
  })
})

// ----------------------------------------------------------------------------
// 14a / 14b. Eksik firma ilişkisi
// ----------------------------------------------------------------------------
describe('aktifAracPasifFirma', () => {
  it('pozitif: aktif araç pasif firmaya bağlıysa yakalanır', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41 AB 1', firma: { id: 'f1', ad: 'Firma A' } }])
    const sonuc = await aktifAracPasifFirma()
    expect(sonuc.adet).toBe(1)
  })

  it('negatif: boş döner', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    const sonuc = await aktifAracPasifFirma()
    expect(sonuc.adet).toBe(0)
  })
})

describe('disFirmaSoforuFirmasiz', () => {
  it('pozitif: personnelId ve firmaId ikisi de null olan aktif şoför yakalanır', async () => {
    mocks.soforFindMany.mockResolvedValue([{ id: 's1', adSoyad: 'Ali Veli', disFirmaSoforKodu: 'X123' }])
    const sonuc = await disFirmaSoforuFirmasiz()
    expect(sonuc.adet).toBe(1)
  })

  it('negatif: boş döner (dahili şoförde firmaId=null zaten normal, bu sorgu personnelId=null şartıyla onları hiç dahil etmez)', async () => {
    mocks.soforFindMany.mockResolvedValue([])
    const sonuc = await disFirmaSoforuFirmasiz()
    expect(sonuc.adet).toBe(0)
    expect(mocks.soforFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aktif: true, personnelId: null, firmaId: null } }),
    )
  })
})

// ----------------------------------------------------------------------------
// Orkestrasyon — Promise.allSettled: bir kontrol patlarsa diğerleri etkilenmez
// ----------------------------------------------------------------------------
describe('veriKaliteRaporuGetir', () => {
  it('bir kontrol reddedilirse (throw) diğer 12 kontrol yine çalışır, patlayan kendi hata bilgisiyle döner', async () => {
    mocks.personnelFindMany.mockRejectedValueOnce(new Error('DB bağlantı hatası'))
    mocks.personnelFindMany.mockResolvedValue([])
    mocks.personelAtamaGroupBy.mockResolvedValue([])
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.seferDilimiFindMany.mockResolvedValue([])
    mocks.aracVarsayilanFindMany.mockResolvedValue([])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])
    mocks.atamaDilimFindMany.mockResolvedValue([])
    mocks.aracFindMany.mockResolvedValue([])
    mocks.soforFindMany.mockResolvedValue([])
    mocks.durakFindMany.mockResolvedValue([])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([])

    const rapor = await veriKaliteRaporuGetir()

    expect(rapor).toHaveLength(13)
    const patlayan = rapor.find(r => r.kod === 'aktif-personel-servis-yok')
    expect(patlayan?.hata).toBe('DB bağlantı hatası')
    expect(patlayan?.adet).toBe(0)

    const digerleri = rapor.filter(r => r.kod !== 'aktif-personel-servis-yok')
    expect(digerleri.every(r => r.hata === undefined)).toBe(true)
  })

  it('hiçbir kontrol patlamazsa tüm 13 sonuç hata alanı olmadan döner', async () => {
    mocks.personnelFindMany.mockResolvedValue([])
    mocks.personelAtamaGroupBy.mockResolvedValue([])
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.seferDilimiFindMany.mockResolvedValue([])
    mocks.aracVarsayilanFindMany.mockResolvedValue([])
    mocks.soforVarsayilanFindMany.mockResolvedValue([])
    mocks.atamaDilimFindMany.mockResolvedValue([])
    mocks.aracFindMany.mockResolvedValue([])
    mocks.soforFindMany.mockResolvedValue([])
    mocks.durakFindMany.mockResolvedValue([])
    mocks.guzergahDurakSaatFindMany.mockResolvedValue([])

    const rapor = await veriKaliteRaporuGetir()
    expect(rapor).toHaveLength(13)
    expect(rapor.every(r => r.hata === undefined)).toBe(true)
  })
})
