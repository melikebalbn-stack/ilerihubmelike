import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  aracAtamaFindMany: vi.fn(),
  personelAtamaCount: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisGuzergahAracVarsayilan: { findMany: mocks.aracAtamaFindMany },
    servisPersonelAtama: { count: mocks.personelAtamaCount },
  },
}))

import {
  kapasiteOzetiHesapla,
  servisKapasiteOzetiGetir,
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
    })
  })

  it('kapasite aşımında negatif boş koltuğu ve %100 üstü doluluğu korur', () => {
    expect(kapasiteOzetiHesapla([16], 17)).toEqual({
      kapasite: 16,
      atananPersonelSayisi: 17,
      bosKoltuk: -1,
      dolulukOrani: 106.25,
    })
  })

  it('araç ve atama yoksa sıfır özet döner', () => {
    expect(kapasiteOzetiHesapla([], 0)).toEqual({ kapasite: 0, atananPersonelSayisi: 0, bosKoltuk: 0, dolulukOrani: 0 })
  })

  it('kapasite yokken personel varsa aşımı negatif boş koltukla gösterir', () => {
    expect(kapasiteOzetiHesapla([], 3)).toEqual({ kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: 100 })
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
