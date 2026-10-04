import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  aracAtamaFindMany: vi.fn(),
  personelAtamaCount: vi.fn(),
  personelAtamaFindMany: vi.fn(),
  guzergahFindMany: vi.fn(),
  dilimFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisGuzergahAracVarsayilan: { findMany: mocks.aracAtamaFindMany },
    servisPersonelAtama: { count: mocks.personelAtamaCount, findMany: mocks.personelAtamaFindMany },
    servisGuzergah: { findMany: mocks.guzergahFindMany },
    servisSeferDilimi: { findMany: mocks.dilimFindMany },
  },
}))

import {
  DOLMAK_UZERE_ESIGI,
  hesapTarihiCoz,
  kapasiteOzetiHesapla,
  kapasiteTopluOlustur,
  servisKapasiteOzetiGetir,
  servisKapasiteTopluGetir,
  tarihFiltresiOlustur,
  tarihAraligiKapsar,
  tarihBaslangiciUTC,
} from './kapasite'

beforeEach(() => vi.clearAllMocks())

describe('kapasiteOzetiHesapla — saf hesap', () => {
  it('araç kapasitelerini toplar ve boş koltuğu hesaplar', () => {
    expect(kapasiteOzetiHesapla([16, 20], 30)).toEqual({
      kapasite: 36,
      atananPersonelSayisi: 30,
      bosKoltuk: 6,
      dolulukOrani: (30 / 36) * 100,
      aracSayisi: 2,
      durum: 'UYGUN',
      asimMiktari: 0,
    })
  })

  it('kapasite aşımında negatif boş koltuğu, %100 üstü doluluğu ve aşım miktarını korur', () => {
    expect(kapasiteOzetiHesapla([16], 17)).toEqual({
      kapasite: 16,
      atananPersonelSayisi: 17,
      bosKoltuk: -1,
      dolulukOrani: 106.25,
      aracSayisi: 1,
      durum: 'ASIM',
      asimMiktari: 1,
    })
  })

  it('🔴 araç yoksa: doluluk NULL (paydasız oran sunulmaz, eskiden 0 dönüyordu), durum ARAC_YOK', () => {
    expect(kapasiteOzetiHesapla([], 0)).toEqual({
      kapasite: 0, atananPersonelSayisi: 0, bosKoltuk: 0, dolulukOrani: null, aracSayisi: 0, durum: 'ARAC_YOK', asimMiktari: 0,
    })
  })

  it('🔴 araç yokken personel varsa: doluluk NULL (eskiden 100), durum ARAC_YOK, "aşım" SAYILMAZ', () => {
    expect(kapasiteOzetiHesapla([], 3)).toEqual({
      kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, aracSayisi: 0, durum: 'ARAC_YOK', asimMiktari: 0,
    })
  })

  it('durum eşikleri: %89,9 Uygun · %90 Dolmak üzere · %100 Dolmak üzere (boş 0) · aşım', () => {
    expect(DOLMAK_UZERE_ESIGI).toBe(90)
    expect(kapasiteOzetiHesapla([1000], 899).durum).toBe('UYGUN')
    expect(kapasiteOzetiHesapla([10], 9).durum).toBe('DOLMAK_UZERE') // tam %90
    expect(kapasiteOzetiHesapla([10], 10)).toMatchObject({ durum: 'DOLMAK_UZERE', bosKoltuk: 0, asimMiktari: 0 })
    expect(kapasiteOzetiHesapla([10], 11)).toMatchObject({ durum: 'ASIM', asimMiktari: 1 })
  })

  it('kapasite 0 olan araç + personel yok: doluluk null, aşım değil', () => {
    expect(kapasiteOzetiHesapla([0], 0)).toMatchObject({ dolulukOrani: null, durum: 'UYGUN', aracSayisi: 1 })
  })

  it('boş güzergâh (araçlı, personel 0): %0 Uygun', () => {
    expect(kapasiteOzetiHesapla([15], 0)).toMatchObject({ dolulukOrani: 0, bosKoltuk: 15, durum: 'UYGUN' })
  })
})

