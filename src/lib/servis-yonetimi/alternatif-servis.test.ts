import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  systemSettingFindUnique: vi.fn(),
  guzergahAracVarsayilanFindMany: vi.fn(),
  personelAtamaCount: vi.fn(),
  personelAtamaFindUnique: vi.fn(),
  guzergahFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemSetting: { findUnique: mocks.systemSettingFindUnique },
    servisGuzergahAracVarsayilan: { findMany: mocks.guzergahAracVarsayilanFindMany },
    servisPersonelAtama: { count: mocks.personelAtamaCount, findUnique: mocks.personelAtamaFindUnique },
    servisGuzergah: { findMany: mocks.guzergahFindMany },
  },
}))

import {
  ALTERNATIF_ESIK_KM_AYAR_KEY,
  VARSAYILAN_ESIK_KM,
  alternatifEsikKmGetir,
  alternatifServisOnerileriGetir,
  bosKoltukSayisiGetirGECICI,
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

describe('bosKoltukSayisiGetirGECICI (GEÇİCİ — kapasite dalı canonical fonksiyonla değiştirecek)', () => {
  it('aktif ANA araçların kapasite toplamından aktif dolu koltuk sayısını çıkarır', async () => {
    mocks.guzergahAracVarsayilanFindMany.mockResolvedValue([
      { arac: { kapasite: 16 } },
      { arac: { kapasite: 20 } },
    ])
    mocks.personelAtamaCount.mockResolvedValue(30)

    await expect(bosKoltukSayisiGetirGECICI('g1', 'd1')).resolves.toBe(6)
    expect(mocks.guzergahAracVarsayilanFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'g1', dilimId: 'd1', rol: 'ANA', aktif: true },
      include: { arac: { select: { kapasite: true } } },
    })
    expect(mocks.personelAtamaCount).toHaveBeenCalledWith({
      where: { guzergahId: 'g1', aktif: true, dilimler: { some: { dilimId: 'd1' } } },
    })
  })

  it('dolu koltuk sayısı kapasiteyi aşarsa negatif değil 0 döner', async () => {
    mocks.guzergahAracVarsayilanFindMany.mockResolvedValue([{ arac: { kapasite: 16 } }])
    mocks.personelAtamaCount.mockResolvedValue(20)

    await expect(bosKoltukSayisiGetirGECICI('g1', 'd1')).resolves.toBe(0)
  })

  it('hiç aktif ANA araç yoksa 0 döner', async () => {
    mocks.guzergahAracVarsayilanFindMany.mockResolvedValue([])
    mocks.personelAtamaCount.mockResolvedValue(0)

    await expect(bosKoltukSayisiGetirGECICI('g1', 'd1')).resolves.toBe(0)
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
    mocks.guzergahAracVarsayilanFindMany.mockImplementation(async ({ where }: { where: { guzergahId: string } }) => {
      const kapasite = kapasiteByGuzergah[where.guzergahId] ?? 0
      return kapasite > 0 ? [{ arac: { kapasite } }] : []
    })
    mocks.personelAtamaCount.mockImplementation(async ({ where }: { where: { guzergahId: string } }) =>
      doluByGuzergah[where.guzergahId] ?? 0,
    )
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
