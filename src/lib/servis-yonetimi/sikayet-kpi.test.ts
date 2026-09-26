import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  groupBy: vi.fn(),
  findMany: vi.fn(),
  gecmisFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisSikayet: { count: mocks.count, groupBy: mocks.groupBy, findMany: mocks.findMany },
    servisIslemGecmisi: { findMany: mocks.gecmisFindMany },
  },
}))

import { sikayetKpiHesapla } from './sikayet-kpi'

const G = new Date('2026-09-01T00:00:00.000Z')

/** groupBy çağrılarını `by` alanına göre dağıtan yardımcı. */
function groupByKur(durum: unknown[] = [], kategori: unknown[] = [], durak: unknown[] = []) {
  mocks.groupBy.mockImplementation(async (a: { by: string[] }) => {
    if (a.by[0] === 'durum') return durum
    if (a.by[0] === 'kategori') return kategori
    if (a.by[0] === 'durakId') return durak
    return []
  })
}

/** count çağrıları sırayla: toplam (reddedilen hariç), reddedilen. */
function countKur(toplam: number, reddedilen: number) {
  mocks.count.mockResolvedValueOnce(toplam).mockResolvedValueOnce(reddedilen)
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  countKur(0, 0)
  groupByKur()
  mocks.findMany.mockResolvedValue([])
  mocks.gecmisFindMany.mockResolvedValue([])
})

// ----------------------------------------------------------------------------
// 🔴 REDDEDILDI firmayı cezalandırmaz
// ----------------------------------------------------------------------------
describe('REDDEDILDI toplama DAHİL DEĞİL', () => {
  it('🔴 toplam sorgusu durum != REDDEDILDI ile çalışıyor', async () => {
    await sikayetKpiHesapla({ firmaId: 'f1' })
    const toplamWhere = mocks.count.mock.calls[0][0].where
    expect(toplamWhere.durum).toEqual({ not: 'REDDEDILDI' })
    expect(toplamWhere.firmaId).toBe('f1')
  })

  it('🔴 reddedilen AYRI sayılıyor ve ayrı alanda dönüyor', async () => {
    mocks.count.mockReset()
    countKur(7, 3)
    const kpi = await sikayetKpiHesapla({})

    expect(mocks.count.mock.calls[1][0].where.durum).toBe('REDDEDILDI')
    expect(kpi.toplamSikayet).toBe(7)
    expect(kpi.reddedilenSayisi).toBe(3)
    // Toplam, reddedileni İÇERMİYOR
    expect(kpi.toplamSikayet).not.toBe(10)
  })

  it('kategori ve durak kırılımları da reddedileni dışlıyor', async () => {
    await sikayetKpiHesapla({})
    const cagrilar = mocks.groupBy.mock.calls.map(c => c[0])
    const kategori = cagrilar.find(c => c.by[0] === 'kategori')
    const durak = cagrilar.find(c => c.by[0] === 'durakId')
    expect(kategori.where.durum).toEqual({ not: 'REDDEDILDI' })
    expect(durak.where.durum).toEqual({ not: 'REDDEDILDI' })
  })

  it('durum kırılımı TÜM durumları gösterir (dağılım amacıyla)', async () => {
    await sikayetKpiHesapla({})
    const durum = mocks.groupBy.mock.calls.map(c => c[0]).find(c => c.by[0] === 'durum')
    expect(durum.where.durum).toBeUndefined()
  })

  it('çağıran açıkça durum filtrelediyse ona saygı duyulur', async () => {
    await sikayetKpiHesapla({ durum: 'REDDEDILDI' })
    expect(mocks.count.mock.calls[0][0].where.durum).toBe('REDDEDILDI')
  })
})