describe('tarih filtreleme — saf hesap', () => {
  const gun = new Date('2026-09-01T15:42:00.000Z')

  it('hesap tarihini UTC gün başlangıcına indirger', () => {
    expect(tarihBaslangiciUTC(gun)).toEqual(new Date('2026-09-01T00:00:00.000Z'))
  })

  it('başlangıç ve bitiş günlerini dahil kabul eder', () => {
    expect(tarihAraligiKapsar({ baslangicTarihi: new Date('2026-09-01'), bitisTarihi: new Date('2026-09-01') }, gun)).toBe(true)
  })

  it('açık uçlu güncel kaydı kabul eder', () => {
    expect(tarihAraligiKapsar({ baslangicTarihi: new Date('2026-08-01'), bitisTarihi: null }, gun)).toBe(true)
  })

  it('gelecekte başlayan ve geçmişte biten kayıtları reddeder', () => {
    expect(tarihAraligiKapsar({ baslangicTarihi: new Date('2026-09-02'), bitisTarihi: null }, gun)).toBe(false)
    expect(tarihAraligiKapsar({ baslangicTarihi: new Date('2026-08-01'), bitisTarihi: new Date('2026-08-31') }, gun)).toBe(false)
  })
})

describe('servisKapasiteOzetiGetir — Prisma sorgusu', () => {
  it('yalnız tarih aralığındaki aktif ANA ve aktif araçları, aynı dilimdeki aktif personeli sorgular', async () => {
    mocks.aracAtamaFindMany.mockResolvedValue([{ arac: { kapasite: 16 } }, { arac: { kapasite: 20 } }])
    mocks.personelAtamaCount.mockResolvedValue(37)
    const gun = new Date('2026-09-01T18:00:00.000Z')

    await expect(servisKapasiteOzetiGetir('g1', 'd1', gun)).resolves.toEqual({
      kapasite: 36, atananPersonelSayisi: 37, bosKoltuk: -1, dolulukOrani: (37 / 36) * 100,
      aracSayisi: 2, durum: 'ASIM', asimMiktari: 1,
    })

    const tarih = {
      baslangicTarihi: { lte: new Date('2026-09-01T00:00:00.000Z') },
      OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: new Date('2026-09-01T00:00:00.000Z') } }],
    }
    expect(mocks.aracAtamaFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'g1', dilimId: 'd1', rol: 'ANA', aktif: true, arac: { aktif: true }, ...tarih },
      select: { arac: { select: { kapasite: true } } },
    })
    expect(mocks.personelAtamaCount).toHaveBeenCalledWith({
      where: { guzergahId: 'g1', aktif: true, dilimler: { some: { dilimId: 'd1' } }, ...tarih },
    })
  })
})


