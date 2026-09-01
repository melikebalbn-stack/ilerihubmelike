import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  systemSettingFindUnique: vi.fn(),
  servisKapasiteOzetiGetir: vi.fn(),
  personelAtamaFindUnique: vi.fn(),
  guzergahFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemSetting: { findUnique: mocks.systemSettingFindUnique },
    servisPersonelAtama: { findUnique: mocks.personelAtamaFindUnique },
    servisGuzergah: { findMany: mocks.guzergahFindMany },
  },
}))

vi.mock('./kapasite', () => ({ servisKapasiteOzetiGetir: mocks.servisKapasiteOzetiGetir }))

import {
  ALTERNATIF_ESIK_KM_AYAR_KEY,
  VARSAYILAN_ESIK_KM,
  alternatifEsikKmGetir,
  alternatifServisOnerileriGetir,
  haversineKm,
  oneriSirala,
} from './alternatif-servis'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('haversineKm', () => {
  it('aynı koordinat için 0 döner', () => {
    const nokta = { enlem: 40.9909, boylam: 29.0304 }
    expect(haversineKm(nokta, nokta)).toBeCloseTo(0, 6)
  })

  it('bilinen bir mesafeyi (Kadıköy — Gebze, ~35-40 km kuş uçuşu) makul aralıkta hesaplar', () => {
    const kadikoy = { enlem: 40.9909, boylam: 29.0304 }
    const gebze = { enlem: 40.8028, boylam: 29.4306 }
    const mesafe = haversineKm(kadikoy, gebze)
    expect(mesafe).toBeGreaterThan(30)
    expect(mesafe).toBeLessThan(45)
  })

  it('simetriktir: a→b ile b→a aynı sonucu verir', () => {
    const a = { enlem: 41.0, boylam: 29.0 }
    const b = { enlem: 40.5, boylam: 29.5 }
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9)
  })
})