// ----------------------------------------------------------------------------
// Kırılımlar
// ----------------------------------------------------------------------------
describe('kırılımlar', () => {
  it('durum kırılımı dört durumu da taşıyor', async () => {
    groupByKur([
      { durum: 'ACIK', _count: { _all: 4 } },
      { durum: 'AKSIYON_ALINDI', _count: { _all: 3 } },
      { durum: 'KAPANDI', _count: { _all: 2 } },
      { durum: 'REDDEDILDI', _count: { _all: 1 } },
    ])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.durumKirilim).toEqual([
      { durum: 'ACIK', adet: 4 },
      { durum: 'AKSIYON_ALINDI', adet: 3 },
      { durum: 'KAPANDI', adet: 2 },
      { durum: 'REDDEDILDI', adet: 1 },
    ])
  })

  it('kategori kırılımı', async () => {
    groupByKur([], [
      { kategori: 'GEC_GELME', _count: { _all: 5 } },
      { kategori: 'TEMIZLIK', _count: { _all: 2 } },
    ])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.kategoriKirilim).toEqual([
      { kategori: 'GEC_GELME', adet: 5 },
      { kategori: 'TEMIZLIK', adet: 2 },
    ])
  })

  it('🟢 DURAK kırılımı — durakId ölçülebiliyor, null durak da ayrı grup', async () => {
    groupByKur([], [], [
      { durakId: 'd1', _count: { _all: 6 } },
      { durakId: null, _count: { _all: 2 } },
    ])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.durakKirilim).toEqual([
      { durakId: 'd1', adet: 6 },
      { durakId: null, adet: 2 },
    ])
  })
})

// ----------------------------------------------------------------------------
// 🔴 Ortalama kapanış süresi — YALNIZ KAPANDI, paydası açık
// ----------------------------------------------------------------------------
describe('ortalama kapanış süresi', () => {
  it('🔴 sorgu YALNIZ KAPANDI kayıtlarını çekiyor (reddedilen girmiyor)', async () => {
    await sikayetKpiHesapla({})
    const w = mocks.findMany.mock.calls[0][0].where
    expect(w.durum).toBe('KAPANDI')
    expect(w.kapanisTarihi).toEqual({ not: null })
  })

  it('gün cinsinden ortalama ve PAYDA birlikte dönüyor', async () => {
    mocks.findMany.mockResolvedValue([
      { bildirimTarihi: G, kapanisTarihi: new Date('2026-09-03T00:00:00.000Z') }, // 2 gün
      { bildirimTarihi: G, kapanisTarihi: new Date('2026-09-05T00:00:00.000Z') }, // 4 gün
    ])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.ortalamaKapanisGunu).toBe(3)
    expect(kpi.kapananKayitSayisi).toBe(2)
  })

  it('kapanan kayıt yoksa ortalama null, payda 0 (sıfıra bölme yok)', async () => {
    mocks.findMany.mockResolvedValue([])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.ortalamaKapanisGunu).toBeNull()
    expect(kpi.kapananKayitSayisi).toBe(0)
  })

  it('yalnız iki tarih kolonu seçiliyor — kişisel veri çekilmiyor', async () => {
    await sikayetKpiHesapla({})
    expect(Object.keys(mocks.findMany.mock.calls[0][0].select).sort())
      .toEqual(['bildirimTarihi', 'kapanisTarihi'])
  })
})

// ----------------------------------------------------------------------------
// Yeniden açılan kayıtlar — TARİHÇEDEN
// ----------------------------------------------------------------------------
describe('yeniden açılan kayıt sayısı', () => {
  it('🔴 sayım ServisIslemGecmisi\'nden, SIKAYET hedefiyle', async () => {
    await sikayetKpiHesapla({})
    const w = mocks.gecmisFindMany.mock.calls[0][0].where
    expect(w.hedefTipi).toBe('SIKAYET')
  })

  it('yalnız KAPANDI/REDDEDILDI → ACIK geçişleri sayılıyor', async () => {
    await sikayetKpiHesapla({})
    const w = mocks.gecmisFindMany.mock.calls[0][0].where
    expect(w.yeniDeger).toEqual({ path: ['durum'], equals: 'ACIK' })
    expect(w.OR).toEqual([
      { oncekiDeger: { path: ['durum'], equals: 'KAPANDI' } },
      { oncekiDeger: { path: ['durum'], equals: 'REDDEDILDI' } },
    ])
  })

  it('aynı kayıt iki kez açılsa bir kez sayılır (distinct hedefId)', async () => {
    await sikayetKpiHesapla({})
    expect(mocks.gecmisFindMany.mock.calls[0][0].distinct).toEqual(['hedefId'])
  })

  it('dönen ayrı kayıt sayısı raporlanıyor', async () => {
    mocks.gecmisFindMany.mockResolvedValue([{ hedefId: 's1' }, { hedefId: 's2' }])
    const kpi = await sikayetKpiHesapla({})
    expect(kpi.yenidenAcilanSayisi).toBe(2)
  })
})