// ============================================================================
// B1 — TOPLU HESAP (güzergâh × dilim çiftleri, güzergâh satırı, toplamlar)
// ============================================================================
const G = (id: string, kod: string, ad = `${kod} Hattı`) => ({ id, kod, ad })
const SABAH = { id: 'd1', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi' }
const AKSAM = { id: 'd2', kod: 'AKSAM_DONUS', ad: 'Akşam Servisi' }
const arac = (g: string, d: string, plaka: string, kapasite: number) => ({ guzergahId: g, dilimId: d, plaka, kapasite })
const kisiler = (g: string, dilimler: string[], adet: number) =>
  Array.from({ length: adet }, () => ({ guzergahId: g, dilimIdleri: dilimler }))

describe('kapasiteTopluOlustur — saf çekirdek', () => {
  it('güzergâh başına koltuk/personel/boş/doluluk/durum (tek dilim)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'DARICA')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', '41P0145', 15), arac('g1', 'd1', '41P0327', 27)],
      personelAtamalari: kisiler('g1', ['d1'], 30),
    }, '2026-10-03')
    expect(r.guzergahlar).toHaveLength(1)
    expect(r.guzergahlar[0]).toMatchObject({
      kod: 'DARICA', dilimKod: 'SABAH_GIDIS', dilimSayisi: 1, aracliDilimSayisi: 1, araclar: ['41P0145', '41P0327'],
      ozet: { kapasite: 42, atananPersonelSayisi: 30, bosKoltuk: 12, durum: 'UYGUN' },
    })
    expect(r.tarih).toBe('2026-10-03')
  })

  it('🔴 AŞIM: personel > koltuk → durum ASIM, aşım listesinde kişi/koltuk/+fazla', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'DARICA', 'Darıca Hattı')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', '41P0145', 15)],
      personelAtamalari: kisiler('g1', ['d1'], 18),
    }, '2026-10-03')
    expect(r.guzergahlar[0].ozet).toMatchObject({ durum: 'ASIM', bosKoltuk: -3, asimMiktari: 3 })
    expect(r.asimlar).toEqual([{ guzergahId: 'g1', kod: 'DARICA', ad: 'Darıca Hattı', dilimKod: 'SABAH_GIDIS', koltuk: 15, personel: 18, fazla: 3 }])
    expect(r.toplam).toMatchObject({ asimSayisi: 1, asimKisi: 3 })
  })

  it('🔴 ARAÇ YOK: aracı olmayan güzergâh durum ARAC_YOK; koltuk/boş toplamlara GİRMEZ; personeli atanmışa girer', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A'), G('g2', 'B')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', '41P0145', 20)],
      personelAtamalari: [...kisiler('g1', ['d1'], 10), ...kisiler('g2', ['d1'], 4)],
    }, '2026-10-03')
    const b = r.guzergahlar.find((g) => g.kod === 'B')!
    expect(b.ozet).toMatchObject({ durum: 'ARAC_YOK', dolulukOrani: null, atananPersonelSayisi: 4, aracSayisi: 0 })
    expect(b.aracliDilimSayisi).toBe(0)
    expect(r.toplam).toMatchObject({
      guzergahSayisi: 2, atanmisPersonel: 14, toplamKoltuk: 20, netBosKoltuk: 10, aracsizGuzergahSayisi: 1, asimSayisi: 0,
    })
    expect(r.asimlar).toEqual([]) // araçsız güzergâh aşım listesine DÜŞMEZ
  })

  it('hiçbir atama yok: güzergâh ARAC_YOK, personel 0, dilimKod null', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH, AKSAM], aracAtamalari: [], personelAtamalari: [] }, '2026-10-03')
    expect(r.guzergahlar[0]).toMatchObject({ dilimKod: null, dilimSayisi: 0, aracliDilimSayisi: 0, ozet: { durum: 'ARAC_YOK', atananPersonelSayisi: 0 } })
  })

  it('🔴 Boş koltuk KPI: aşımlar DÜŞÜLMÜŞ NET (+10 ve −3 → +7)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A'), G('g2', 'B')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20), arac('g2', 'd1', 'X2', 15)],
      personelAtamalari: [...kisiler('g1', ['d1'], 10), ...kisiler('g2', ['d1'], 18)],
    }, '2026-10-03')
    expect(r.toplam).toMatchObject({ toplamKoltuk: 35, atanmisPersonel: 28, netBosKoltuk: 7, asimSayisi: 1, asimKisi: 3 })
  })

  it('dolmak üzere sayısı (≥%90, aşım değil)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A'), G('g2', 'B'), G('g3', 'C')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', 'X1', 10), arac('g2', 'd1', 'X2', 10), arac('g3', 'd1', 'X3', 10)],
      personelAtamalari: [...kisiler('g1', ['d1'], 9), ...kisiler('g2', ['d1'], 10), ...kisiler('g3', ['d1'], 5)],
    }, '2026-10-03')
    expect(r.toplam.dolmakUzereSayisi).toBe(2)
    expect(r.guzergahlar.map((g) => g.ozet.durum)).toEqual(['DOLMAK_UZERE', 'DOLMAK_UZERE', 'UYGUN'])
  })

  it('🔴 iki dilim: güzergâh satırı EN DAR dilimdir (sabah uygun, akşam aşım → ASIM, dilimKod AKSAM)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')],
      dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20), arac('g1', 'd2', 'X2', 10)],
      personelAtamalari: [...kisiler('g1', ['d1', 'd2'], 12)],
    }, '2026-10-03')
    expect(r.guzergahlar[0]).toMatchObject({ dilimKod: 'AKSAM_DONUS', dilimSayisi: 2, aracliDilimSayisi: 2, araclar: ['X2'], ozet: { durum: 'ASIM', asimMiktari: 2 } })
    expect(r.dilimSatirlari).toHaveLength(2)
    expect(r.dilimSatirlari.find((d) => d.dilimKod === 'SABAH_GIDIS')!.ozet.durum).toBe('UYGUN')
  })

  it('personel yalnız bir dilimde: o dilim hesaplanır; aracı olmayan diğer dilim satırı belirlemez', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')],
      dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20)],
      personelAtamalari: kisiler('g1', ['d1'], 5),
    }, '2026-10-03')
    expect(r.guzergahlar[0]).toMatchObject({ dilimKod: 'SABAH_GIDIS', dilimSayisi: 1, ozet: { kapasite: 20, atananPersonelSayisi: 5 } })
  })

  it('araçlı dilimde araç var + başka dilimde personel araçsız: araçsız-personelli dilim önceliklidir (sessiz kalmaz)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')],
      dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20)],
      personelAtamalari: [...kisiler('g1', ['d1'], 5), ...kisiler('g1', ['d2'], 3)],
    }, '2026-10-03')
    expect(r.guzergahlar[0]).toMatchObject({ dilimKod: 'AKSAM_DONUS', aracliDilimSayisi: 1, ozet: { durum: 'ARAC_YOK', atananPersonelSayisi: 3 } })
  })

  it('aynı atama aynı dilimi iki kez içerse bile bir kişi tek sayılır', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20)],
      personelAtamalari: [{ guzergahId: 'g1', dilimIdleri: ['d1', 'd1'] }],
    }, '2026-10-03')
    expect(r.guzergahlar[0].ozet.atananPersonelSayisi).toBe(1)
  })

  it('aşım listesi fazlaya göre azalan, eşitlikte Türkçe kod sırası', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'ÇAYIROVA'), G('g2', 'ARAPÇEŞME'), G('g3', 'DARICA')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', 'X1', 10), arac('g2', 'd1', 'X2', 10), arac('g3', 'd1', 'X3', 10)],
      personelAtamalari: [...kisiler('g1', ['d1'], 13), ...kisiler('g2', ['d1'], 13), ...kisiler('g3', ['d1'], 15)],
    }, '2026-10-03')
    expect(r.asimlar.map((a) => [a.kod, a.fazla])).toEqual([['DARICA', 5], ['ARAPÇEŞME', 3], ['ÇAYIROVA', 3]])
  })

  it('güzergâh sırası girdi sırasını korur (kod sıralaması DB sorgusundadır)', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g2', 'B'), G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [], personelAtamalari: [] }, '2026-10-03')
    expect(r.guzergahlar.map((g) => g.kod)).toEqual(['B', 'A'])
  })
})