describe('oneriSirala', () => {
  it('ortak durak + boş koltuk olan aday MESAFE_ESIGI_ICINDE olandan önce gelir (mesafesi daha uzak olsa bile)', () => {
    const sonuc = oneriSirala(
      [
        { id: 'uzak-ama-ortak', ortakDurakVar: true, bosKoltukVar: true, mesafeKm: 4.9 },
        { id: 'yakin-ama-sadece-mesafe', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: 0.5 },
      ],
      5,
    )
    expect(sonuc.map((s) => s.id)).toEqual(['uzak-ama-ortak', 'yakin-ama-sadece-mesafe'])
    expect(sonuc[0].kategori).toBe('ORTAK_DURAK_BOS_KOLTUK')
    expect(sonuc[1].kategori).toBe('MESAFE_ESIGI_ICINDE')
  })

  it('aynı kategori içinde mesafeye göre (yakın önce) sıralar', () => {
    const sonuc = oneriSirala(
      [
        { id: 'b', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: 3 },
        { id: 'a', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: 1 },
      ],
      5,
    )
    expect(sonuc.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('ortak durak VAR ama boş koltuk YOK ise (ve mesafe eşiği dışındaysa) aday listeye girmez', () => {
    const sonuc = oneriSirala([{ id: 'x', ortakDurakVar: true, bosKoltukVar: false, mesafeKm: 100 }], 5)
    expect(sonuc).toEqual([])
  })

  it('mesafe eşiğin tam üzerinde olan aday (>eşik) elenir, eşiğe eşit olan dahil edilir', () => {
    const sonuc = oneriSirala(
      [
        { id: 'esit', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: 5 },
        { id: 'ustunde', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: 5.01 },
      ],
      5,
    )
    expect(sonuc.map((s) => s.id)).toEqual(['esit'])
  })

  it('mesafeKm null olan adaylar kendi kategorisinin sonuna düşer', () => {
    const sonuc = oneriSirala(
      [
        { id: 'bilinmeyen', ortakDurakVar: true, bosKoltukVar: true, mesafeKm: null },
        { id: 'bilinen', ortakDurakVar: true, bosKoltukVar: true, mesafeKm: 2 },
      ],
      5,
    )
    expect(sonuc.map((s) => s.id)).toEqual(['bilinen', 'bilinmeyen'])
  })

  it('hiçbir aday şartı sağlamıyorsa boş dizi döner', () => {
    expect(oneriSirala([{ id: 'x', ortakDurakVar: false, bosKoltukVar: false, mesafeKm: null }], 5)).toEqual([])
  })
})

describe('alternatifEsikKmGetir', () => {
  it('SystemSetting kaydı yoksa varsayılana (5 km) düşer', async () => {
    mocks.systemSettingFindUnique.mockResolvedValue(null)
    await expect(alternatifEsikKmGetir()).resolves.toBe(VARSAYILAN_ESIK_KM)
    expect(mocks.systemSettingFindUnique).toHaveBeenCalledWith({ where: { key: ALTERNATIF_ESIK_KM_AYAR_KEY } })
  })

  it('geçerli bir sayısal değer varsa onu döner', async () => {
    mocks.systemSettingFindUnique.mockResolvedValue({ key: ALTERNATIF_ESIK_KM_AYAR_KEY, value: '8' })
    await expect(alternatifEsikKmGetir()).resolves.toBe(8)
  })

  it('geçersiz (sayı olmayan veya negatif) değer varsa varsayılana düşer', async () => {
    mocks.systemSettingFindUnique.mockResolvedValue({ key: ALTERNATIF_ESIK_KM_AYAR_KEY, value: 'abc' })
    await expect(alternatifEsikKmGetir()).resolves.toBe(VARSAYILAN_ESIK_KM)

    mocks.systemSettingFindUnique.mockResolvedValue({ key: ALTERNATIF_ESIK_KM_AYAR_KEY, value: '-3' })
    await expect(alternatifEsikKmGetir()).resolves.toBe(VARSAYILAN_ESIK_KM)
  })
})

describe('alternatifServisOnerileriGetir', () => {
  const atamaTemel = {
    id: 'pa1',
    guzergahId: 'gMevcut',
    durakId: 'durak-1',
    aktif: true,
    durak: { id: 'durak-1', enlem: 40.0, boylam: 29.0 },
    dilimler: [{ dilimId: 'dilim-1' }],
  }

  function kapasiteMock(kapasiteByGuzergah: Record<string, number>, doluByGuzergah: Record<string, number>) {
    mocks.servisKapasiteOzetiGetir.mockImplementation(async (guzergahId: string) => {
      const kapasite = kapasiteByGuzergah[guzergahId] ?? 0
      const atananPersonelSayisi = doluByGuzergah[guzergahId] ?? 0
      return {
        kapasite,
        atananPersonelSayisi,
        bosKoltuk: kapasite - atananPersonelSayisi,
        dolulukOrani: kapasite > 0 ? (atananPersonelSayisi / kapasite) * 100 : 0,
      }
    })
  }

  it('atama bulunamazsa hata fırlatır', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(null)
    await expect(alternatifServisOnerileriGetir('yok')).rejects.toThrow('Personel ataması bulunamadı.')
  })

  it('pasif atama için öneri üretilemez', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ ...atamaTemel, aktif: false })
    await expect(alternatifServisOnerileriGetir('pa1')).rejects.toThrow('Pasif bir atama için öneri üretilemez.')
  })

  it('personelin sabit durağı yoksa boş dizi döner (mesafe/ortak durak kıyaslanamaz)', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ ...atamaTemel, durakId: null, durak: null })
    await expect(alternatifServisOnerileriGetir('pa1')).resolves.toEqual([])
    expect(mocks.guzergahFindMany).not.toHaveBeenCalled()
  })

  it('ortak durak+boş koltuklu aday önce, mesafe eşiği içindeki sonra, eşiğin dışındaki hiç gelir', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(atamaTemel)
    mocks.systemSettingFindUnique.mockResolvedValue(null) // varsayılan 5 km eşik
    mocks.guzergahFindMany.mockResolvedValue([
      {
        id: 'gA', kod: 'A', ad: 'Ortak Duraklı',
        duraklar: [{ durakId: 'durak-1', durak: { id: 'durak-1', kod: 'D1', ad: 'Durak 1', enlem: 40.0, boylam: 29.0 } }],
      },
      {
        id: 'gB', kod: 'B', ad: 'Yakın Ama Farklı Durak',
        duraklar: [{ durakId: 'durak-2', durak: { id: 'durak-2', kod: 'D2', ad: 'Durak 2', enlem: 40.03, boylam: 29.0 } }],
      },
      {
        id: 'gC', kod: 'C', ad: 'Çok Uzak',
        duraklar: [{ durakId: 'durak-3', durak: { id: 'durak-3', kod: 'D3', ad: 'Durak 3', enlem: 41.0, boylam: 30.0 } }],
      },
    ])
    kapasiteMock({ gA: 20, gB: 10, gC: 10 }, { gA: 15, gB: 10, gC: 0 })

    const sonuc = await alternatifServisOnerileriGetir('pa1')

    expect(sonuc.map((s) => s.guzergahId)).toEqual(['gA', 'gB'])
    expect(sonuc[0].kategori).toBe('ORTAK_DURAK_BOS_KOLTUK')
    expect(sonuc[0].uygunDilimIdleri).toEqual(['dilim-1'])
    expect(sonuc[1].kategori).toBe('MESAFE_ESIGI_ICINDE')
    expect(sonuc[1].mesafeKm).not.toBeNull()
    expect(sonuc.find((s) => s.guzergahId === 'gC')).toBeUndefined()
  })

  it('mevcut güzergah aday listesine hiç dahil edilmez', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(atamaTemel)
    mocks.systemSettingFindUnique.mockResolvedValue(null)
    mocks.guzergahFindMany.mockResolvedValue([])
    kapasiteMock({}, {})

    await alternatifServisOnerileriGetir('pa1')
    expect(mocks.guzergahFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'gMevcut' }, aktif: true }) }),
    )
  })
})