// ----------------------------------------------------------------------------
// 🔴 Ders 79 — oran/yüzde ÜRETİLMİYOR
// ----------------------------------------------------------------------------
describe('oran/yüzde üretilmiyor (Ders 79)', () => {
  it('🔴 sonuçta oran/yüzde anlamına gelen HİÇBİR alan yok', async () => {
    mocks.count.mockReset()
    countKur(10, 2)
    mocks.findMany.mockResolvedValue([{ bildirimTarihi: G, kapanisTarihi: new Date('2026-09-03T00:00:00.000Z') }])
    const kpi = await sikayetKpiHesapla({})

    const anahtarlar = Object.keys(kpi)
    expect(anahtarlar.filter(k => /oran|yuzde|yüzde|percent|rate|ratio/i.test(k))).toEqual([])

    // Kırılım nesnelerinde de yok
    for (const dizi of [kpi.durumKirilim, kpi.kategoriKirilim, kpi.durakKirilim]) {
      for (const satir of dizi) {
        expect(Object.keys(satir).filter(k => /oran|yuzde|percent|rate/i.test(k))).toEqual([])
      }
    }
  })

  it('tüm sayısal ölçüler MUTLAK — ortalama hariç, onun da paydası açık', async () => {
    mocks.count.mockReset()
    countKur(10, 2)
    const kpi = await sikayetKpiHesapla({})

    expect(Number.isInteger(kpi.toplamSikayet)).toBe(true)
    expect(Number.isInteger(kpi.reddedilenSayisi)).toBe(true)
    expect(Number.isInteger(kpi.yenidenAcilanSayisi)).toBe(true)
    // Ortalamanın paydası ayrı alanda — "N kapanan kayıt üzerinden"
    expect(kpi).toHaveProperty('kapananKayitSayisi')
  })
})

// ----------------------------------------------------------------------------
// Filtreler
// ----------------------------------------------------------------------------
describe('filtreler tüm sorgulara iletiliyor', () => {
  it('firmaId ve tarih aralığı where\'e giriyor', async () => {
    const bas = new Date('2026-09-01')
    await sikayetKpiHesapla({ firmaId: 'f1', bildirimBaslangic: bas })

    expect(mocks.count.mock.calls[0][0].where.firmaId).toBe('f1')
    expect(mocks.count.mock.calls[0][0].where.bildirimTarihi).toEqual({ gte: bas })
    expect(mocks.findMany.mock.calls[0][0].where.firmaId).toBe('f1')
  })
})

// ----------------------------------------------------------------------------
// Ortalama hesabının satır kümesi filtreyle SINIRLI (JS'te kalmasının şartı)
// ----------------------------------------------------------------------------
describe('ortalama kapanış — satır kümesi sınırlı', () => {
  it('🔴 tarih aralığı filtresi kapanan-kayıt sorgusuna da uygulanıyor', async () => {
    const bas = new Date('2026-09-01')
    const bit = new Date('2026-09-30')
    await sikayetKpiHesapla({ bildirimBaslangic: bas, bildirimBitis: bit })

    const w = mocks.findMany.mock.calls[0][0].where
    expect(w.bildirimTarihi).toEqual({ gte: bas, lte: bit })
    expect(w.durum).toBe('KAPANDI')
  })

  it('firma filtresi de uygulanıyor — tüm firmaların kayıtları çekilmiyor', async () => {
    await sikayetKpiHesapla({ firmaId: 'f1' })
    expect(mocks.findMany.mock.calls[0][0].where.firmaId).toBe('f1')
  })
})