describe('servisKapasiteTopluGetir — tek-çift fonksiyonla AYNI filtre ve AYNI hesap', () => {
  const GUN = new Date('2026-09-01T18:00:00.000Z')

  it('🔴 aynı tarih filtresi (tarihFiltresiOlustur): tek-çift ve toplu sorgu birebir aynı where parçasını kullanır', async () => {
    mocks.aracAtamaFindMany.mockResolvedValue([])
    mocks.personelAtamaCount.mockResolvedValue(0)
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.dilimFindMany.mockResolvedValue([])
    await servisKapasiteOzetiGetir('g1', 'd1', GUN)
    await servisKapasiteTopluGetir(GUN)

    const tek = mocks.aracAtamaFindMany.mock.calls[0][0].where
    const toplu = mocks.aracAtamaFindMany.mock.calls[1][0].where
    const filtre = tarihFiltresiOlustur(new Date('2026-09-01T00:00:00.000Z'))
    expect(tek).toMatchObject({ rol: 'ANA', aktif: true, arac: { aktif: true }, ...filtre })
    expect(toplu).toEqual({ rol: 'ANA', aktif: true, arac: { aktif: true }, ...filtre })
    expect(mocks.personelAtamaFindMany.mock.calls[0][0].where).toEqual({ aktif: true, ...filtre })
    expect(mocks.personelAtamaCount.mock.calls[0][0].where).toMatchObject({ aktif: true, ...filtre })
  })

  it('🔴 tutarlılık: aynı veri için toplu sonuç, tek-çift fonksiyonun sonucuyla BİREBİR aynı', async () => {
    // g1: sabah 2 araç (16+20) / 37 kişi → aşım; g2: akşam 1 araç (27) / 5 kişi.
    const araclar = [
      { guzergahId: 'g1', dilimId: 'd1', arac: { plaka: '41A1', kapasite: 16 } },
      { guzergahId: 'g1', dilimId: 'd1', arac: { plaka: '41A2', kapasite: 20 } },
      { guzergahId: 'g2', dilimId: 'd2', arac: { plaka: '41B1', kapasite: 27 } },
    ]
    const personel = [
      ...Array.from({ length: 37 }, (_, i) => ({ id: `p1-${i}`, guzergahId: 'g1', baslangicTarihi: new Date('2026-08-01'), atamaKaynagi: 'MANUEL', dilimler: [{ dilimId: 'd1' }] })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `p2-${i}`, guzergahId: 'g2', baslangicTarihi: new Date('2026-08-01'), atamaKaynagi: 'MANUEL', dilimler: [{ dilimId: 'd2' }] })),
    ]
    mocks.guzergahFindMany.mockResolvedValue([G('g1', 'A'), G('g2', 'B')])
    mocks.dilimFindMany.mockResolvedValue([SABAH, AKSAM])
    mocks.aracAtamaFindMany.mockImplementation(async ({ where }: { where: { guzergahId?: string; dilimId?: string } }) =>
      araclar.filter((a) => (!where.guzergahId || a.guzergahId === where.guzergahId) && (!where.dilimId || a.dilimId === where.dilimId)).map((a) => ({ ...a })))
    mocks.personelAtamaFindMany.mockResolvedValue(personel)
    mocks.personelAtamaCount.mockImplementation(async ({ where }: { where: { guzergahId: string; dilimler: { some: { dilimId: string } } } }) =>
      personel.filter((p) => p.guzergahId === where.guzergahId && p.dilimler.some((d) => d.dilimId === where.dilimler.some.dilimId)).length)

    const toplu = await servisKapasiteTopluGetir(GUN)
    const tek1 = await servisKapasiteOzetiGetir('g1', 'd1', GUN)
    const tek2 = await servisKapasiteOzetiGetir('g2', 'd2', GUN)
    expect(toplu.dilimSatirlari.find((s) => s.guzergahId === 'g1' && s.dilimId === 'd1')!.ozet).toEqual(tek1)
    expect(toplu.dilimSatirlari.find((s) => s.guzergahId === 'g2' && s.dilimId === 'd2')!.ozet).toEqual(tek2)
    expect(tek1).toMatchObject({ kapasite: 36, atananPersonelSayisi: 37, durum: 'ASIM', asimMiktari: 1 })
    expect(toplu.toplam).toMatchObject({ asimSayisi: 1, asimKisi: 1, toplamKoltuk: 63 })
    expect(toplu.tarih).toBe('2026-09-01')
  })

  it('🔴 KVKK: personel atamasından yalnız teknik kimlikler seçilir (personnelId yalnız tekil sayım için; ad/sicil/telefon yok)', async () => {
    mocks.aracAtamaFindMany.mockResolvedValue([])
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.dilimFindMany.mockResolvedValue([])
    await servisKapasiteTopluGetir(GUN)
    expect(mocks.personelAtamaFindMany.mock.calls[0][0].select).toEqual({
      id: true, personnelId: true, guzergahId: true, baslangicTarihi: true, atamaKaynagi: true, dilimler: { select: { dilimId: true } },
    })
    // plaka/kapasite dışında araç alanı seçilmez
    expect(mocks.aracAtamaFindMany.mock.calls[0][0].select).toEqual({
      guzergahId: true, dilimId: true, arac: { select: { plaka: true, kapasite: true } },
    })
  })

  it('yalnız AKTİF güzergâh ve AKTİF dilimler; kod sırası; tek güzergâh filtresi detay kartları içindir', async () => {
    mocks.aracAtamaFindMany.mockResolvedValue([])
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.dilimFindMany.mockResolvedValue([])
    await servisKapasiteTopluGetir(GUN, { guzergahId: 'g7' })
    expect(mocks.guzergahFindMany).toHaveBeenCalledWith({ where: { aktif: true, id: 'g7' }, select: { id: true, kod: true, ad: true }, orderBy: { kod: 'asc' } })
    expect(mocks.dilimFindMany).toHaveBeenCalledWith({ where: { aktif: true }, select: { id: true, kod: true, ad: true }, orderBy: { sira: 'asc' } })
    expect(mocks.aracAtamaFindMany.mock.calls[0][0].where).toMatchObject({ guzergahId: 'g7' })
    expect(mocks.personelAtamaFindMany.mock.calls[0][0].where).toMatchObject({ guzergahId: 'g7' })
  })
})

