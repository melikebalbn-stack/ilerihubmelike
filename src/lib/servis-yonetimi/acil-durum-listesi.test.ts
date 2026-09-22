import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  guzergahFindUnique: vi.fn(),
  dilimFindUnique: vi.fn(),
  durakSaatCount: vi.fn(),
  guzergahDurakFindMany: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  sorumluFindMany: vi.fn(),
  firmaFindMany: vi.fn(),
  operasyonelServisListesiGetir: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisGuzergah: { findUnique: mocks.guzergahFindUnique },
    servisSeferDilimi: { findUnique: mocks.dilimFindUnique },
    servisGuzergahDurakSaat: { count: mocks.durakSaatCount },
    servisGuzergahDurak: { findMany: mocks.guzergahDurakFindMany },
    servisGuzergahAracVarsayilan: { findMany: mocks.aracVarsayilanFindMany },
    servisGuzergahSoforVarsayilan: { findMany: mocks.soforVarsayilanFindMany },
    servisSorumlusu: { findMany: mocks.sorumluFindMany },
    servisFirma: { findMany: mocks.firmaFindMany },
  },
}))

vi.mock('./operasyonel-servis-listesi', () => ({
  operasyonelServisListesiGetir: mocks.operasyonelServisListesiGetir,
}))

import { acilDurumListesiGetir, AcilDurumListesiError } from './acil-durum-listesi'

const GUZERGAH = { id: 'g1', kod: 'G1', ad: 'Güzergah 1', yerleske: { kod: 'Y1', ad: 'Yerleşke 1' } }
const DILIM_SABAH = { id: 'd-sabah', kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS' }

/** Varsayılan: sefer TANIMLI ama hiçbir atama yok (ATANMAMIS senaryosu). */
beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.guzergahFindUnique.mockResolvedValue(GUZERGAH)
  mocks.dilimFindUnique.mockResolvedValue(DILIM_SABAH)
  mocks.durakSaatCount.mockResolvedValue(1) // sefer tanımlı
  mocks.guzergahDurakFindMany.mockResolvedValue([])
  mocks.aracVarsayilanFindMany.mockResolvedValue([])
  mocks.soforVarsayilanFindMany.mockResolvedValue([])
  mocks.sorumluFindMany.mockResolvedValue([])
  mocks.firmaFindMany.mockResolvedValue([])
  mocks.operasyonelServisListesiGetir.mockResolvedValue({
    tarih: '2026-09-22',
    gecmisTarihSecildi: false,
    satirlar: [],
  })
})

describe('acilDurumListesiGetir — bulunamayan kapsam', () => {
  it('güzergâh yoksa hata fırlatır', async () => {
    mocks.guzergahFindUnique.mockResolvedValue(null)
    await expect(acilDurumListesiGetir({ guzergahId: 'yok', dilimId: 'd-sabah' })).rejects.toBeInstanceOf(
      AcilDurumListesiError,
    )
  })

  it('sefer dilimi yoksa hata fırlatır', async () => {
    mocks.dilimFindUnique.mockResolvedValue(null)
    await expect(acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'yok' })).rejects.toBeInstanceOf(
      AcilDurumListesiError,
    )
  })
})

// ----------------------------------------------------------------------------
// 🔴 EKSİK SEMANTİĞİ — acil durumda sessiz boşluk kabul edilemez.
// ----------------------------------------------------------------------------
describe('acilDurumListesiGetir — EKSİK semantiği (üç durum)', () => {
  it('sefer TANIMLI ama atama yoksa her blok ATANMAMIS döner (boş dizi ile karışmaz)', async () => {
    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.seferTanimli).toBe(true)
    expect(sonuc.arac.ana.durum).toBe('ATANMAMIS')
    expect(sonuc.arac.ana.kayitlar).toEqual([])
    expect(sonuc.sofor.ana.durum).toBe('ATANMAMIS')
    expect(sonuc.sorumlu.ana.durum).toBe('ATANMAMIS')
    expect(sonuc.duraklar.durum).toBe('ATANMAMIS')
    expect(sonuc.firmalar.durum).toBe('ATANMAMIS')
    expect(sonuc.yolcular.durum).toBe('ATANMAMIS')
  })

  it('bu dilimde sefer TANIMLI DEĞİLSE boşluğun sebebi SEFER_TANIMLI_DEGIL olarak ayrışır', async () => {
    mocks.durakSaatCount.mockResolvedValue(0)

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.seferTanimli).toBe(false)
    expect(sonuc.arac.ana.durum).toBe('SEFER_TANIMLI_DEGIL')
    expect(sonuc.sofor.ana.durum).toBe('SEFER_TANIMLI_DEGIL')
    expect(sonuc.yolcular.durum).toBe('SEFER_TANIMLI_DEGIL')
  })

  it('sefer tanımlı olmasa BİLE veri varsa gizlenmez — durum VERI_VAR olur', async () => {
    mocks.durakSaatCount.mockResolvedValue(0)
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', arac: { id: 'a1', plaka: '41 AB 1', kapasite: 27, firmaId: 'f1', firma: { ad: 'Firma A' } } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.seferTanimli).toBe(false)
    expect(sonuc.arac.ana.durum).toBe('VERI_VAR')
    expect(sonuc.arac.ana.kayitlar[0].plaka).toBe('41 AB 1')
  })
})