describe('hesapTarihiCoz', () => {
  it('geçerli YYYY-MM-DD UTC günü olarak çözülür', () => {
    expect(hesapTarihiCoz('2026-03-05').toISOString()).toBe('2026-03-05T00:00:00.000Z')
  })
  it('null/boş → bugün (Date)', () => {
    expect(hesapTarihiCoz(null)).toBeInstanceOf(Date)
    expect(hesapTarihiCoz('  ')).toBeInstanceOf(Date)
  })
  it('geçersiz biçim ve olmayan gün hata verir', () => {
    expect(() => hesapTarihiCoz('05.03.2026')).toThrow()
    expect(() => hesapTarihiCoz('2026-02-31')).toThrow()
  })
})

describe('B4 — dilim bağlantısı olmayan atama (kural DEĞİŞMEZ: kapasiteye girmez, ayrıca raporlanır)', () => {
  const dilimsiz = (guzergahId: string, n: number, kaynak = 'IMPORT') =>
    Array.from({ length: n }, (_, i) => ({
      guzergahId, dilimIdleri: [] as string[], atamaId: `${guzergahId}-dilimsiz-${i}`, baslangicTarihi: '2026-09-27', kaynak,
    }))

  it('N = 0: dilimsizAtamalar boş, sayaç 0', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [arac('g1', 'd1', 'X1', 10)], personelAtamalari: kisiler('g1', ['d1'], 4) }, '2026-10-03')
    expect(r.dilimsizAtamalar).toEqual([])
    expect(r.toplam.dilimsizAtamaSayisi).toBe(0)
  })

  it('🔴 N > 0: dilimsiz atamalar kapasiteye/KPI\'ya GİRMEZ ama sayılır ve listelenir', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'DARICA', 'Darıca'), G('g2', 'ÜSKÜDAR', 'Üsküdar')],
      dilimler: [SABAH],
      aracAtamalari: [arac('g1', 'd1', 'X1', 10)],
      personelAtamalari: [...kisiler('g1', ['d1'], 4), ...dilimsiz('g1', 2), ...dilimsiz('g2', 3)],
    }, '2026-10-03')
    // Motor kuralı aynı: yalnız dilim bağlantılı 4 personel sayılır
    expect(r.guzergahlar[0].ozet).toMatchObject({ atananPersonelSayisi: 4, kapasite: 10, bosKoltuk: 6 })
    expect(r.guzergahlar[1].ozet).toMatchObject({ atananPersonelSayisi: 0, durum: 'ARAC_YOK' })
    // KPI TEKİL KİŞİ: 4 dilimli + 5 dilimsiz = 9 (dilimsizler KPI'a girer, kapasiteye girmez)
    expect(r.toplam.atanmisPersonel).toBe(9)
    expect(r.guzergahlar.map((g) => g.tekilPersonel)).toEqual([6, 3])
    expect(r.toplam.dilimsizAtamaSayisi).toBe(5)
    expect(r.dilimsizAtamalar).toHaveLength(5)
    expect(r.dilimsizAtamalar[0]).toEqual({
      atamaId: 'g1-dilimsiz-0', guzergahId: 'g1', kod: 'DARICA', ad: 'Darıca', baslangicTarihi: '2026-09-27', kaynak: 'IMPORT',
    })
    // Türkçe sıralama: DARICA, ÜSKÜDAR (Ü, D'den sonra)
    expect(r.dilimsizAtamalar.map((a) => a.kod)).toEqual(['DARICA', 'DARICA', 'ÜSKÜDAR', 'ÜSKÜDAR', 'ÜSKÜDAR'])
  })

  it('aktif güzergâh listesinde olmayan (pasif) güzergâhın dilimsiz ataması listeye girmez', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [], personelAtamalari: dilimsiz('gPasif', 3) }, '2026-10-03')
    expect(r.dilimsizAtamalar).toEqual([])
  })

  it('tekrarlı dilimId dilimsiz SAYILMAZ; boş dizi sayılır', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [],
      personelAtamalari: [{ guzergahId: 'g1', dilimIdleri: ['d1', 'd1'] }, { guzergahId: 'g1', dilimIdleri: [] }],
    }, '2026-10-03')
    expect(r.toplam.dilimsizAtamaSayisi).toBe(1)
  })
})

describe('B4 — motor toplama kuralı (belgeleyen testler: panelde "Personel" ne gösterir)', () => {
  it('🔴 1 kişi hem SABAH hem AKŞAM bağlı: her dilimde 1; güzergâh satırı 1; KPI 1 (2 DEĞİL)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 10), arac('g1', 'd2', 'X1', 10)],
      personelAtamalari: kisiler('g1', ['d1', 'd2'], 1),
    }, '2026-10-03')
    expect(r.dilimSatirlari.map((s) => s.ozet.atananPersonelSayisi)).toEqual([1, 1])
    expect(r.guzergahlar[0].ozet.atananPersonelSayisi).toBe(1)
    expect(r.toplam.atanmisPersonel).toBe(1)
  })

  it('🔴 5 yalnız-SABAH + 5 yalnız-AKŞAM AYRI kişi: KPI 10 (tekil), güzergâh satırı 5 (en dar dilim)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 10), arac('g1', 'd2', 'X1', 10)],
      personelAtamalari: [...kisiler('g1', ['d1'], 5), ...kisiler('g1', ['d2'], 5)],
    }, '2026-10-03')
    expect(r.guzergahlar[0].ozet.atananPersonelSayisi).toBe(5)
    expect(r.guzergahlar[0].tekilPersonel).toBe(10)
    expect(r.toplam.atanmisPersonel).toBe(10)
  })

  it('satır seçimi öncelikle: araçsız ama personelli dilim, uygun dilimin önüne geçer (satır araçsız dilimin personelini gösterir)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH, AKSAM],
      aracAtamalari: [arac('g1', 'd1', 'X1', 20)],
      personelAtamalari: [...kisiler('g1', ['d1'], 8), ...kisiler('g1', ['d2'], 12)],
    }, '2026-10-03')
    expect(r.guzergahlar[0]).toMatchObject({ dilimKod: 'AKSAM_DONUS', ozet: { durum: 'ARAC_YOK', atananPersonelSayisi: 12 } })
  })
})