describe('acilDurumListesiGetir — ANA/YEDEK ayrımı', () => {
  it('araç ve şoförde ANA ile YEDEK ayrı bloklara ayrılır', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', arac: { id: 'a1', plaka: 'ANA-PLAKA', kapasite: 27, firmaId: 'f1', firma: { ad: 'Firma A' } } },
      { rol: 'YEDEK', arac: { id: 'a2', plaka: 'YEDEK-PLAKA', kapasite: 19, firmaId: 'f1', firma: { ad: 'Firma A' } } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { rol: 'YEDEK', sofor: { id: 's2', adSoyad: 'Yedek Şoför', telefon: '555', firmaId: 'f1', personnelId: null, personnel: null } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.arac.ana.kayitlar.map(a => a.plaka)).toEqual(['ANA-PLAKA'])
    expect(sonuc.arac.yedek.kayitlar.map(a => a.plaka)).toEqual(['YEDEK-PLAKA'])
    // ANA şoför YOK ama YEDEK var — "ANA atanmamış" görünür kalmalı.
    expect(sonuc.sofor.ana.durum).toBe('ATANMAMIS')
    expect(sonuc.sofor.yedek.durum).toBe('VERI_VAR')
  })

  it('güzergâh sorumlusu ANA/YEDEK olarak ayrılır ve telefonu taşır', async () => {
    mocks.sorumluFindMany.mockResolvedValue([
      { rol: 'ANA', personnel: { id: 'p9', sicilNo: '999', adSoyad: 'Sorumlu Kişi', telefon: '5559998877' } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.sorumlu.ana.kayitlar[0]).toMatchObject({ adSoyad: 'Sorumlu Kişi', telefon: '5559998877' })
    expect(sonuc.sorumlu.yedek.durum).toBe('ATANMAMIS')
  })
})

// ----------------------------------------------------------------------------
// 🔴 Şoför telefonu fallback'i
// ----------------------------------------------------------------------------
describe('acilDurumListesiGetir — şoför telefonu önceliği', () => {
  it('ServisSofor.telefon doluysa o kullanılır', async () => {
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', sofor: { id: 's1', adSoyad: 'Dahili Şoför', telefon: '5551110000', firmaId: null, personnelId: 'p1', personnel: { telefon: '5552220000' } } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.sofor.ana.kayitlar[0].telefon).toBe('5551110000')
    expect(sonuc.sofor.ana.kayitlar[0].dahiliMi).toBe(true)
  })

  it('ServisSofor.telefon BOŞSA dahili şoförün Personnel.telefon\'una düşer', async () => {
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', sofor: { id: 's1', adSoyad: 'Dahili Şoför', telefon: null, firmaId: null, personnelId: 'p1', personnel: { telefon: '5552220000' } } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.sofor.ana.kayitlar[0].telefon).toBe('5552220000')
  })

  it('dış firma şoföründe (personnelId yok) telefon boşsa null kalır, dahiliMi=false', async () => {
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', sofor: { id: 's3', adSoyad: 'Dış Şoför', telefon: null, firmaId: 'f1', personnelId: null, personnel: null } },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.sofor.ana.kayitlar[0].telefon).toBeNull()
    expect(sonuc.sofor.ana.kayitlar[0].dahiliMi).toBe(false)
  })
})

describe('acilDurumListesiGetir — duraklar ve firma iletişimi', () => {
  it('duraklar SIRALI ve SEÇİLEN DİLİMİN saatiyle döner', async () => {
    mocks.guzergahDurakFindMany.mockResolvedValue([
      { sira: 1, durak: { id: 'd1', kod: 'D1', ad: 'Durak 1', il: 'Kocaeli', ilce: 'Gebze' }, saatler: [{ saat: '07:15' }] },
      { sira: 2, durak: { id: 'd2', kod: 'D2', ad: 'Durak 2', il: null, ilce: null }, saatler: [] },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.duraklar.durum).toBe('VERI_VAR')
    expect(sonuc.duraklar.kayitlar.map(d => d.sira)).toEqual([1, 2])
    expect(sonuc.duraklar.kayitlar[0].saat).toBe('07:15')
    expect(sonuc.duraklar.kayitlar[1].saat).toBeNull()
    // Saat sorgusu SEÇİLEN dilime göre süzülmeli (GIDIS'e sabit değil).
    const cagriArg = mocks.guzergahDurakFindMany.mock.calls[0][0]
    expect(cagriArg.select.saatler.where).toEqual({ aktif: true, dilimId: 'd-sabah' })
    expect(cagriArg.orderBy).toEqual({ sira: 'asc' })
  })

  it('firma iletişimi araç ve şoför firmalarının BİRLEŞİMİNDEN (tekilleştirilmiş) sorulur', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', arac: { id: 'a1', plaka: 'P1', kapasite: 27, firmaId: 'f1', firma: { ad: 'Firma A' } } },
    ])
    mocks.soforVarsayilanFindMany.mockResolvedValue([
      { rol: 'ANA', sofor: { id: 's1', adSoyad: 'Ş', telefon: '1', firmaId: 'f2', personnelId: null, personnel: null } },
    ])
    mocks.firmaFindMany.mockResolvedValue([
      { id: 'f1', ad: 'Firma A', yetkiliAdi: 'Yetkili A', telefon: '5551', eposta: 'a@x.com' },
      { id: 'f2', ad: 'Firma B', yetkiliAdi: null, telefon: null, eposta: null },
    ])

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(mocks.firmaFindMany.mock.calls[0][0].where.id.in.sort()).toEqual(['f1', 'f2'])
    expect(sonuc.firmalar.durum).toBe('VERI_VAR')
    expect(sonuc.firmalar.kayitlar[0]).toMatchObject({ ad: 'Firma A', yetkiliAdi: 'Yetkili A', telefon: '5551' })
  })

  it('hiç firma yoksa firma sorgusu HİÇ çalışmaz', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    expect(mocks.firmaFindMany).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// Madde 29 ile paylaşım + dilim ayrımı
// ----------------------------------------------------------------------------
describe('acilDurumListesiGetir — yolcular madde 29 fonksiyonundan', () => {
  it('yolcu sorgusu operasyonelServisListesiGetir\'e guzergahId + dilimId ile devredilir (ikinci sorgu yok)', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    expect(mocks.operasyonelServisListesiGetir).toHaveBeenCalledWith({ guzergahId: 'g1', dilimId: 'd-sabah' })
  })

  it('yolcu satırları KVKK alanlarıyla (sicil/ad/durak/telefon) eşlenir, sabahSaati taşınmaz', async () => {
    mocks.operasyonelServisListesiGetir.mockResolvedValue({
      tarih: '2026-09-22',
      gecmisTarihSecildi: false,
      satirlar: [
        {
          personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yılmaz', bolum: 'Üretim',
          guzergahKod: 'G1', guzergahAd: 'Güzergah 1', durakKod: 'D1', durakAd: 'Durak 1',
          sabahSaati: '07:15', telefon: '5551112233',
        },
      ],
    })

    const sonuc = await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    expect(sonuc.yolcular.durum).toBe('VERI_VAR')
    expect(sonuc.yolcular.kayitlar[0]).toEqual({
      personnelId: 'p1',
      sicilNo: '111',
      adSoyad: 'Ahmet Yılmaz',
      durakKod: 'D1',
      durakAd: 'Durak 1',
      telefon: '5551112233',
    })
    // GIDIS'e sabit sabahSaati akşam dilimini yanıltmasın diye taşınmıyor.
    expect(sonuc.yolcular.kayitlar[0]).not.toHaveProperty('sabahSaati')
  })

  it('dilim ayrımı: sabah ve akşam için farklı dilimId ile ayrı sorgu yapılır', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    mocks.dilimFindUnique.mockResolvedValue({ id: 'd-aksam', kod: 'AKSAM_DONUS', ad: 'Akşam Servisi', yon: 'DONUS' })
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-aksam' })

    expect(mocks.operasyonelServisListesiGetir).toHaveBeenNthCalledWith(1, { guzergahId: 'g1', dilimId: 'd-sabah' })
    expect(mocks.operasyonelServisListesiGetir).toHaveBeenNthCalledWith(2, { guzergahId: 'g1', dilimId: 'd-aksam' })
    // Araç/şoför sorguları da dilim bazlı.
    expect(mocks.aracVarsayilanFindMany.mock.calls[0][0].where.dilimId).toBe('d-sabah')
    expect(mocks.aracVarsayilanFindMany.mock.calls[1][0].where.dilimId).toBe('d-aksam')
  })
})

describe('acilDurumListesiGetir — tarih ve KVKK sınırları', () => {
  it('araç/şoför/sorumlu sorguları Ders 59 pozitif AND-of-OR formunu kullanır (NOT yok)', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })

    for (const mock of [mocks.aracVarsayilanFindMany, mocks.soforVarsayilanFindMany, mocks.sorumluFindMany]) {
      const where = mock.mock.calls[0][0].where
      expect(where.baslangicTarihi).toHaveProperty('lte')
      expect(where.OR).toEqual([{ bitisTarihi: null }, { bitisTarihi: { gte: expect.any(Date) } }])
      expect(where.NOT).toBeUndefined()
      expect(where.aktif).toBe(true)
    }
  })

  it('KVKK: sorumlu Personnel select\'i yalnız id/sicilNo/adSoyad/telefon içerir', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    const select = mocks.sorumluFindMany.mock.calls[0][0].select.personnel.select
    expect(select).toEqual({ id: true, sicilNo: true, adSoyad: true, telefon: true })
  })

  it('KVKK: şoförün Personnel select\'i yalnız telefon içerir', async () => {
    await acilDurumListesiGetir({ guzergahId: 'g1', dilimId: 'd-sabah' })
    const select = mocks.soforVarsayilanFindMany.mock.calls[0][0].select.sofor.select.personnel.select
    expect(select).toEqual({ telefon: true })
  })
})