describe('B6 — KPI "Atanmış personel" = TEKİL kişi', () => {
  const P = (personnelId: string, guzergahId: string, dilimIdleri: string[]) => ({ personnelId, guzergahId, dilimIdleri })

  it('aynı kişi (personnelId) birden çok atamada/güzergâhta bir kez sayılır', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A'), G('g2', 'B')], dilimler: [SABAH, AKSAM], aracAtamalari: [],
      personelAtamalari: [P('k1', 'g1', ['d1']), P('k1', 'g1', ['d2']), P('k1', 'g2', ['d1']), P('k2', 'g2', [])],
    }, '2026-10-03')
    expect(r.toplam.atanmisPersonel).toBe(2) // k1, k2
    expect(r.guzergahlar.map((g) => g.tekilPersonel)).toEqual([1, 2])
  })

  it('dilimsiz kişi KPI\'a girer, satır/dilim kapasitesine girmez', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [arac('g1', 'd1', 'X1', 10)],
      personelAtamalari: [P('k1', 'g1', ['d1']), P('k2', 'g1', [])],
    }, '2026-10-03')
    expect(r.toplam.atanmisPersonel).toBe(2)
    expect(r.guzergahlar[0].ozet.atananPersonelSayisi).toBe(1)
    expect(r.guzergahlar[0].ozet.bosKoltuk).toBe(9)
    expect(r.toplam.dilimsizAtamaSayisi).toBe(1)
  })

  it('pasif güzergâhın atamaları KPI\'a girmez (panel yalnız aktif güzergâhları gösterir)', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [], personelAtamalari: [P('k1', 'gPasif', ['d1'])] }, '2026-10-03')
    expect(r.toplam.atanmisPersonel).toBe(0)
  })

  it('boş durum: atama yok → KPI 0, güzergâh tekil 0', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [], personelAtamalari: [] }, '2026-10-03')
    expect(r.toplam.atanmisPersonel).toBe(0)
    expect(r.guzergahlar[0].tekilPersonel).toBe(0)
  })

  it('kimlik yoksa (eski çağrı) her atama ayrı kişi sayılır', () => {
    const r = kapasiteTopluOlustur({ guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [], personelAtamalari: kisiler('g1', ['d1'], 3) }, '2026-10-03')
    expect(r.toplam.atanmisPersonel).toBe(3)
  })

  it('🔴 KVKK: personnelId çıktıda YOK (JSON taraması)', () => {
    const r = kapasiteTopluOlustur({
      guzergahlar: [G('g1', 'A')], dilimler: [SABAH], aracAtamalari: [],
      personelAtamalari: [P('gizli-personel-id-123', 'g1', ['d1']), P('gizli-personel-id-456', 'g1', [])],
    }, '2026-10-03')
    expect(JSON.stringify(r)).not.toContain('gizli-personel-id')
  })

  it('🔴 pasif / süresi dolmuş atama KPI\'a girmez: sorgu aktif:true + hesap günü tarih filtresiyle yapılır (tek-çiftle AYNI)', async () => {
    mocks.aracAtamaFindMany.mockResolvedValue([])
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.dilimFindMany.mockResolvedValue([])
    const GUN_B6 = new Date('2026-09-01T00:00:00Z')
    await servisKapasiteTopluGetir(GUN_B6)
    const where = mocks.personelAtamaFindMany.mock.calls[0][0].where
    expect(where.aktif).toBe(true)
    expect(where.baslangicTarihi).toEqual({ lte: tarihBaslangiciUTC(GUN_B6) })
    expect(where.OR).toEqual([{ bitisTarihi: null }, { bitisTarihi: { gte: tarihBaslangiciUTC(GUN_B6) } }])
  })
})

describe('C7-8 — varsayılan hesap günü Türkiye günü', () => {
  afterEach(() => vi.useRealTimers())
  it('🔴 UTC 22:30 = TR ertesi gün: tek-çift ve toplu varsayılan tarihi TR günü', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T22:30:00.000Z'))
    mocks.aracAtamaFindMany.mockResolvedValue([])
    mocks.personelAtamaCount.mockResolvedValue(0)
    mocks.personelAtamaFindMany.mockResolvedValue([])
    mocks.guzergahFindMany.mockResolvedValue([])
    mocks.dilimFindMany.mockResolvedValue([])
    await servisKapasiteOzetiGetir('g1', 'd1')
    await servisKapasiteTopluGetir()
    const beklenen = { lte: new Date('2026-10-04T00:00:00.000Z') }
    expect(mocks.aracAtamaFindMany.mock.calls[0][0].where.baslangicTarihi).toEqual(beklenen)
    expect(mocks.aracAtamaFindMany.mock.calls[1][0].where.baslangicTarihi).toEqual(beklenen)
    expect(mocks.personelAtamaCount.mock.calls[0][0].where.baslangicTarihi).toEqual(beklenen)
  })
})
