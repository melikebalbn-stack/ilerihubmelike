import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // C0: ortak kapasite aşımı kuralı kapasite motorunu okur; varsayılan = geniş boş kapasite (aşım yok)
  kapasiteOzeti: vi.fn(),
  firmaFindMany: vi.fn(),
  firmaFindUnique: vi.fn(),
  firmaCreate: vi.fn(),
  firmaUpdate: vi.fn(),
  yerleskeFindMany: vi.fn(),
  yerleskeFindUnique: vi.fn(),
  yerleskeCreate: vi.fn(),
  yerleskeUpdate: vi.fn(),
  guzergahFindMany: vi.fn(),
  guzergahFindUnique: vi.fn(),
  guzergahCreate: vi.fn(),
  guzergahUpdate: vi.fn(),
  durakFindMany: vi.fn(),
  durakFindUnique: vi.fn(),
  durakCreate: vi.fn(),
  durakUpdate: vi.fn(),
  aracFindMany: vi.fn(),
  aracFindUnique: vi.fn(),
  aracCreate: vi.fn(),
  aracUpdate: vi.fn(),
  soforFindMany: vi.fn(),
  soforFindUnique: vi.fn(),
  soforCreate: vi.fn(),
  soforUpdate: vi.fn(),
  personnelFindUnique: vi.fn(),
  seferDilimiFindMany: vi.fn(),
  seferDilimiFindUnique: vi.fn(),
  seferDilimiCreate: vi.fn(),
  seferDilimiUpdate: vi.fn(),
  guzergahDurakFindMany: vi.fn(),
  guzergahDurakFindUnique: vi.fn(),
  guzergahDurakFindFirst: vi.fn(),
  guzergahDurakCreate: vi.fn(),
  guzergahDurakUpdate: vi.fn(),
  guzergahDurakSaatFindUnique: vi.fn(),
  guzergahDurakSaatUpsert: vi.fn(),
  guzergahDurakSaatDelete: vi.fn(),
  guzergahDurakSaatUpdate: vi.fn(),
  aracVarsayilanFindMany: vi.fn(),
  aracVarsayilanFindFirst: vi.fn(),
  aracVarsayilanFindUnique: vi.fn(),
  aracVarsayilanCreate: vi.fn(),
  aracVarsayilanUpdate: vi.fn(),
  soforVarsayilanFindMany: vi.fn(),
  soforVarsayilanFindFirst: vi.fn(),
  soforVarsayilanFindUnique: vi.fn(),
  soforVarsayilanCreate: vi.fn(),
  soforVarsayilanUpdate: vi.fn(),
  sorumluFindMany: vi.fn(),
  sorumluFindUnique: vi.fn(),
  sorumluCreate: vi.fn(),
  sorumluUpdate: vi.fn(),
  personelDurumFindMany: vi.fn(),
  personelDurumFindFirst: vi.fn(),
  personelDurumFindUnique: vi.fn(),
  personelDurumCreate: vi.fn(),
  personelDurumUpdate: vi.fn(),
  personelAtamaFindMany: vi.fn(),
  personelAtamaFindFirst: vi.fn(),
  personelAtamaFindUnique: vi.fn(),
  personelAtamaCreate: vi.fn(),
  personelAtamaUpdate: vi.fn(),
  personelAtamaDilimCreateMany: vi.fn(),
  islemGecmisiCreate: vi.fn(),
  transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  executeRaw: vi.fn(),
  // A4 bağımlılık okuyucuları: varsayılan "bağlı kayıt yok"; testler Once ile değiştirir.
  bagYerleske: vi.fn(async () => [] as unknown[]),
  bagFirma: vi.fn(async () => [] as unknown[]),
  bagGuzergah: vi.fn(async () => [] as unknown[]),
  bagArac: vi.fn(async () => [] as unknown[]),
  bagSofor: vi.fn(async () => [] as unknown[]),
  bagDilim: vi.fn(async () => [] as unknown[]),
  kodGuzergah: vi.fn(async () => [] as unknown[]),
  kodDurak: vi.fn(async () => [] as unknown[]),
  // A5 firma zinciri
  zincirPasif: vi.fn(),
  zincirGeriAl: vi.fn(),
  zincirOnizleme: vi.fn(),
  zincirSonId: vi.fn(async () => null as string | null),
}))

vi.mock('./kapasite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./kapasite')>()),
  servisKapasiteOzetiGetir: mocks.kapasiteOzeti,
}))

vi.mock('./firma-zincir', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./firma-zincir')>()),
  firmaZincirPasiflestir: mocks.zincirPasif,
  firmaZincirGeriAl: mocks.zincirGeriAl,
  firmaZincirOnizleme: mocks.zincirOnizleme,
  firmaSonZincirIslemId: mocks.zincirSonId,
}))

vi.mock('./bagimlilik', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bagimlilik')>()),
  yerleskeBagimliliklari: mocks.bagYerleske,
  firmaBagimliliklari: mocks.bagFirma,
  guzergahBagimliliklari: mocks.bagGuzergah,
  aracBagimliliklari: mocks.bagArac,
  soforBagimliliklari: mocks.bagSofor,
  seferDilimiBagimliliklari: mocks.bagDilim,
  guzergahKodKullanimi: mocks.kodGuzergah,
  durakKodKullanimi: mocks.kodDurak,
}))

// $transaction hem dizi formunu (guzergah-durak yeniden sıralama) hem de
// interaktif callback formunu (createServisPersonelAtama: create + createMany
// aynı atomik işlemde) destekler — tx, prisma ile aynı mock delegate'lerini
// paylaşan aynı nesnedir.
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    servisFirma: {
      findMany: mocks.firmaFindMany,
      findUnique: mocks.firmaFindUnique,
      create: mocks.firmaCreate,
      update: mocks.firmaUpdate,
    },
    servisYerleske: {
      findMany: mocks.yerleskeFindMany,
      findUnique: mocks.yerleskeFindUnique,
      create: mocks.yerleskeCreate,
      update: mocks.yerleskeUpdate,
    },
    servisGuzergah: {
      findMany: mocks.guzergahFindMany,
      findUnique: mocks.guzergahFindUnique,
      create: mocks.guzergahCreate,
      update: mocks.guzergahUpdate,
    },
    servisDurak: {
      findMany: mocks.durakFindMany,
      findUnique: mocks.durakFindUnique,
      create: mocks.durakCreate,
      update: mocks.durakUpdate,
    },
    servisArac: {
      findMany: mocks.aracFindMany,
      findUnique: mocks.aracFindUnique,
      create: mocks.aracCreate,
      update: mocks.aracUpdate,
    },
    servisSofor: {
      findMany: mocks.soforFindMany,
      findUnique: mocks.soforFindUnique,
      create: mocks.soforCreate,
      update: mocks.soforUpdate,
    },
    personnel: {
      findUnique: mocks.personnelFindUnique,
    },
    servisSeferDilimi: {
      findMany: mocks.seferDilimiFindMany,
      findUnique: mocks.seferDilimiFindUnique,
      create: mocks.seferDilimiCreate,
      update: mocks.seferDilimiUpdate,
    },
    servisGuzergahDurak: {
      findMany: mocks.guzergahDurakFindMany,
      findUnique: mocks.guzergahDurakFindUnique,
      findFirst: mocks.guzergahDurakFindFirst,
      create: mocks.guzergahDurakCreate,
      update: mocks.guzergahDurakUpdate,
    },
    servisGuzergahDurakSaat: {
      findUnique: mocks.guzergahDurakSaatFindUnique,
      upsert: mocks.guzergahDurakSaatUpsert,
      delete: mocks.guzergahDurakSaatDelete,
      update: mocks.guzergahDurakSaatUpdate,
    },
    servisGuzergahAracVarsayilan: {
      findMany: mocks.aracVarsayilanFindMany,
      findFirst: mocks.aracVarsayilanFindFirst,
      findUnique: mocks.aracVarsayilanFindUnique,
      create: mocks.aracVarsayilanCreate,
      update: mocks.aracVarsayilanUpdate,
    },
    servisGuzergahSoforVarsayilan: {
      findMany: mocks.soforVarsayilanFindMany,
      findFirst: mocks.soforVarsayilanFindFirst,
      findUnique: mocks.soforVarsayilanFindUnique,
      create: mocks.soforVarsayilanCreate,
      update: mocks.soforVarsayilanUpdate,
    },
    servisSorumlusu: {
      findMany: mocks.sorumluFindMany,
      findUnique: mocks.sorumluFindUnique,
      create: mocks.sorumluCreate,
      update: mocks.sorumluUpdate,
    },
    servisPersonelDurum: {
      findMany: mocks.personelDurumFindMany,
      findFirst: mocks.personelDurumFindFirst,
      findUnique: mocks.personelDurumFindUnique,
      create: mocks.personelDurumCreate,
      update: mocks.personelDurumUpdate,
    },
    servisPersonelAtama: {
      findMany: mocks.personelAtamaFindMany,
      findFirst: mocks.personelAtamaFindFirst,
      findUnique: mocks.personelAtamaFindUnique,
      create: mocks.personelAtamaCreate,
      update: mocks.personelAtamaUpdate,
    },
    servisPersonelAtamaDilim: {
      createMany: mocks.personelAtamaDilimCreateMany,
    },
    servisIslemGecmisi: {
      create: mocks.islemGecmisiCreate,
    },
    $executeRaw: mocks.executeRaw,
  }
  return {
    prisma: {
      ...prismaMock,
      $executeRaw: mocks.executeRaw,
      $transaction: (arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
          : mocks.transaction(arg as unknown[]),
    },
  }
})

import {
  createServisFirma,
  createServisArac,
  createServisDurak,
  createServisGuzergah,
  createServisYerleske,
  createServisSofor,
  geriAlServisFirma,
  geriAlServisArac,
  geriAlServisDurak,
  geriAlServisGuzergah,
  geriAlServisYerleske,
  geriAlServisSofor,
  listServisFirmalar,
  listServisAraclar,
  listServisDuraklar,
  listServisGuzergahlar,
  listServisYerleskeler,
  listServisSoforler,
  pasiflestirServisFirma,
  pasiflestirServisArac,
  pasiflestirServisDurak,
  pasiflestirServisGuzergah,
  pasiflestirServisYerleske,
  pasiflestirServisSofor,
  updateServisFirma,
  updateServisArac,
  updateServisDurak,
  updateServisGuzergah,
  updateServisYerleske,
  updateServisSofor,
  createServisSeferDilimi,
  geriAlServisSeferDilimi,
  listServisSeferDilimleri,
  pasiflestirServisSeferDilimi,
  updateServisSeferDilimi,
  createServisGuzergahDurak,
  geriAlServisGuzergahDurak,
  listServisGuzergahDuraklar,
  pasiflestirServisGuzergahDurak,
  siraDegistirServisGuzergahDurak,
  yenidenSiralaServisGuzergahDuraklar,
  guzergahDurakSaatiKaydet,
  guzergahDurakSaatiSil,
  geriAlGuzergahDurakSaat,
  listServisGuzergahAracVarsayilanlari,
  createServisGuzergahAracVarsayilan,
  guncelleServisGuzergahAracVarsayilan,
  pasiflestirServisGuzergahAracVarsayilan,
  geriAlServisGuzergahAracVarsayilan,
  listServisGuzergahSoforVarsayilanlari,
  createServisGuzergahSoforVarsayilan,
  guncelleServisGuzergahSoforVarsayilan,
  pasiflestirServisGuzergahSoforVarsayilan,
  geriAlServisGuzergahSoforVarsayilan,
  listServisSorumlulari,
  createServisSorumlusu,
  guncelleServisSorumlusu,
  pasiflestirServisSorumlusu,
  geriAlServisSorumlusu,
  listServisPersonelDurumlari,
  createServisPersonelDurum,
  guncelleServisPersonelDurum,
  pasiflestirServisPersonelDurum,
  geriAlServisPersonelDurum,
  listServisPersonelAtamalari,
  createServisPersonelAtama,
  guncelleServisPersonelAtama,
  pasiflestirServisPersonelAtama,
  geriAlServisPersonelAtama,
  transferServisPersonelAtama,
  transferKapasiteOnizle,
} from './service'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.kapasiteOzeti.mockResolvedValue({ kapasite: 50, atananPersonelSayisi: 0, bosKoltuk: 50, dolulukOrani: 0, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 })
})

describe('ServisFirma — view', () => {
  it('aktif filtresiyle listeler', async () => {
    mocks.firmaFindMany.mockResolvedValue([{ id: '1', ad: 'X' }])
    const data = await listServisFirmalar({ aktif: true })
    expect(mocks.firmaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aktif: true } })
    )
    expect(data).toHaveLength(1)
  })

  it('🔴 B0: yalnız AKTİF araç/şoför SAYISI döner (filtreli _count; şoför için başka alan yok)', async () => {
    mocks.firmaFindMany.mockResolvedValue([])
    await listServisFirmalar()
    expect(mocks.firmaFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        _count: { select: { araclar: { where: { aktif: true } }, soforler: { where: { aktif: true } } } },
      },
    }))
  })
})

describe('ServisFirma — create', () => {
  it('geçerli formu kaydeder', async () => {
    mocks.firmaCreate.mockResolvedValue({ id: '1', ad: 'ABC Turizm' })
    const data = await createServisFirma({ ad: 'ABC Turizm' })
    expect(mocks.firmaCreate).toHaveBeenCalled()
    expect(data.ad).toBe('ABC Turizm')
  })

  it('boş ad ile hata verir, DB çağrısı yapmaz', async () => {
    await expect(createServisFirma({ ad: 'A' })).rejects.toThrow('en az 2 karakter')
    expect(mocks.firmaCreate).not.toHaveBeenCalled()
  })

  it('geçersiz e-posta ile hata verir', async () => {
    await expect(createServisFirma({ ad: 'ABC Turizm', eposta: 'gecersiz' })).rejects.toThrow('e-posta')
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (FIRMA/OLUSTURMA, aynı transaction)', async () => {
    mocks.firmaCreate.mockResolvedValue({ id: '1', ad: 'ABC Turizm' })
    await createServisFirma({ ad: 'ABC Turizm' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'FIRMA', hedefId: '1', islem: 'OLUSTURMA', userId: 'user-9',
        yeniDeger: expect.objectContaining({ ad: 'ABC Turizm' }),
      }),
    }))
  })
})

describe('ServisFirma — edit', () => {
  it('mevcut kaydı günceller', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', ad: 'Eski' })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', ad: 'Yeni' })
    const data = await updateServisFirma('1', { ad: 'Yeni' })
    expect(data.ad).toBe('Yeni')
  })

  it('olmayan kayıt için hata verir', async () => {
    mocks.firmaFindUnique.mockResolvedValue(null)
    await expect(updateServisFirma('yok', { ad: 'Geçerli Ad' })).rejects.toThrow('bulunamadı')
  })

  it('yalnız değişen alanları ServisIslemGecmisi’ye yazar (tam satır değil)', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', ad: 'Eski Ad', yetkiliAdi: 'Ayşe', telefon: '111', eposta: null, adres: null })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', ad: 'Yeni Ad' })
    await updateServisFirma('1', { ad: 'Yeni Ad', yetkiliAdi: 'Ayşe', telefon: '111' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'FIRMA', hedefId: '1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { ad: 'Eski Ad' },
        yeniDeger: { ad: 'Yeni Ad' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', ad: 'Aynı Ad', yetkiliAdi: null, telefon: null, eposta: null, adres: null })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', ad: 'Aynı Ad' })
    await updateServisFirma('1', { ad: 'Aynı Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisFirma — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', aktif: false })
    const data = await pasiflestirServisFirma('1')
    expect(mocks.firmaUpdate).toHaveBeenCalledWith({ where: { id: '1' }, data: { aktif: false } })
    expect(data.aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar (FIRMA/PASIFLESTIRME)', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', aktif: false })
    await pasiflestirServisFirma('1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'FIRMA', hedefId: '1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('zaten pasif kaydı tekrar pasifleştirmez', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: false })
    await expect(pasiflestirServisFirma('1')).rejects.toThrow('zaten pasif')
    expect(mocks.firmaUpdate).not.toHaveBeenCalled()
  })

  it('pasif kaydı geri aktifleştirir', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: false })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', aktif: true })
    const data = await geriAlServisFirma('1')
    expect(mocks.firmaUpdate).toHaveBeenCalledWith({ where: { id: '1' }, data: { aktif: true } })
    expect(data.aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar (FIRMA/AKTIFLESTIRME)', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: false })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', aktif: true })
    await geriAlServisFirma('1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'FIRMA', hedefId: '1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })

  it('zaten aktif kaydı tekrar aktifleştirmez', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: true })
    await expect(geriAlServisFirma('1')).rejects.toThrow('zaten aktif')
  })
})

describe('ServisYerleske — create', () => {
  it('geçerli formu kaydeder, kodu büyük harfe çevirir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue(null)
    mocks.yerleskeCreate.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Darıca' })
    const data = await createServisYerleske({ kod: 'dar', ad: 'Darıca' })
    expect(mocks.yerleskeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kod: 'DAR' }) })
    )
    expect(data.kod).toBe('DAR')
  })

  it('aynı kod varsa çakışma hatası verir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'baska', kod: 'DAR' })
    await expect(createServisYerleske({ kod: 'DAR', ad: 'Darıca' })).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.yerleskeCreate).not.toHaveBeenCalled()
  })

  it('geçersiz enlem/boylam ile hata verir', async () => {
    await expect(createServisYerleske({ kod: 'X', ad: 'Y', enlem: 999 })).rejects.toThrow('Enlem')
    await expect(createServisYerleske({ kod: 'X', ad: 'Y', boylam: 999 })).rejects.toThrow('Boylam')
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (YERLESKE/OLUSTURMA)', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue(null)
    mocks.yerleskeCreate.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Darıca' })
    await createServisYerleske({ kod: 'dar', ad: 'Darıca' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'YERLESKE', hedefId: '1', islem: 'OLUSTURMA', userId: 'user-9',
        yeniDeger: expect.objectContaining({ kod: 'DAR', ad: 'Darıca' }),
      }),
    }))
  })
})

describe('ServisYerleske — edit', () => {
  it('yalnız değişen alanları ServisIslemGecmisi’ye yazar', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Eski Ad', adres: null, enlem: null, boylam: null })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Yeni Ad' })
    await updateServisYerleske('1', { kod: 'dar', ad: 'Yeni Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'YERLESKE', hedefId: '1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { ad: 'Eski Ad' },
        yeniDeger: { ad: 'Yeni Ad' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Aynı Ad', adres: null, enlem: null, boylam: null })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', kod: 'DAR', ad: 'Aynı Ad' })
    await updateServisYerleske('1', { kod: 'dar', ad: 'Aynı Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisYerleske — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: false })
    const data = await pasiflestirServisYerleske('1')
    expect(data.aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: false })
    await pasiflestirServisYerleske('1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'YERLESKE', hedefId: '1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif kaydı geri aktifleştirir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: false })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: true })
    const data = await geriAlServisYerleske('1')
    expect(data.aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: false })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: true })
    await geriAlServisYerleske('1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'YERLESKE', hedefId: '1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

describe('ServisYerleske — view', () => {
  it('listeler', async () => {
    mocks.yerleskeFindMany.mockResolvedValue([{ id: '1', kod: 'DAR' }])
    const data = await listServisYerleskeler()
    expect(data).toHaveLength(1)
  })
})

const gecerliGuzergah = {
  kod: 'dar-1',
  ad: 'Darıca Merkez',
  aciklama: 'Sabah ve akşam hattı',
  bolge: 'DARIÇA',
  yerleskeId: 'yer-1',
  gecerlilikBaslangici: '2026-08-01',
  gecerlilikBitisi: '2026-12-31',
}

describe('ServisGuzergah — view', () => {
  it('aktif filtresi ve yerleşke bilgisiyle listeler', async () => {
    mocks.guzergahFindMany.mockResolvedValue([{ id: 'g1', kod: 'DAR-1' }])
    const data = await listServisGuzergahlar({ aktif: true })
    expect(mocks.guzergahFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { aktif: true },
      include: { yerleske: { select: { id: true, kod: true, ad: true } } },
    }))
    expect(data).toHaveLength(1)
  })
})

describe('ServisGuzergah — create/edit', () => {
  it('tüm değiştirilebilir scalar alanları normalize edip kaydeder', async () => {
    mocks.guzergahFindUnique.mockResolvedValue(null)
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1', aktif: true })
    mocks.guzergahCreate.mockResolvedValue({ id: 'g1', kod: 'DAR-1', ad: 'Darıca Merkez' })

    await createServisGuzergah(gecerliGuzergah)

    expect(mocks.guzergahCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        kod: 'DAR-1',
        ad: 'Darıca Merkez',
        aciklama: 'Sabah ve akşam hattı',
        bolge: 'DARIÇA',
        yerleskeId: 'yer-1',
        gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'),
        gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
      }),
    }))
  })

  it('aynı kodla yeni kayıt oluşturmaz', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'baska', kod: 'DAR-1' })
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    await expect(createServisGuzergah(gecerliGuzergah)).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.guzergahCreate).not.toHaveBeenCalled()
  })

  it('olmayan yerleşkeyle kayıt oluşturmaz', async () => {
    mocks.guzergahFindUnique.mockResolvedValue(null)
    mocks.yerleskeFindUnique.mockResolvedValue(null)
    await expect(createServisGuzergah(gecerliGuzergah)).rejects.toThrow('Yerleşke bulunamadı')
  })

  it('bitiş tarihi başlangıçtan önceyse DB çağrısı yapmaz', async () => {
    await expect(createServisGuzergah({
      ...gecerliGuzergah,
      gecerlilikBaslangici: '2026-12-31',
      gecerlilikBitisi: '2026-08-01',
    })).rejects.toThrow('başlangıç tarihinden önce')
    expect(mocks.guzergahFindUnique).not.toHaveBeenCalled()
  })

  it('mevcut güzergâhı günceller', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', kod: 'DAR-1' })
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', kod: 'DAR-1', ad: 'Yeni Ad' })
    const data = await updateServisGuzergah('g1', { ...gecerliGuzergah, ad: 'Yeni Ad' })
    expect(data.ad).toBe('Yeni Ad')
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (GUZERGAH/OLUSTURMA)', async () => {
    mocks.guzergahFindUnique.mockResolvedValue(null)
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1', aktif: true })
    mocks.guzergahCreate.mockResolvedValue({ id: 'g1', kod: 'DAR-1', ad: 'Darıca Merkez' })
    await createServisGuzergah(gecerliGuzergah, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefTipi: 'GUZERGAH', hedefId: 'g1', islem: 'OLUSTURMA', userId: 'user-9' }),
    }))
  })

  it('yalnız değişen alanı (ad) ServisIslemGecmisi’ye yazar, diğer alanlar aynıysa dahil edilmez', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({
      id: 'g1', kod: 'DAR-1', ad: 'Eski Ad', aciklama: gecerliGuzergah.aciklama, bolge: gecerliGuzergah.bolge,
      yerleskeId: gecerliGuzergah.yerleskeId,
      gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'), gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
    })
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', ad: 'Yeni Ad' })
    await updateServisGuzergah('g1', { ...gecerliGuzergah, ad: 'Yeni Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH', hedefId: 'g1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { ad: 'Eski Ad' },
        yeniDeger: { ad: 'Yeni Ad' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({
      id: 'g1', kod: 'DAR-1', ad: gecerliGuzergah.ad, aciklama: gecerliGuzergah.aciklama, bolge: gecerliGuzergah.bolge,
      yerleskeId: gecerliGuzergah.yerleskeId,
      gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'), gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
    })
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1' })
    await updateServisGuzergah('g1', gecerliGuzergah, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisGuzergah — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: true })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: false })
    const data = await pasiflestirServisGuzergah('g1')
    expect(data.aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: true })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: false })
    await pasiflestirServisGuzergah('g1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH', hedefId: 'g1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif kaydı geri aktifleştirir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: false })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: true })
    const data = await geriAlServisGuzergah('g1')
    expect(data.aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: false })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: true })
    await geriAlServisGuzergah('g1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH', hedefId: 'g1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliDurak = {
  kod: 'drk-01',
  ad: 'İstasyon Şube',
  adresEtiketi: 'Ana cadde üzeri',
  il: 'Kocaeli',
  ilce: 'Gebze',
  mahalle: 'Güzeller',
  enlem: 40.802345,
  boylam: 29.431234,
}

describe('ServisDurak — view', () => {
  it('aktif filtresiyle kod ve ada göre sıralı listeler', async () => {
    mocks.durakFindMany.mockResolvedValue([{ id: 'd1', kod: 'DRK-01' }])
    const data = await listServisDuraklar({ aktif: true })
    expect(mocks.durakFindMany).toHaveBeenCalledWith({
      where: { aktif: true },
      orderBy: [{ kod: 'asc' }, { ad: 'asc' }],
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisDurak — create/edit', () => {
  it('tüm değiştirilebilir scalar alanları normalize edip kaydeder', async () => {
    mocks.durakFindUnique.mockResolvedValue(null)
    mocks.durakCreate.mockResolvedValue({ id: 'd1', kod: 'DRK-01', ad: 'İstasyon Şube' })

    await createServisDurak(gecerliDurak)

    expect(mocks.durakCreate).toHaveBeenCalledWith({
      data: {
        kod: 'DRK-01',
        ad: 'İstasyon Şube',
        adresEtiketi: 'Ana cadde üzeri',
        il: 'Kocaeli',
        ilce: 'Gebze',
        mahalle: 'Güzeller',
        enlem: 40.802345,
        boylam: 29.431234,
      },
    })
  })

  it('aynı kodla yeni kayıt oluşturmaz', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'baska', kod: 'DRK-01' })
    await expect(createServisDurak(gecerliDurak)).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.durakCreate).not.toHaveBeenCalled()
  })

  it('geçersiz koordinatlarla DB çağrısı yapmaz', async () => {
    await expect(createServisDurak({ ...gecerliDurak, enlem: 91 })).rejects.toThrow('Enlem')
    await expect(createServisDurak({ ...gecerliDurak, boylam: -181 })).rejects.toThrow('Boylam')
    expect(mocks.durakFindUnique).not.toHaveBeenCalled()
  })

  it('mevcut durağı günceller', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', kod: 'DRK-01' })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', kod: 'DRK-01', ad: 'Yeni Durak Adı' })
    const data = await updateServisDurak('d1', { ...gecerliDurak, ad: 'Yeni Durak Adı' })
    expect(data.ad).toBe('Yeni Durak Adı')
  })

  it('olmayan durağı güncellemez', async () => {
    mocks.durakFindUnique.mockResolvedValue(null)
    await expect(updateServisDurak('yok', gecerliDurak)).rejects.toThrow('Durak bulunamadı')
    expect(mocks.durakUpdate).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (DURAK/OLUSTURMA)', async () => {
    mocks.durakFindUnique.mockResolvedValue(null)
    mocks.durakCreate.mockResolvedValue({ id: 'd1', kod: 'DRK-01', ad: 'İstasyon Şube' })
    await createServisDurak(gecerliDurak, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefTipi: 'DURAK', hedefId: 'd1', islem: 'OLUSTURMA', userId: 'user-9' }),
    }))
  })

  it('yalnız değişen alanı (ad) ServisIslemGecmisi’ye yazar', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', ...gecerliDurak, kod: 'DRK-01', ad: 'Eski Durak Adı' })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', ad: 'Yeni Durak Adı' })
    await updateServisDurak('d1', { ...gecerliDurak, ad: 'Yeni Durak Adı' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'DURAK', hedefId: 'd1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { ad: 'Eski Durak Adı' },
        yeniDeger: { ad: 'Yeni Durak Adı' },
      }),
    }))
  })

  it('Regresyon: enlem/boylam Decimal↔number aynı değeri temsil ediyorsa GUNCELLEME kaydı YAZILMAZ', async () => {
    // service.ts'te existing satır gerçek Prisma.Decimal döner; mock'ta aynı
    // duck-type (toNumber) ile simüle ediliyor — degisenAlanlar'ın normalize
    // etmesi gerektiğini burada da sabitliyoruz (audit.test.ts'teki birim
    // testin servis katmanına entegre hâli).
    const sahteDecimal = (n: number) => ({ toNumber: () => n, toString: () => String(n) })
    mocks.durakFindUnique.mockResolvedValue({
      id: 'd1', ...gecerliDurak, kod: 'DRK-01',
      enlem: sahteDecimal(gecerliDurak.enlem), boylam: sahteDecimal(gecerliDurak.boylam),
    })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1' })
    await updateServisDurak('d1', gecerliDurak, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisDurak — passive/restore', () => {
  it('aktif durağı pasifleştirir', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: true })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: false })
    const data = await pasiflestirServisDurak('d1')
    expect(data.aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: true })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: false })
    await pasiflestirServisDurak('d1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'DURAK', hedefId: 'd1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif durağı geri aktifleştirir', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: false })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: true })
    const data = await geriAlServisDurak('d1')
    expect(data.aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: false })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: true })
    await geriAlServisDurak('d1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'DURAK', hedefId: 'd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliArac = {
  plaka: '41 abc 123',
  kapasite: 16,
  firmaId: 'firma-1',
  aracTipi: 'Minibüs',
  gecerlilikBaslangici: '2026-08-01',
  gecerlilikBitisi: '2026-12-31',
}

describe('ServisArac — view', () => {
  it('aktif filtresi ve firma bilgisiyle plakaya göre listeler', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41ABC123' }])
    const data = await listServisAraclar({ aktif: true })
    expect(mocks.aracFindMany).toHaveBeenCalledWith({
      where: { aktif: true },
      include: { firma: { select: { id: true, ad: true, aktif: true } } },
      orderBy: { plaka: 'asc' },
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisArac — create/edit', () => {
  it('plakayı boşluksuz büyük harfe çevirip tüm scalar alanları kaydeder', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracCreate.mockResolvedValue({ id: 'a1', plaka: '41ABC123' })

    await createServisArac(gecerliArac)

    expect(mocks.aracCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        plaka: '41ABC123',
        kapasite: 16,
        firmaId: 'firma-1',
        aracTipi: 'Minibüs',
        gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'),
        gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
      },
    }))
  })

  it('boşluk ve harf farkıyla aynı plakayı ikinci kez oluşturmaz', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'baska', plaka: '41ABC123', aktif: true }])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    await expect(createServisArac({ ...gecerliArac, plaka: ' 41 AbC 123 ' })).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5])('geçersiz kapasite %s değerini reddeder', async (kapasite) => {
    await expect(createServisArac({ ...gecerliArac, kapasite })).rejects.toThrow('pozitif tam sayı')
    expect(mocks.aracFindMany).not.toHaveBeenCalled()
  })

  it('pasif firmaya yeni araç bağlamaz', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: false })
    await expect(createServisArac(gecerliArac)).rejects.toThrow('Pasif firmaya')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('olmayan firmaya araç bağlamaz', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue(null)
    await expect(createServisArac(gecerliArac)).rejects.toThrow('Firma bulunamadı')
  })

  it('mevcut aracı aktif firmayla günceller', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', plaka: '41ABC123' })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', plaka: '41ABC123', kapasite: 18 })
    const data = await updateServisArac('a1', { ...gecerliArac, kapasite: 18 })
    expect(data.kapasite).toBe(18)
  })

  it('güncellemede pasif firmaya bağlamayı reddeder', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', plaka: '41ABC123' })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: false })
    await expect(updateServisArac('a1', gecerliArac)).rejects.toThrow('Pasif firmaya')
    expect(mocks.aracUpdate).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (ARAC/OLUSTURMA)', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracCreate.mockResolvedValue({ id: 'a1', plaka: '41ABC123' })
    await createServisArac(gecerliArac, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefTipi: 'ARAC', hedefId: 'a1', islem: 'OLUSTURMA', userId: 'user-9' }),
    }))
  })

  it('gecerlilikBaslangici/Bitisi DEĞİŞMEZSE (Date↔Date aynı an) ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.aracFindUnique.mockResolvedValue({
      id: 'a1', plaka: '41ABC123', kapasite: 16, firmaId: 'firma-1', aracTipi: 'Minibüs',
      gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'), gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
    })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', gecerliArac, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('yalnız değişen alanı (kapasite) ServisIslemGecmisi’ye yazar', async () => {
    mocks.aracFindUnique.mockResolvedValue({
      id: 'a1', plaka: '41ABC123', kapasite: 16, firmaId: 'firma-1', aracTipi: 'Minibüs',
      gecerlilikBaslangici: new Date('2026-08-01T00:00:00.000Z'), gecerlilikBitisi: new Date('2026-12-31T00:00:00.000Z'),
    })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', kapasite: 18 })
    await updateServisArac('a1', { ...gecerliArac, kapasite: 18 }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'ARAC', hedefId: 'a1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { kapasite: 16 }, yeniDeger: { kapasite: 18 },
      }),
    }))
  })
})

describe('ServisArac — passive/restore', () => {
  it('aktif aracı pasifleştirir', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: false })
    const data = await pasiflestirServisArac('a1')
    expect(data.aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: false })
    await pasiflestirServisArac('a1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'ARAC', hedefId: 'a1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif aracı geri aktifleştirir', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: false })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: true })
    const data = await geriAlServisArac('a1')
    expect(data.aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: false })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: true })
    await geriAlServisArac('a1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'ARAC', hedefId: 'a1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliSoforFirma = {
  adSoyad: 'Test Şoför',
  telefon: '0532 123 45 67',
  firmaId: 'firma-1',
}

const gecerliSoforPersonel = {
  adSoyad: 'Test Şoför',
  telefon: '0532 123 45 67',
  personnelId: 'personel-1',
}

describe('ServisSofor — view', () => {
  it('aktif filtresi, firma ve personel bilgisiyle ada göre listeler', async () => {
    mocks.soforFindMany.mockResolvedValue([{ id: 's1', adSoyad: 'Test Şoför' }])
    const data = await listServisSoforler({ aktif: true })
    expect(mocks.soforFindMany).toHaveBeenCalledWith({
      where: { aktif: true },
      include: {
        firma: { select: { id: true, ad: true, aktif: true } },
        personnel: { select: { id: true, adSoyad: true, sicilNo: true, aktif: true } },
      },
      orderBy: { adSoyad: 'asc' },
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisSofor — kimlik seçimi (dış firma XOR dahili personel)', () => {
  it('firmaId ve personnelId ikisi birden doluyken reddeder', async () => {
    await expect(createServisSofor({ ...gecerliSoforFirma, personnelId: 'personel-1' }))
      .rejects.toThrow('ikisi birden değil')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('firmaId ve personnelId ikisi de boşken reddeder', async () => {
    await expect(createServisSofor({ adSoyad: 'Test Şoför', telefon: null }))
      .rejects.toThrow('ikisi birden değil')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })
})

describe('ServisSofor — dış firma şoförü (firmaId)', () => {
  it('telefonu normalize eder ve kişisel veri içermeyen benzersiz dış kod üretir', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.soforCreate.mockResolvedValue({ id: 's1', adSoyad: 'Test Şoför' })

    await createServisSofor(gecerliSoforFirma)

    expect(mocks.soforCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adSoyad: 'Test Şoför',
        telefon: '+905321234567',
        firmaId: 'firma-1',
        personnelId: null,
        disFirmaSoforKodu: expect.stringMatching(/^DIS-[0-9A-F-]{36}$/),
      }),
    }))
  })

  it.each(['12345', '+901231234567', '0532ABC4567'])('geçersiz telefon %s değerini reddeder', async (telefon) => {
    await expect(createServisSofor({ ...gecerliSoforFirma, telefon })).rejects.toThrow('Türkiye telefon')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('telefonu boş bırakmaya izin verir', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.soforCreate.mockResolvedValue({ id: 's1' })
    await createServisSofor({ ...gecerliSoforFirma, telefon: '' })
    expect(mocks.soforCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ telefon: null }),
    }))
  })

  it('pasif firmaya yeni şoför bağlamaz', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: false })
    await expect(createServisSofor(gecerliSoforFirma)).rejects.toThrow('Pasif firmaya')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('olmayan firmaya şoför bağlamaz', async () => {
    mocks.firmaFindUnique.mockResolvedValue(null)
    await expect(createServisSofor(gecerliSoforFirma)).rejects.toThrow('Firma bulunamadı')
  })

  it('güncellemede mevcut teknik kimliği korur', async () => {
    mocks.soforFindUnique.mockResolvedValue({
      id: 's1', personnelId: null, disFirmaSoforKodu: 'DIS-MEVCUT',
    })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', adSoyad: 'Yeni Şoför' })
    await updateServisSofor('s1', { ...gecerliSoforFirma, adSoyad: 'Yeni Şoför' })
    expect(mocks.soforUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disFirmaSoforKodu: 'DIS-MEVCUT' }),
    }))
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (SOFOR/OLUSTURMA)', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.soforCreate.mockResolvedValue({ id: 's1' })
    await createServisSofor(gecerliSoforFirma, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefTipi: 'SOFOR', hedefId: 's1', islem: 'OLUSTURMA', userId: 'user-9' }),
    }))
  })

  it('yalnız değişen alanı (adSoyad) ServisIslemGecmisi’ye yazar — dahili personel şoförde personel adı DEĞİL, personnelId FK esas alınır', async () => {
    // id: 's1' hem "existing" hem "baskaSofor" kontrolünde döner — ikisi de
    // updateServisSofor içinde AYNI mocks.soforFindUnique'a çıkar (dogrulaServisSoforKimlik
    // içindeki "zaten bağlı" kontrolü); id eşit olduğundan çakışma sayılmaz.
    mocks.soforFindUnique.mockResolvedValue({
      id: 's1', adSoyad: 'Eski Ad', telefon: '+905321234567', firmaId: null, personnelId: 'personel-1', disFirmaSoforKodu: null,
    })
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', adSoyad: 'Yeni Ad' })
    await updateServisSofor('s1', { ...gecerliSoforPersonel, adSoyad: 'Yeni Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SOFOR', hedefId: 's1', islem: 'GUNCELLEME', userId: 'user-9',
        yeniDeger: { adSoyad: 'Yeni Ad' },
      }),
    }))
  })

  it('güncellemede pasif firmaya bağlamayı reddeder', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', disFirmaSoforKodu: 'DIS-MEVCUT' })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: false })
    await expect(updateServisSofor('s1', gecerliSoforFirma)).rejects.toThrow('Pasif firmaya')
    expect(mocks.soforUpdate).not.toHaveBeenCalled()
  })
})

describe('ServisSofor — dahili personel şoförü (personnelId)', () => {
  it('yalnız personnelId ile oluşturur, disFirmaSoforKodu üretmez', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.soforFindUnique.mockResolvedValue(null)
    mocks.soforCreate.mockResolvedValue({ id: 's1', adSoyad: 'Test Şoför' })

    await createServisSofor(gecerliSoforPersonel)

    expect(mocks.soforCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adSoyad: 'Test Şoför',
        firmaId: null,
        personnelId: 'personel-1',
        disFirmaSoforKodu: null,
      }),
    }))
  })

  it('olmayan personele şoför bağlamaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue(null)
    await expect(createServisSofor(gecerliSoforPersonel)).rejects.toThrow('Personel bulunamadı')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('pasif personeli şoför olarak atamaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: false })
    await expect(createServisSofor(gecerliSoforPersonel)).rejects.toThrow('Pasif personel')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('zaten bir şoför kaydına bağlı personeli tekrar bağlamaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.soforFindUnique.mockResolvedValue({ id: 's-baska' })
    await expect(createServisSofor(gecerliSoforPersonel)).rejects.toThrow('zaten bir şoför kaydına bağlı')
    expect(mocks.soforCreate).not.toHaveBeenCalled()
  })

  it('güncellemede kendi personelId eşleşmesini çakışma saymaz', async () => {
    mocks.soforFindUnique
      .mockResolvedValueOnce({ id: 's1', personnelId: 'personel-1', firmaId: null, disFirmaSoforKodu: null })
      .mockResolvedValueOnce({ id: 's1' })
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', adSoyad: 'Yeni Şoför' })

    await updateServisSofor('s1', { ...gecerliSoforPersonel, adSoyad: 'Yeni Şoför' })

    expect(mocks.soforUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ personnelId: 'personel-1', firmaId: null, disFirmaSoforKodu: null }),
    }))
  })

  it('firma bazlı şoförü personel bazlıya çevirince dış kodu temizler', async () => {
    mocks.soforFindUnique
      .mockResolvedValueOnce({ id: 's1', personnelId: null, firmaId: 'firma-1', disFirmaSoforKodu: 'DIS-ESKI' })
      .mockResolvedValueOnce(null)
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1' })

    await updateServisSofor('s1', gecerliSoforPersonel)

    expect(mocks.soforUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ firmaId: null, personnelId: 'personel-1', disFirmaSoforKodu: null }),
    }))
  })
})

describe('ServisSofor — passive/restore', () => {
  it('aktif şoförü pasifleştirir', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', aktif: false })
    expect((await pasiflestirServisSofor('s1')).aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', aktif: true })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', aktif: false })
    await pasiflestirServisSofor('s1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SOFOR', hedefId: 's1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif şoförü geri aktifleştirir', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', aktif: false })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', aktif: true })
    expect((await geriAlServisSofor('s1')).aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', aktif: false })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', aktif: true })
    await geriAlServisSofor('s1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SOFOR', hedefId: 's1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliSeferDilimi = {
  kod: 'v1-gidis',
  ad: 'Vardiya 1 Gidiş',
  yon: 'GIDIS' as const,
  grupKodu: 'VARDIYA-1',
  sira: 1,
}

describe('ServisSeferDilimi — view', () => {
  it('aktif filtresiyle sıra ve koda göre sıralı listeler', async () => {
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'sd1', kod: 'V1-GIDIS' }])
    const data = await listServisSeferDilimleri({ aktif: true })
    expect(mocks.seferDilimiFindMany).toHaveBeenCalledWith({
      where: { aktif: true },
      orderBy: [{ sira: 'asc' }, { kod: 'asc' }],
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisSeferDilimi — create/edit', () => {
  it('kodu büyük harfe çevirip normalize ederek kaydeder', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue(null)
    mocks.seferDilimiCreate.mockResolvedValue({ id: 'sd1', kod: 'V1-GIDIS' })

    await createServisSeferDilimi(gecerliSeferDilimi)

    expect(mocks.seferDilimiCreate).toHaveBeenCalledWith({
      data: {
        kod: 'V1-GIDIS',
        ad: 'Vardiya 1 Gidiş',
        yon: 'GIDIS',
        grupKodu: 'VARDIYA-1',
        sira: 1,
      },
    })
  })

  it('grupKodu boş bırakılabilir', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue(null)
    mocks.seferDilimiCreate.mockResolvedValue({ id: 'sd1' })
    await createServisSeferDilimi({ ...gecerliSeferDilimi, grupKodu: '' })
    expect(mocks.seferDilimiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grupKodu: null }),
    }))
  })

  it('aynı kodla yeni kayıt oluşturmaz', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'baska', kod: 'V1-GIDIS' })
    await expect(createServisSeferDilimi(gecerliSeferDilimi)).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.seferDilimiCreate).not.toHaveBeenCalled()
  })

  it('geçersiz yön veya sırayla DB çağrısı yapmaz', async () => {
    await expect(createServisSeferDilimi({ ...gecerliSeferDilimi, yon: 'YAN' as never })).rejects.toThrow('Yön')
    await expect(createServisSeferDilimi({ ...gecerliSeferDilimi, sira: 0 })).rejects.toThrow('Sıra')
    await expect(createServisSeferDilimi({ ...gecerliSeferDilimi, sira: 1.5 })).rejects.toThrow('Sıra')
    expect(mocks.seferDilimiFindUnique).not.toHaveBeenCalled()
  })

  it('mevcut dilimi günceller', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', kod: 'V1-GIDIS' })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', ad: 'Yeni Ad' })
    const data = await updateServisSeferDilimi('sd1', { ...gecerliSeferDilimi, ad: 'Yeni Ad' })
    expect(data.ad).toBe('Yeni Ad')
  })

  it('olmayan dilimi güncellemez', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue(null)
    await expect(updateServisSeferDilimi('yok', gecerliSeferDilimi)).rejects.toThrow('Sefer dilimi bulunamadı')
    expect(mocks.seferDilimiUpdate).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (SEFER_DILIMI/OLUSTURMA)', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue(null)
    mocks.seferDilimiCreate.mockResolvedValue({ id: 'sd1' })
    await createServisSeferDilimi(gecerliSeferDilimi, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefTipi: 'SEFER_DILIMI', hedefId: 'sd1', islem: 'OLUSTURMA', userId: 'user-9' }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', ...gecerliSeferDilimi, kod: 'V1-GIDIS' })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1' })
    await updateServisSeferDilimi('sd1', gecerliSeferDilimi, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('yalnız değişen alanı (ad) ServisIslemGecmisi’ye yazar', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', ...gecerliSeferDilimi, kod: 'V1-GIDIS' })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', ad: 'Yeni Ad' })
    await updateServisSeferDilimi('sd1', { ...gecerliSeferDilimi, ad: 'Yeni Ad' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SEFER_DILIMI', hedefId: 'sd1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { ad: 'Vardiya 1 Gidiş' }, yeniDeger: { ad: 'Yeni Ad' },
      }),
    }))
  })
})

describe('ServisSeferDilimi — passive/restore', () => {
  it('aktif dilimi pasifleştirir', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: true })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: false })
    expect((await pasiflestirServisSeferDilimi('sd1')).aktif).toBe(false)
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: true })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: false })
    await pasiflestirServisSeferDilimi('sd1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SEFER_DILIMI', hedefId: 'sd1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('pasif dilimi geri aktifleştirir', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: false })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: true })
    expect((await geriAlServisSeferDilimi('sd1')).aktif).toBe(true)
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: false })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: true })
    await geriAlServisSeferDilimi('sd1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SEFER_DILIMI', hedefId: 'sd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

describe('ServisGuzergahDurak — view', () => {
  it('güzergaha ait duraklari siraya göre listeler', async () => {
    mocks.guzergahDurakFindMany.mockResolvedValue([{ id: 'gd1', sira: 1 }])
    const data = await listServisGuzergahDuraklar('guzergah-1')
    expect(mocks.guzergahDurakFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'guzergah-1' },
      include: expect.any(Object),
      orderBy: { sira: 'asc' },
    })
    expect(data).toHaveLength(1)
  })

  it('aktif filtresi verildiğinde where içine ekler', async () => {
    mocks.guzergahDurakFindMany.mockResolvedValue([])
    await listServisGuzergahDuraklar('guzergah-1', { aktif: true })
    expect(mocks.guzergahDurakFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { guzergahId: 'guzergah-1', aktif: true },
    }))
  })
})

describe('ServisGuzergahDurak — durak ekleme', () => {
  it('yeni duragi mevcut en yüksek sıranın bir fazlasına ekler', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindMany.mockResolvedValue([
      { id: 'gd-a', sira: 1, aktif: true },
      { id: 'gd-b', sira: 2, aktif: true },
      { id: 'gd-c', sira: 3, aktif: true },
    ])
    mocks.guzergahDurakCreate.mockResolvedValue({ id: 'gd1', sira: 4 })

    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })

    expect(mocks.guzergahDurakCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { guzergahId: 'guzergah-1', durakId: 'durak-1', sira: 4 },
    }))
  })

  it('güzergahın ilk durağını sira=1 ile ekler', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindMany.mockResolvedValue([])
    mocks.guzergahDurakCreate.mockResolvedValue({ id: 'gd1', sira: 1 })

    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })

    expect(mocks.guzergahDurakCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { guzergahId: 'guzergah-1', durakId: 'durak-1', sira: 1 },
    }))
  })

  it('pasif güzergaha durak eklemez', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: false })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindFirst.mockResolvedValue(null)
    await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })).rejects.toThrow('Pasif güzergaha')
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
  })

  it('pasif duragi güzergaha eklemez', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: false })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindFirst.mockResolvedValue(null)
    await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })).rejects.toThrow('Pasif durak')
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
  })

  it('zaten aktif eklenmiş duragi tekrar eklemez', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd-eski', aktif: true })
    mocks.guzergahDurakFindFirst.mockResolvedValue(null)
    await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })).rejects.toThrow('zaten bu güzergahta')
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
  })

  it('pasifleştirilmiş eski kaydı tekrar eklemek yerine geri-al önerir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd-eski', aktif: false })
    mocks.guzergahDurakFindFirst.mockResolvedValue(null)
    await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' })).rejects.toThrow('geri alın')
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (GUZERGAH_DURAK/OLUSTURMA)', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-1', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindMany.mockResolvedValue([])
    mocks.guzergahDurakCreate.mockResolvedValue({ id: 'gd1', sira: 1 })
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-1' }, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK', hedefId: 'gd1', islem: 'OLUSTURMA', userId: 'user-9',
        yeniDeger: { guzergahId: 'guzergah-1', durakId: 'durak-1', sira: 1 },
      }),
    }))
  })
})

describe('ServisGuzergahDurak — pasifleştir/geri-al saat verisini korur', () => {
  it('durağı pasifleştirip geri alma saat kayıtlarına dokunmaz', async () => {
    mocks.guzergahDurakFindUnique
      .mockResolvedValueOnce({ id: 'gd1', aktif: true })
      .mockResolvedValueOnce({ id: 'gd1', aktif: false })
    mocks.guzergahDurakUpdate
      .mockResolvedValueOnce({ id: 'gd1', aktif: false })
      .mockResolvedValueOnce({ id: 'gd1', aktif: true })

    await pasiflestirServisGuzergahDurak('gd1')
    await geriAlServisGuzergahDurak('gd1')

    expect(mocks.guzergahDurakUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: 'gd1' },
      data: { aktif: false },
    }))
    expect(mocks.guzergahDurakUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'gd1' },
      data: { aktif: true },
    }))
    // Pasifleştir/geri-al yalnızca `aktif` alanını değiştirir — saat
    // tablosuna hiçbir zaman delete/deleteMany çağrısı yapılmaz.
    expect(mocks.guzergahDurakSaatDelete).not.toHaveBeenCalled()

    // Bu durak için önceden girilmiş bir saat kaydı hâlâ listede görünür
    // (uçtan uca akış: saat gir → pasifleştir → geri al → veri hâlâ orada).
    const saatKaydi = { id: 'saat-1', guzergahDurakId: 'gd1', dilimId: 'dilim-1', saat: '08:30' }
    mocks.guzergahDurakFindMany.mockResolvedValue([{ id: 'gd1', aktif: true, saatler: [saatKaydi] }])
    const liste = await listServisGuzergahDuraklar('guzergah-1')
    expect(liste[0].saatler).toEqual([saatKaydi])
  })
})

describe('ServisGuzergahDurak — pasifleştir/geri-al ServisIslemGecmisi', () => {
  it('pasifleştirme kaydı yazar', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.guzergahDurakUpdate.mockResolvedValue({ id: 'gd1', aktif: false })
    await pasiflestirServisGuzergahDurak('gd1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK', hedefId: 'gd1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
      }),
    }))
  })

  it('geri alma kaydı yazar', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: false })
    mocks.guzergahDurakUpdate.mockResolvedValue({ id: 'gd1', aktif: true })
    await geriAlServisGuzergahDurak('gd1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK', hedefId: 'gd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

// @@unique([guzergahId, sira]) DB'de ANLIK kontrol edilir (deferrable değil).
// Aşağıdaki sahte-DB, gerçek Postgres'in bu davranışını simüle eder: bir
// update başka bir kaydın hâlihazırda sahip olduğu sira'ya yazmaya çalışırsa
// (tıpkı gerçek unique index gibi) hata fırlatır. Servis kodu iki/üç fazlı
// (önce geçici, sonra nihai) bir sıralama stratejisi kullanmazsa bu testler
// GERÇEKTEN patlar — yani "hata almadığını" sahte biçimde değil, kodun asıl
// yazma sırasını simüle ederek kanıtlar.
function siraKisitliSahteDB(baslangic: { id: string; sira: number; aktif: boolean }[]) {
  const kayitlar = new Map(baslangic.map((k) => [k.id, { ...k }]))
  function update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
    const kayit = kayitlar.get(where.id)
    if (!kayit) throw new Error(`Sahte DB: kayıt yok — ${where.id}`)
    if (typeof data.sira === 'number') {
      const cakisan = [...kayitlar.values()].find((k) => k.id !== where.id && k.sira === data.sira)
      if (cakisan) {
        throw new Error(
          `Unique constraint failed on the fields: (\`guzergahId\`,\`sira\`) — id=${where.id} sira=${data.sira} zaten id=${cakisan.id} tarafından kullanılıyor.`,
        )
      }
    }
    Object.assign(kayit, data)
    return Promise.resolve({ ...kayit })
  }
  function create({ data }: { data: { sira: number; id?: string } & Record<string, unknown> }) {
    const cakisan = [...kayitlar.values()].find((k) => k.sira === data.sira)
    if (cakisan) {
      throw new Error(
        `Unique constraint failed on the fields: (\`guzergahId\`,\`sira\`) — yeni kayıt sira=${data.sira} zaten id=${cakisan.id} tarafından kullanılıyor.`,
      )
    }
    const kayit = { id: data.id ?? 'gd-yeni', sira: data.sira, aktif: true }
    kayitlar.set(kayit.id, kayit)
    return Promise.resolve({ ...kayit })
  }
  // Gerçek Prisma findMany'nin döndürdüğü objeler DB'den taze snapshot'tır —
  // sonraki update() çağrıları onları GERİYE DÖNÜP mutasyona uğratmaz. Burada
  // da KLON döndürülür; aksi halde servis kodunun elinde tuttuğu referanslar
  // (secili/komsu) sahte-DB'nin kendi iç Map'iyle paylaşılır ve update()'in
  // Object.assign'ı onları test'in kontrolü dışında mutasyona uğratır — bu,
  // servis kodunda değil, sahte-DB'de yanlış bir "hata" üretir.
  function bul() {
    return [...kayitlar.values()].map((k) => ({ ...k })).sort((a, b) => a.sira - b.sira)
  }
  return { kayitlar, update, create, bul }
}

describe('ServisGuzergahDurak — yukarı/aşağı sıralama (unique-constraint güvenliği)', () => {
  it('3 durağı ok butonlarıyla yeniden sıralarken sira çakışması oluşmaz', async () => {
    const sahteDB = siraKisitliSahteDB([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: true },
      { id: 'gd3', sira: 3, aktif: true },
    ])
    mocks.guzergahDurakFindMany.mockImplementation(() =>
      Promise.resolve(sahteDB.bul()),
    )
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)

    // gd3'ü iki kez yukarı taşı → en üste çıkmalı: [gd3, gd1, gd2]
    await siraDegistirServisGuzergahDurak('guzergah-1', 'gd3', 'YUKARI')
    await siraDegistirServisGuzergahDurak('guzergah-1', 'gd3', 'YUKARI')

    const nihaiSira = sahteDB.bul().map((k) => k.id)
    expect(nihaiSira).toEqual(['gd3', 'gd1', 'gd2'])
  })

  it('en üstteki durağı yukarı taşımaya çalışmak no-op olur', async () => {
    const sahteDB = siraKisitliSahteDB([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: true },
    ])
    mocks.guzergahDurakFindMany.mockImplementation(() =>
      Promise.resolve(sahteDB.bul()),
    )
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)

    await siraDegistirServisGuzergahDurak('guzergah-1', 'gd1', 'YUKARI')

    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
  })
})

describe('ServisGuzergahDurak — sürükle-bırak toplu yeniden sıralama (unique-constraint güvenliği)', () => {
  it('3 durağı tam tersine çevirirken sira çakışması oluşmaz', async () => {
    const sahteDB = siraKisitliSahteDB([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: true },
      { id: 'gd3', sira: 3, aktif: true },
    ])
    mocks.guzergahDurakFindMany.mockImplementation(() =>
      Promise.resolve(sahteDB.bul()),
    )
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)

    await yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd3', 'gd2', 'gd1'])

    const nihaiSira = sahteDB.bul().map((k) => k.id)
    expect(nihaiSira).toEqual(['gd3', 'gd2', 'gd1'])
  })

  it('aktif duraklarla birebir eşleşmeyen listeyi reddeder', async () => {
    mocks.guzergahDurakFindMany.mockResolvedValue([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: true },
    ])
    await expect(yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd1'])).rejects.toThrow('birebir eşleşmiyor')
    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
  })

  it('pasif duraklar sona eklenir, aktiflerin çakışmasına neden olmaz', async () => {
    const sahteDB = siraKisitliSahteDB([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: false },
      { id: 'gd3', sira: 3, aktif: true },
    ])
    mocks.guzergahDurakFindMany.mockImplementation(() =>
      Promise.resolve(sahteDB.bul()),
    )
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)

    await yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd3', 'gd1'])

    const nihaiSira = sahteDB.bul().map((k) => k.id)
    expect(nihaiSira).toEqual(['gd3', 'gd1', 'gd2'])
  })
})

describe('ServisGuzergahDurak — A2: araya ekleme (kaydırma, kod değişmez, audit)', () => {
  function kurAraya(baslangic: { id: string; sira: number; aktif: boolean }[]) {
    const sahteDB = siraKisitliSahteDB(baslangic)
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.durakFindUnique.mockResolvedValue({ id: 'durak-yeni', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakFindMany.mockImplementation(() => Promise.resolve(sahteDB.bul()))
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)
    mocks.guzergahDurakCreate.mockImplementation((arg: { data: { sira: number } }) =>
      sahteDB.create({ data: { ...arg.data, id: 'gd-yeni' } }),
    )
    return sahteDB
  }
  const bes = () => [1, 2, 3, 4, 5].map((n) => ({ id: `gd${n}`, sira: n, aktif: true }))
  const auditler = () => mocks.islemGecmisiCreate.mock.calls.map((c) => c[0].data)

  it('3. ile 4. arasına (konum 4) ekleme: sonraki duraklar kayar, yeni durak 4. sırada, çakışma yok', async () => {
    const sahteDB = kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 4 }, 'user-1')
    expect(sahteDB.bul().map((k) => k.id)).toEqual(['gd1', 'gd2', 'gd3', 'gd-yeni', 'gd4', 'gd5'])
    expect(sahteDB.bul().map((k) => k.sira)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('kaydırma EN YÜKSEK sira\'dan başlar (geçici ofset gerekmez), yalnız sira yazılır', async () => {
    kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 4 }, 'user-1')
    const guncellemeler = mocks.guzergahDurakUpdate.mock.calls.map((c) => ({ id: c[0].where.id, data: c[0].data }))
    expect(guncellemeler).toEqual([
      { id: 'gd5', data: { sira: 6 } },
      { id: 'gd4', data: { sira: 5 } },
    ])
  })

  it('🔴 mevcut durak KODLARI değişmez: ServisDurak hiç güncellenmez', async () => {
    kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 2 }, 'user-1')
    expect(mocks.durakUpdate).not.toHaveBeenCalled()
    expect(mocks.durakCreate).not.toHaveBeenCalled()
  })

  it('audit: her kaydırılan satır için GUNCELLEME (eski sira → yeni sira) + yeni satır için OLUSTURMA, yapan kullanıcıyla', async () => {
    kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 4 }, 'user-1')
    const a = auditler()
    expect(a).toHaveLength(3)
    expect(a.filter((x) => x.islem === 'GUNCELLEME').map((x) => [x.hedefId, x.oncekiDeger, x.yeniDeger])).toEqual([
      ['gd5', { sira: 5 }, { sira: 6 }],
      ['gd4', { sira: 4 }, { sira: 5 }],
    ])
    expect(a.every((x) => x.hedefTipi === 'GUZERGAH_DURAK' && x.userId === 'user-1')).toBe(true)
    expect(a.find((x) => x.islem === 'OLUSTURMA')).toMatchObject({
      hedefId: 'gd-yeni',
      yeniDeger: { guzergahId: 'guzergah-1', durakId: 'durak-yeni', sira: 4 },
      aciklama: 'Araya eklendi (konum 4).',
    })
    expect(a.find((x) => x.islem === 'GUNCELLEME')!.aciklama).toMatch(/Araya durak eklendi/)
  })

  it('konum 1: başa ekler, hepsi kayar', async () => {
    const sahteDB = kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 1 }, 'user-1')
    expect(sahteDB.bul().map((k) => k.id)).toEqual(['gd-yeni', 'gd1', 'gd2', 'gd3', 'gd4', 'gd5'])
    expect(auditler().filter((x) => x.islem === 'GUNCELLEME')).toHaveLength(5)
  })

  it('konum = aktif sayısı + 1 ve konum verilmemesi: sona ekler, kaydırma/GUNCELLEME yok', async () => {
    for (const form of [{ durakId: 'durak-yeni', konum: 6 }, { durakId: 'durak-yeni' }]) {
      vi.clearAllMocks()
      const sahteDB = kurAraya(bes())
      await createServisGuzergahDurak('guzergah-1', form, 'user-1')
      expect(sahteDB.bul().map((k) => k.id)).toEqual(['gd1', 'gd2', 'gd3', 'gd4', 'gd5', 'gd-yeni'])
      expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
      expect(auditler()).toHaveLength(1)
      expect(auditler()[0].aciklama ?? null).toBeNull()
    }
  })

  it('pasif duraklar da kayar (unique için) ve aktif sıralama doğru kalır', async () => {
    const sahteDB = kurAraya([
      { id: 'a', sira: 1, aktif: true },
      { id: 'p', sira: 2, aktif: false },
      { id: 'b', sira: 3, aktif: true },
      { id: 'c', sira: 4, aktif: true },
    ])
    // aktifler: a(1), b(2), c(3) → konum 2 = b'den önce
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 2 }, 'user-1')
    expect(sahteDB.bul().filter((k) => k.aktif).map((k) => k.id)).toEqual(['a', 'gd-yeni', 'b', 'c'])
    expect(new Set(sahteDB.bul().map((k) => k.sira)).size).toBe(5) // hepsi benzersiz
  })

  it('aralık dışı konum reddedilir, hiçbir yazma olmaz', async () => {
    kurAraya(bes())
    await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 8 })).rejects.toThrow(
      'Konum 1 ile 6 arasında olmalıdır.',
    )
    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('geçersiz konum (0, -1, 2.5) validasyonda reddedilir', async () => {
    for (const konum of [0, -1, 2.5]) {
      await expect(createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum })).rejects.toThrow('Konum')
    }
    expect(mocks.guzergahDurakCreate).not.toHaveBeenCalled()
  })

  it('🔴 audit fail-closed: audit yazılamazsa işlem hata ile biter', async () => {
    kurAraya(bes())
    mocks.islemGecmisiCreate.mockRejectedValueOnce(new Error('audit yazılamadı'))
    await expect(
      createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 4 }, 'user-1'),
    ).rejects.toThrow('audit yazılamadı')
  })

  it('sıra işlemi güzergâh bazlı advisory lock alır', async () => {
    kurAraya(bes())
    await createServisGuzergahDurak('guzergah-1', { durakId: 'durak-yeni', konum: 4 }, 'user-1')
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1)
    const [parcalar, deger] = mocks.executeRaw.mock.calls[0]
    expect(parcalar.join('')).toContain('pg_advisory_xact_lock')
    expect(deger).toBe('servis-durak-sira:guzergah-1')
  })
})

describe('ServisGuzergahDurak — A2: sıra değişikliği audit (yukarı/aşağı + toplu)', () => {
  const auditler = () => mocks.islemGecmisiCreate.mock.calls.map((c) => c[0].data)
  function kurSira(baslangic: { id: string; sira: number; aktif: boolean }[]) {
    const sahteDB = siraKisitliSahteDB(baslangic)
    mocks.guzergahDurakFindMany.mockImplementation(() => Promise.resolve(sahteDB.bul()))
    mocks.guzergahDurakUpdate.mockImplementation(sahteDB.update)
    return sahteDB
  }
  const uc = () => [1, 2, 3].map((n) => ({ id: `gd${n}`, sira: n, aktif: true }))

  it('yukarı/aşağı: İKİ kayıt için eski sira → yeni sira audit satırı, yapan kullanıcıyla', async () => {
    kurSira(uc())
    await siraDegistirServisGuzergahDurak('guzergah-1', 'gd3', 'YUKARI', 'user-7')
    const a = auditler()
    expect(a).toHaveLength(2)
    expect(a.map((x) => [x.hedefId, x.islem, x.oncekiDeger, x.yeniDeger, x.userId])).toEqual([
      ['gd3', 'GUNCELLEME', { sira: 3 }, { sira: 2 }, 'user-7'],
      ['gd2', 'GUNCELLEME', { sira: 2 }, { sira: 3 }, 'user-7'],
    ])
    expect(a[0]).toMatchObject({ hedefTipi: 'GUZERGAH_DURAK', aciklama: 'Sıra değiştirildi (yukarı).' })
  })

  it('uçtaki durak (no-op): audit yazılmaz', async () => {
    kurSira(uc())
    await siraDegistirServisGuzergahDurak('guzergah-1', 'gd1', 'YUKARI', 'user-7')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
  })

  it('pasif/yok durak: hata, audit yok', async () => {
    kurSira(uc())
    await expect(siraDegistirServisGuzergahDurak('guzergah-1', 'yok', 'YUKARI', 'u')).rejects.toThrow('bulunamadı veya pasif')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('🔴 audit fail-closed (yukarı/aşağı)', async () => {
    kurSira(uc())
    mocks.islemGecmisiCreate.mockRejectedValueOnce(new Error('audit yazılamadı'))
    await expect(siraDegistirServisGuzergahDurak('guzergah-1', 'gd3', 'YUKARI', 'u')).rejects.toThrow('audit yazılamadı')
  })

  it('toplu sıralama: yalnız sırası DEĞİŞEN kayıtlar için audit (eski → yeni)', async () => {
    kurSira(uc())
    await yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd1', 'gd3', 'gd2'], 'user-7') // gd1 aynı kaldı
    const a = auditler()
    expect(a.map((x) => [x.hedefId, x.oncekiDeger, x.yeniDeger]).sort()).toEqual([
      ['gd2', { sira: 2 }, { sira: 3 }],
      ['gd3', { sira: 3 }, { sira: 2 }],
    ])
    expect(a.every((x) => x.userId === 'user-7' && x.islem === 'GUNCELLEME')).toBe(true)
  })

  it('toplu sıralama: aynı sıra gönderilirse yazma da audit de YOK', async () => {
    kurSira(uc())
    await yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd1', 'gd2', 'gd3'], 'user-7')
    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('toplu sıralama: pasif kayıt sona kayarsa onun sirası da audit\'lenir', async () => {
    kurSira([
      { id: 'gd1', sira: 1, aktif: true },
      { id: 'gd2', sira: 2, aktif: false },
      { id: 'gd3', sira: 3, aktif: true },
    ])
    await yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd1', 'gd3'], 'user-7')
    const a = auditler()
    expect(a.map((x) => x.hedefId).sort()).toEqual(['gd2', 'gd3'])
  })

  it('🔴 audit fail-closed (toplu)', async () => {
    kurSira(uc())
    mocks.islemGecmisiCreate.mockRejectedValueOnce(new Error('audit yazılamadı'))
    await expect(yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd3', 'gd2', 'gd1'], 'u')).rejects.toThrow('audit yazılamadı')
  })

  it('uyuşmayan liste: hata, yazma/audit yok', async () => {
    kurSira(uc())
    await expect(yenidenSiralaServisGuzergahDuraklar('guzergah-1', ['gd1'], 'u')).rejects.toThrow('birebir eşleşmiyor')
    expect(mocks.guzergahDurakUpdate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisGuzergahDurakSaat — kaydet/pasifleştir/geri-al (aktif bayrağı, 20260831113946_servis_saat_aktif)', () => {
  const gecerliSaat = { dilimId: 'dilim-1', saat: '08:30' }

  it('geçerli saati upsert eder, update bloğu HER ZAMAN aktif:true yazar (pasif satırı reaktive eder)', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat })

    await guzergahDurakSaatiKaydet('gd1', gecerliSaat)

    expect(mocks.guzergahDurakSaatUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { guzergahDurakId_dilimId: { guzergahDurakId: 'gd1', dilimId: 'dilim-1' } },
      create: { guzergahDurakId: 'gd1', dilimId: 'dilim-1', saat: '08:30' },
      update: { saat: '08:30', aktif: true },
    }))
  })

  it.each(['8:30', '25:00', '08:60', 'saat'])('geçersiz saat %s değerini reddeder', async (saat) => {
    await expect(guzergahDurakSaatiKaydet('gd1', { ...gecerliSaat, saat })).rejects.toThrow('SS:DD')
    expect(mocks.guzergahDurakSaatUpsert).not.toHaveBeenCalled()
  })

  it('pasif güzergah-durak eşleşmesine saat girilemez', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: false })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    await expect(guzergahDurakSaatiKaydet('gd1', gecerliSaat)).rejects.toThrow('Pasif güzergâh-durak')
    expect(mocks.guzergahDurakSaatUpsert).not.toHaveBeenCalled()
  })

  it('pasif sefer dilimine saat girilemez', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: false })
    await expect(guzergahDurakSaatiKaydet('gd1', gecerliSaat)).rejects.toThrow('Pasif sefer dilimine')
    expect(mocks.guzergahDurakSaatUpsert).not.toHaveBeenCalled()
  })

  it('mevcut saat kaydını PASİFLEŞTİRİR (soft — update aktif:false, delete ÇAĞRILMAZ)', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', aktif: true })
    mocks.guzergahDurakSaatUpdate.mockResolvedValue({ id: 's1', aktif: false })
    await guzergahDurakSaatiSil('s1')
    expect(mocks.guzergahDurakSaatUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' }, data: { aktif: false },
    }))
    expect(mocks.guzergahDurakSaatDelete).not.toHaveBeenCalled()
  })

  it('olmayan saat kaydını pasifleştirmez', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue(null)
    await expect(guzergahDurakSaatiSil('yok')).rejects.toThrow('bulunamadı')
    expect(mocks.guzergahDurakSaatUpdate).not.toHaveBeenCalled()
  })

  it('zaten pasif saat kaydını tekrar pasifleştirmez', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', aktif: false })
    await expect(guzergahDurakSaatiSil('s1')).rejects.toThrow('zaten pasif')
    expect(mocks.guzergahDurakSaatUpdate).not.toHaveBeenCalled()
  })

  it('ilk kayıt (upsert→create) ServisIslemGecmisi’ye GUZERGAH_DURAK_SAAT/OLUSTURMA yazar, hedefId ATAMANIN DEĞİL güzergah-durağın id’sidir', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue(null)
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat })
    await guzergahDurakSaatiKaydet('gd1', gecerliSaat, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'OLUSTURMA', userId: 'user-9',
        yeniDeger: { dilimId: 'dilim-1', saat: '08:30' },
      }),
    }))
  })

  it('mevcut AKTİF saat DEĞİŞİRSE (upsert→update) GUNCELLEME yazar', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', saat: '07:00', aktif: true })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat })
    await guzergahDurakSaatiKaydet('gd1', gecerliSaat, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'GUNCELLEME', userId: 'user-9',
        oncekiDeger: { dilimId: 'dilim-1', saat: '07:00' },
        yeniDeger: { dilimId: 'dilim-1', saat: '08:30' },
      }),
    }))
  })

  it('saat DEĞİŞMEZSE (aynı değer aktif satıra yeniden kaydedilirse) ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', saat: '08:30', aktif: true })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat })
    await guzergahDurakSaatiKaydet('gd1', gecerliSaat, 'user-9')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  // REAKTİVASYON (bu talimatın çekirdeği): pasif bir satıra kaydet çağrılırsa
  // GUNCELLEME değil AKTIFLESTIRME yazılmalı — ServisGuzergahDurak'ın
  // geri-al'ıyla aynı "pasif→aktif = AKTIFLESTIRME" kuralı.
  it('PASİF satıra yeniden kaydet → AKTIFLESTIRME yazar (saat de değişmiş olsa bile)', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', saat: '07:00', aktif: false })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat, aktif: true })
    await guzergahDurakSaatiKaydet('gd1', gecerliSaat, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false, saat: '07:00' },
        yeniDeger: { aktif: true, saat: '08:30' },
      }),
    }))
  })

  it('PASİF satıra AYNI saatle yeniden kaydet → AKTIFLESTIRME yazar, ama diff’te yalnız aktif olur (saat değişmedi)', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', saat: '08:30', aktif: false })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat, aktif: true })
    await guzergahDurakSaatiKaydet('gd1', gecerliSaat, 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar (PASIFLESTIRME), hedefId güzergah-durağın id’sidir', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', guzergahDurakId: 'gd1', dilimId: 'dilim-1', saat: '08:30', aktif: true })
    mocks.guzergahDurakSaatUpdate.mockResolvedValue({ id: 's1', aktif: false })
    await guzergahDurakSaatiSil('s1', 'user-9')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'PASIFLESTIRME', userId: 'user-9',
        oncekiDeger: { dilimId: 'dilim-1', aktif: true }, yeniDeger: { dilimId: 'dilim-1', aktif: false },
      }),
    }))
  })

  it('geri-al: pasif saat kaydını aktif yapar, ServisIslemGecmisi AKTIFLESTIRME yazar', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', guzergahDurakId: 'gd1', dilimId: 'dilim-1', saat: '08:30', aktif: false })
    mocks.guzergahDurakSaatUpdate.mockResolvedValue({ id: 's1', aktif: true })
    await geriAlGuzergahDurakSaat('s1', 'user-9')
    expect(mocks.guzergahDurakSaatUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' }, data: { aktif: true },
    }))
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_DURAK_SAAT', hedefId: 'gd1', islem: 'AKTIFLESTIRME', userId: 'user-9',
        oncekiDeger: { dilimId: 'dilim-1', aktif: false }, yeniDeger: { dilimId: 'dilim-1', aktif: true },
      }),
    }))
  })

  it('geri-al: olmayan saat kaydını geri almaz', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue(null)
    await expect(geriAlGuzergahDurakSaat('yok')).rejects.toThrow('bulunamadı')
    expect(mocks.guzergahDurakSaatUpdate).not.toHaveBeenCalled()
  })

  it('geri-al: zaten aktif saat kaydını tekrar geri almaz', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1', aktif: true })
    await expect(geriAlGuzergahDurakSaat('s1')).rejects.toThrow('zaten aktif')
    expect(mocks.guzergahDurakSaatUpdate).not.toHaveBeenCalled()
  })
})

const gecerliAracVarsayilan = {
  guzergahId: 'guzergah-1',
  dilimId: 'dilim-1',
  aracId: 'arac-1',
  rol: 'ANA' as const,
  baslangicTarihi: '2026-01-01',
}

describe('ServisGuzergahAracVarsayilan — view', () => {
  it('güzergaha ait varsayılanları aktif-en-üstte, tarihe göre listeler', async () => {
    mocks.aracVarsayilanFindMany.mockResolvedValue([{ id: 'v1' }])
    const data = await listServisGuzergahAracVarsayilanlari('guzergah-1')
    expect(mocks.aracVarsayilanFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'guzergah-1' },
      include: expect.any(Object),
      orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisGuzergahAracVarsayilan — oluşturma', () => {
  beforeEach(() => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.aracFindUnique.mockResolvedValue({ id: 'arac-1', aktif: true })
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
  })

  it('geçerli ANA atamayı oluşturur', async () => {
    mocks.aracVarsayilanCreate.mockResolvedValue({ id: 'v1', ...gecerliAracVarsayilan })
    await createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')
    expect(mocks.aracVarsayilanCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        guzergahId: 'guzergah-1', dilimId: 'dilim-1', aracId: 'arac-1', rol: 'ANA',
        createdById: 'user-1',
      }),
    }))
  })

  it('pasif güzergaha atama yapmaz', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: false })
    await expect(createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')).rejects.toThrow('Pasif güzergaha')
    expect(mocks.aracVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('pasif dilime atama yapmaz', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: false })
    await expect(createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')).rejects.toThrow('Pasif sefer dilimine')
    expect(mocks.aracVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('pasif aracı varsayılan atamaz', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'arac-1', aktif: false })
    await expect(createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')).rejects.toThrow('Pasif araç')
    expect(mocks.aracVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('aynı araç aynı dilimde çakışan tarihte başka güzergahın ANA aracıysa reddeder (EXCLUDE simülasyonu)', async () => {
    mocks.aracVarsayilanFindFirst.mockResolvedValue({
      id: 'v-eski',
      baslangicTarihi: new Date('2025-12-01'),
      bitisTarihi: null,
      guzergah: { kod: 'BASKA', ad: 'Başka Güzergah' },
    })
    await expect(createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1'))
      .rejects.toThrow('zaten "BASKA — Başka Güzergah" güzergahının ANA aracı')
    expect(mocks.aracVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('YEDEK rol için çakışma kontrolü hiç yapılmaz (DB kısıtı yalnız ANA içindir)', async () => {
    mocks.aracVarsayilanCreate.mockResolvedValue({ id: 'v1' })
    await createServisGuzergahAracVarsayilan({ ...gecerliAracVarsayilan, rol: 'YEDEK' }, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).not.toHaveBeenCalled()
    expect(mocks.aracVarsayilanCreate).toHaveBeenCalled()
  })

  it('geçersiz rol veya eksik tarihle DB çağrısı yapmaz', async () => {
    await expect(createServisGuzergahAracVarsayilan({ ...gecerliAracVarsayilan, rol: 'BASKA' as never }, 'user-1'))
      .rejects.toThrow('Rol ANA veya YEDEK')
    await expect(createServisGuzergahAracVarsayilan({ ...gecerliAracVarsayilan, baslangicTarihi: '' }, 'user-1'))
      .rejects.toThrow('Başlangıç tarihi')
    expect(mocks.guzergahFindUnique).not.toHaveBeenCalled()
  })

  // Regresyon: SQL'de "sütun < değer" bir NULL sütun için NULL'a (yani
  // "false" değil, "bilinmiyor"a) değerlendirilir — bitisTarihi=NULL (süresiz
  // atama) olan bir kaydı "existing.bitisTarihi < aday.baslangic" ile ELEMEYE
  // çalışan bir NOT/OR ifadesi bu satırı YANLIŞLIKLA sonuçtan düşürür (gerçek
  // Postgres'e karşı ampirik olarak doğrulandı — bu regresyonun kendisi
  // production'da bir kez gerçekten oluştu ve düzeltildi). Bu test, üretilen
  // WHERE ifadesinin NULL-güvenli (OR bitisTarihi:null, gte) biçimde
  // kaldığını sabitler; birisi bunu tekrar NOT+lt'ye çevirirse test kırılır.
  it('süresiz (bitisTarihi=null) mevcut atamayla çakışma sorgusu NULL-güvenli kurulur', async () => {
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    await createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [
          { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: expect.any(Date) } }] },
        ],
      }),
    }))
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (GUZERGAH_ARAC_VARSAYILAN/OLUSTURMA)', async () => {
    mocks.aracVarsayilanCreate.mockResolvedValue({ id: 'v1' })
    await createServisGuzergahAracVarsayilan(gecerliAracVarsayilan, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', hedefId: 'v1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: expect.objectContaining({ guzergahId: 'guzergah-1', dilimId: 'dilim-1', aracId: 'arac-1', rol: 'ANA' }),
      }),
    }))
  })
})

describe('ServisGuzergahAracVarsayilan — güncelleme (sınırlı)', () => {
  it('bitisTarihi uzatılırken yeni bir çakışma varsa reddeder', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-10'),
    })
    mocks.aracVarsayilanFindFirst.mockResolvedValue({
      id: 'v-baska', baslangicTarihi: new Date('2026-01-15'), bitisTarihi: null,
      guzergah: { kod: 'BASKA', ad: 'Başka Güzergah' },
    })
    await expect(
      guncelleServisGuzergahAracVarsayilan('v1', { bitisTarihi: '2026-02-01' }, 'user-1'),
    ).rejects.toThrow('zaten "BASKA — Başka Güzergah"')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('kendi kaydı çakışma sayılmaz (haricId dışlanır)', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-10'),
    })
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { bitisTarihi: '2026-02-01' }, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'v1' } }) }),
    )
    expect(mocks.aracVarsayilanUpdate).toHaveBeenCalled()
  })

  it('neden/açıklama güncellemesi çakışma kontrolü tetiklemez', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null,
    })
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { neden: 'düzeltme' }, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).not.toHaveBeenCalled()
  })

  it('yalnız değişen alanı (neden) ServisIslemGecmisi’ye yazar', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: 'Eski neden', aciklama: null,
    })
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { neden: 'Yeni neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', hedefId: 'v1', islem: 'GUNCELLEME', userId: 'user-1',
        oncekiDeger: { neden: 'Eski neden' }, yeniDeger: { neden: 'Yeni neden' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: 'Aynı neden', aciklama: null,
    })
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { neden: 'Aynı neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisGuzergahAracVarsayilan — pasifleştir/geri-al (madde 3: satır silinmez, bitisTarihi kalıcı)', () => {
  it('pasifleştirme bitisTarihi ister ve aktif=false yapar', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: true, baslangicTarihi: new Date('2026-01-01'),
    })
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1', aktif: false })
    await pasiflestirServisGuzergahAracVarsayilan('v1', '2026-01-15', 'user-1')
    expect(mocks.aracVarsayilanUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bitisTarihi: expect.any(Date), aktif: false, updatedById: 'user-1' }),
    }))
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({ id: 'v1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null })
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1', aktif: false })
    await pasiflestirServisGuzergahAracVarsayilan('v1', '2026-01-15', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', hedefId: 'v1', islem: 'PASIFLESTIRME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null, aktif: true },
        yeniDeger: { bitisTarihi: new Date('2026-01-15'), aktif: false },
      }),
    }))
  })

  it('bitisTarihi verilmeden pasifleştirilemez (otomatik/sessiz kapatma yok)', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: true, baslangicTarihi: new Date('2026-01-01'),
    })
    await expect(pasiflestirServisGuzergahAracVarsayilan('v1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('kapatma tarihi başlangıçtan önceyse reddeder', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: true, baslangicTarihi: new Date('2026-01-10'),
    })
    await expect(pasiflestirServisGuzergahAracVarsayilan('v1', '2026-01-01', 'user-1')).rejects.toThrow('önce olamaz')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('zaten pasif kaydı tekrar pasifleştirmez', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({ id: 'v1', aktif: false })
    await expect(pasiflestirServisGuzergahAracVarsayilan('v1', '2026-01-15', 'user-1')).rejects.toThrow('zaten pasif')
  })

  it('geri-al: çakışma yoksa aktif=true yapar, bitisTarihi korunur', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: false, aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1', aktif: true })
    await geriAlServisGuzergahAracVarsayilan('v1', 'user-1')
    expect(mocks.aracVarsayilanUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { aktif: true, updatedById: 'user-1' },
    }))
  })

  it('geri-al: aradan başka bir ANA atama oluşmuşsa (yeniden çakışma) reddeder', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: false, aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.aracVarsayilanFindFirst.mockResolvedValue({
      id: 'v-yeni', baslangicTarihi: new Date('2026-01-05'), bitisTarihi: null,
      guzergah: { kod: 'YENI', ad: 'Yeni Güzergah' },
    })
    await expect(geriAlServisGuzergahAracVarsayilan('v1', 'user-1')).rejects.toThrow('zaten "YENI — Yeni Güzergah"')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('zaten aktif kaydı tekrar geri almaz', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({ id: 'v1', aktif: true })
    await expect(geriAlServisGuzergahAracVarsayilan('v1', 'user-1')).rejects.toThrow('zaten aktif')
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue({
      id: 'v1', aktif: false, aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1', aktif: true })
    await geriAlServisGuzergahAracVarsayilan('v1', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', hedefId: 'v1', islem: 'AKTIFLESTIRME', userId: 'user-1',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliSoforVarsayilan = {
  guzergahId: 'guzergah-1',
  dilimId: 'dilim-1',
  soforId: 'sofor-1',
  rol: 'ANA' as const,
  baslangicTarihi: '2026-01-01',
}

describe('ServisGuzergahSoforVarsayilan — oluşturma ve çakışma (EXCLUDE simülasyonu)', () => {
  beforeEach(() => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.soforFindUnique.mockResolvedValue({ id: 'sofor-1', aktif: true })
    mocks.soforVarsayilanFindFirst.mockResolvedValue(null)
  })

  it('geçerli ANA atamayı oluşturur', async () => {
    mocks.soforVarsayilanCreate.mockResolvedValue({ id: 's1', ...gecerliSoforVarsayilan })
    await createServisGuzergahSoforVarsayilan(gecerliSoforVarsayilan, 'user-1')
    expect(mocks.soforVarsayilanCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ soforId: 'sofor-1', rol: 'ANA', createdById: 'user-1' }),
    }))
  })

  it('pasif şoförü varsayılan atamaz', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 'sofor-1', aktif: false })
    await expect(createServisGuzergahSoforVarsayilan(gecerliSoforVarsayilan, 'user-1')).rejects.toThrow('Pasif şoför')
    expect(mocks.soforVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('aynı şoför aynı dilimde çakışan tarihte başka güzergahın ANA şoförüyse reddeder', async () => {
    mocks.soforVarsayilanFindFirst.mockResolvedValue({
      id: 's-eski', baslangicTarihi: new Date('2025-12-15'), bitisTarihi: new Date('2026-01-20'),
      guzergah: { kod: 'BASKA', ad: 'Başka Güzergah' },
    })
    await expect(createServisGuzergahSoforVarsayilan(gecerliSoforVarsayilan, 'user-1'))
      .rejects.toThrow('zaten "BASKA — Başka Güzergah" güzergahının ANA şoförü')
    expect(mocks.soforVarsayilanCreate).not.toHaveBeenCalled()
  })

  it('YEDEK rol çakışma kontrolüne girmez', async () => {
    mocks.soforVarsayilanCreate.mockResolvedValue({ id: 's1' })
    await createServisGuzergahSoforVarsayilan({ ...gecerliSoforVarsayilan, rol: 'YEDEK' }, 'user-1')
    expect(mocks.soforVarsayilanFindFirst).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (GUZERGAH_SOFOR_VARSAYILAN/OLUSTURMA)', async () => {
    mocks.soforVarsayilanCreate.mockResolvedValue({ id: 's1' })
    await createServisGuzergahSoforVarsayilan(gecerliSoforVarsayilan, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', hedefId: 's1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: expect.objectContaining({ guzergahId: 'guzergah-1', dilimId: 'dilim-1', soforId: 'sofor-1', rol: 'ANA' }),
      }),
    }))
  })
})

describe('ServisGuzergahSoforVarsayilan — güncelleme (sınırlı)', () => {
  it('yalnız değişen alanı (aciklama) ServisIslemGecmisi’ye yazar', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({
      id: 's1', soforId: 'sofor-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: null, aciklama: 'Eski açıklama',
    })
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1' })
    await guncelleServisGuzergahSoforVarsayilan('s1', { aciklama: 'Yeni açıklama' }, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', hedefId: 's1', islem: 'GUNCELLEME', userId: 'user-1',
        oncekiDeger: { aciklama: 'Eski açıklama' }, yeniDeger: { aciklama: 'Yeni açıklama' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({
      id: 's1', soforId: 'sofor-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: null, aciklama: 'Aynı açıklama',
    })
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1' })
    await guncelleServisGuzergahSoforVarsayilan('s1', { aciklama: 'Aynı açıklama' }, 'user-1')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisGuzergahSoforVarsayilan — pasifleştir/geri-al', () => {
  it('pasifleştirme bitisTarihi ister', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({ id: 's1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisGuzergahSoforVarsayilan('s1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({ id: 's1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null })
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1', aktif: false })
    await pasiflestirServisGuzergahSoforVarsayilan('s1', '2026-01-15', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', hedefId: 's1', islem: 'PASIFLESTIRME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null, aktif: true },
        yeniDeger: { bitisTarihi: new Date('2026-01-15'), aktif: false },
      }),
    }))
  })

  it('geri-al aktif=true yapar', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({
      id: 's1', aktif: false, soforId: 'sofor-1', dilimId: 'dilim-1', rol: 'ANA',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.soforVarsayilanFindFirst.mockResolvedValue(null)
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1', aktif: true })
    await geriAlServisGuzergahSoforVarsayilan('s1', 'user-1')
    expect(mocks.soforVarsayilanUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { aktif: true, updatedById: 'user-1' },
    }))
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({
      id: 's1', aktif: false, soforId: 'sofor-1', dilimId: 'dilim-1', rol: 'ANA',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.soforVarsayilanFindFirst.mockResolvedValue(null)
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1', aktif: true })
    await geriAlServisGuzergahSoforVarsayilan('s1', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', hedefId: 's1', islem: 'AKTIFLESTIRME', userId: 'user-1',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })
})

const gecerliSorumlu = {
  personnelId: 'personel-1',
  guzergahId: 'guzergah-1',
  rol: 'ANA' as const,
  baslangicTarihi: '2026-01-01',
}

describe('ServisSorumlusu — view', () => {
  it('güzergaha ait sorumluları aktif-en-üstte, tarihe göre listeler', async () => {
    mocks.sorumluFindMany.mockResolvedValue([{ id: 'sr1' }])
    const data = await listServisSorumlulari('guzergah-1')
    expect(mocks.sorumluFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'guzergah-1' },
      include: expect.any(Object),
      orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
    })
    expect(data).toHaveLength(1)
  })
})

describe('ServisSorumlusu — oluşturma (ÇAKIŞMA KONTROLÜ YOK — DB\'de EXCLUDE tanımlı değil, bilinçli karar)', () => {
  beforeEach(() => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
  })

  it('geçerli atamayı oluşturur', async () => {
    mocks.sorumluCreate.mockResolvedValue({ id: 'sr1', ...gecerliSorumlu })
    await createServisSorumlusu(gecerliSorumlu, 'user-1')
    expect(mocks.sorumluCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        personnelId: 'personel-1', guzergahId: 'guzergah-1', rol: 'ANA', createdById: 'user-1',
      }),
    }))
  })

  it('aynı personel için ikinci bir ANA ataması hiçbir çakışma kontrolüne takılmadan oluşturulabilir', async () => {
    // Bilinçli: EXCLUDE yok, bir personel aynı anda birden fazla güzergahın
    // sorumlusu olabilir. Bu test, gelecekte yanlışlıkla bir çakışma
    // kontrolü eklenirse (ör. Araç/Şoför Varsayılan'dan kopyalanarak) bunun
    // farkına varılmasını sağlar.
    mocks.sorumluCreate.mockResolvedValue({ id: 'sr2' })
    await createServisSorumlusu({ ...gecerliSorumlu, guzergahId: 'guzergah-2' }, 'user-1')
    expect(mocks.sorumluFindMany).not.toHaveBeenCalled()
    expect(mocks.sorumluCreate).toHaveBeenCalled()
  })

  it('pasif personeli sorumlu atamaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: false })
    await expect(createServisSorumlusu(gecerliSorumlu, 'user-1')).rejects.toThrow('Pasif personel')
    expect(mocks.sorumluCreate).not.toHaveBeenCalled()
  })

  it('pasif güzergaha sorumlu atamaz', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: false })
    await expect(createServisSorumlusu(gecerliSorumlu, 'user-1')).rejects.toThrow('Pasif güzergaha')
    expect(mocks.sorumluCreate).not.toHaveBeenCalled()
  })

  it('geçersiz rol veya bitiş başlangıçtan önceyse DB çağrısı yapmaz (CHECK karşılığı)', async () => {
    await expect(createServisSorumlusu({ ...gecerliSorumlu, rol: 'BASKA' as never }, 'user-1'))
      .rejects.toThrow('Rol ANA veya YEDEK')
    await expect(createServisSorumlusu({ ...gecerliSorumlu, bitisTarihi: '2025-12-01' }, 'user-1'))
      .rejects.toThrow('Bitiş tarihi başlangıç tarihinden önce olamaz')
    expect(mocks.sorumluCreate).not.toHaveBeenCalled()
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (SORUMLUSU/OLUSTURMA), yalnız personnelId FK — personel adı YOK', async () => {
    mocks.sorumluCreate.mockResolvedValue({ id: 'sr1' })
    await createServisSorumlusu(gecerliSorumlu, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SORUMLUSU', hedefId: 'sr1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: expect.objectContaining({ personnelId: 'personel-1', guzergahId: 'guzergah-1', rol: 'ANA' }),
      }),
    }))
    const yeniDeger = mocks.islemGecmisiCreate.mock.calls[0][0].data.yeniDeger as Record<string, unknown>
    expect(yeniDeger).not.toHaveProperty('adSoyad')
  })
})

describe('ServisSorumlusu — güncelleme (sınırlı)', () => {
  it('bitisTarihi başlangıçtan önceyse reddeder', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', baslangicTarihi: new Date('2026-01-10') })
    await expect(guncelleServisSorumlusu('sr1', { bitisTarihi: '2026-01-01' }, 'user-1')).rejects.toThrow('önce olamaz')
    expect(mocks.sorumluUpdate).not.toHaveBeenCalled()
  })

  it('neden/açıklama günceller', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', baslangicTarihi: new Date('2026-01-01') })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu('sr1', { neden: 'düzeltme' }, 'user-1')
    expect(mocks.sorumluUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { updatedById: 'user-1', neden: 'düzeltme' },
    }))
  })

  it('yalnız değişen alanı (neden) ServisIslemGecmisi’ye yazar', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', baslangicTarihi: new Date('2026-01-01'), neden: 'Eski neden', aciklama: null })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu('sr1', { neden: 'Yeni neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SORUMLUSU', hedefId: 'sr1', islem: 'GUNCELLEME', userId: 'user-1',
        oncekiDeger: { neden: 'Eski neden' }, yeniDeger: { neden: 'Yeni neden' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', baslangicTarihi: new Date('2026-01-01'), neden: 'Aynı neden', aciklama: null })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu('sr1', { neden: 'Aynı neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisSorumlusu — pasifleştir/geri-al (madde 14: satır silinmez, bitisTarihi kalıcı)', () => {
  it('pasifleştirme bitisTarihi ister ve aktif=false yapar', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1', aktif: false })
    await pasiflestirServisSorumlusu('sr1', '2026-01-15', 'user-1')
    expect(mocks.sorumluUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bitisTarihi: expect.any(Date), aktif: false, updatedById: 'user-1' }),
    }))
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1', aktif: false })
    await pasiflestirServisSorumlusu('sr1', '2026-01-15', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SORUMLUSU', hedefId: 'sr1', islem: 'PASIFLESTIRME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null, aktif: true },
        yeniDeger: { bitisTarihi: new Date('2026-01-15'), aktif: false },
      }),
    }))
  })

  it('bitisTarihi verilmeden pasifleştirilemez', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisSorumlusu('sr1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
    expect(mocks.sorumluUpdate).not.toHaveBeenCalled()
  })

  it('kapatma tarihi başlangıçtan önceyse reddeder', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true, baslangicTarihi: new Date('2026-01-10') })
    await expect(pasiflestirServisSorumlusu('sr1', '2026-01-01', 'user-1')).rejects.toThrow('önce olamaz')
    expect(mocks.sorumluUpdate).not.toHaveBeenCalled()
  })

  it('zaten pasif kaydı tekrar pasifleştirmez', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: false })
    await expect(pasiflestirServisSorumlusu('sr1', '2026-01-15', 'user-1')).rejects.toThrow('zaten pasif')
  })

  it('geri-al aktif=true yapar, bitisTarihi korunur, çakışma kontrolü yapılmaz', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: false, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15') })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1', aktif: true })
    await geriAlServisSorumlusu('sr1', 'user-1')
    expect(mocks.sorumluUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { aktif: true, updatedById: 'user-1' },
    }))
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: false, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15') })
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1', aktif: true })
    await geriAlServisSorumlusu('sr1', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'SORUMLUSU', hedefId: 'sr1', islem: 'AKTIFLESTIRME', userId: 'user-1',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })

  it('zaten aktif kaydı tekrar geri almaz', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true })
    await expect(geriAlServisSorumlusu('sr1', 'user-1')).rejects.toThrow('zaten aktif')
  })
})

const gecerliPersonelDurum = {
  personnelId: 'personel-1',
  durum: 'SERVIS_KULLANIYOR' as const,
  baslangicTarihi: '2026-01-01',
}

describe('ServisPersonelDurum — view', () => {
  it('personnelId ve aktif filtresiyle listeler', async () => {
    mocks.personelDurumFindMany.mockResolvedValue([{ id: 'pd1' }])
    const data = await listServisPersonelDurumlari({ personnelId: 'personel-1', aktif: true })
    expect(mocks.personelDurumFindMany).toHaveBeenCalledWith({
      where: { personnelId: 'personel-1', aktif: true },
      include: expect.any(Object),
      orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
    })
    expect(data).toHaveLength(1)
  })

  it('filtresiz tüm kayıtları listeler', async () => {
    mocks.personelDurumFindMany.mockResolvedValue([])
    await listServisPersonelDurumlari()
    expect(mocks.personelDurumFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('ServisPersonelDurum — oluşturma ve çakışma (EXCLUDE simülasyonu, personnelId bazlı)', () => {
  beforeEach(() => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.personelDurumFindFirst.mockResolvedValue(null)
  })

  it('geçerli kaydı oluşturur', async () => {
    mocks.personelDurumCreate.mockResolvedValue({ id: 'pd1', ...gecerliPersonelDurum })
    await createServisPersonelDurum(gecerliPersonelDurum, 'user-1')
    expect(mocks.personelDurumCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ personnelId: 'personel-1', durum: 'SERVIS_KULLANIYOR', createdById: 'user-1' }),
    }))
  })

  it('pasif personel için kayıt oluşturmaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: false })
    await expect(createServisPersonelDurum(gecerliPersonelDurum, 'user-1')).rejects.toThrow('Pasif personel')
    expect(mocks.personelDurumCreate).not.toHaveBeenCalled()
  })

  it('aynı personelin çakışan tarihte zaten aktif bir durumu varsa reddeder — DURUM DEĞERİ FARKLI OLSA BİLE', async () => {
    mocks.personelDurumFindFirst.mockResolvedValue({
      id: 'pd-eski', baslangicTarihi: new Date('2025-12-01'), bitisTarihi: null, durum: 'KENDI_GELIYOR',
    })
    await expect(createServisPersonelDurum(gecerliPersonelDurum, 'user-1'))
      .rejects.toThrow('zaten aktif bir "Kendi Geliyor" kaydı var')
    expect(mocks.personelDurumCreate).not.toHaveBeenCalled()
  })

  it('geçersiz durum veya tarihle DB çağrısı yapmaz', async () => {
    await expect(createServisPersonelDurum({ ...gecerliPersonelDurum, durum: 'BASKA' as never }, 'user-1'))
      .rejects.toThrow('Durum SERVIS_KULLANIYOR')
    await expect(createServisPersonelDurum({ ...gecerliPersonelDurum, baslangicTarihi: '' }, 'user-1'))
      .rejects.toThrow('Başlangıç tarihi')
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  // SIRKET_ARACI: 20260830112851_servis_sirket_araci_enum migration'ıyla
  // eklenen 4. deger — validation whitelist'i de guncellenmedigi surece
  // dropdown'dan secilse bile reddedilirdi (bkz. Ders: yalniz etiket
  // eklemek yetmez, form dogrulamasi da enum'u yansitmali).
  it('SIRKET_ARACI değeriyle kayıt oluşturur (geçerli 4. durum)', async () => {
    mocks.personelDurumCreate.mockResolvedValue({ id: 'pd1', ...gecerliPersonelDurum, durum: 'SIRKET_ARACI' })
    await createServisPersonelDurum({ ...gecerliPersonelDurum, durum: 'SIRKET_ARACI' }, 'user-1')
    expect(mocks.personelDurumCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durum: 'SIRKET_ARACI' }),
    }))
  })

  it('çakışma mesajında SIRKET_ARACI "Şirket Aracı Kullanıyor" olarak gösterilir', async () => {
    mocks.personelDurumFindFirst.mockResolvedValue({
      id: 'pd-eski', baslangicTarihi: new Date('2025-12-01'), bitisTarihi: null, durum: 'SIRKET_ARACI',
    })
    await expect(createServisPersonelDurum(gecerliPersonelDurum, 'user-1'))
      .rejects.toThrow('zaten aktif bir "Şirket Aracı Kullanıyor" kaydı var')
  })

  // Regresyon (Ders 59): süresiz (bitisTarihi=null) mevcut bir durumu SQL'de
  // NULL karşılaştırması yüzünden kaçırıp çiğ EXCLUDE hatası sızdıran
  // NOT+lt/gt formuna karşı — WHERE'in NULL-güvenli AND-of-OR biçiminde
  // kaldığını sabitler.
  it('süresiz mevcut kayıtla çakışma sorgusu NULL-güvenli (AND-of-OR) kurulur', async () => {
    await createServisPersonelDurum(gecerliPersonelDurum, 'user-1')
    expect(mocks.personelDurumFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [
          { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: expect.any(Date) } }] },
        ],
      }),
    }))
  })

  it('oluşturma ServisIslemGecmisi kaydı yazar (PERSONEL_DURUM/OLUSTURMA), yalnız personnelId FK — personel adı YOK', async () => {
    mocks.personelDurumCreate.mockResolvedValue({ id: 'pd1' })
    await createServisPersonelDurum(gecerliPersonelDurum, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_DURUM', hedefId: 'pd1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: expect.objectContaining({ personnelId: 'personel-1', durum: 'SERVIS_KULLANIYOR' }),
      }),
    }))
    const yeniDeger = mocks.islemGecmisiCreate.mock.calls[0][0].data.yeniDeger as Record<string, unknown>
    expect(yeniDeger).not.toHaveProperty('adSoyad')
    expect(yeniDeger).not.toHaveProperty('sicilNo')
  })
})

describe('ServisPersonelDurum — güncelleme (sınırlı)', () => {
  it('bitisTarihi uzatılırken yeni bir çakışma varsa reddeder', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-10'),
    })
    mocks.personelDurumFindFirst.mockResolvedValue({
      id: 'pd-baska', baslangicTarihi: new Date('2026-01-15'), bitisTarihi: null, durum: 'KULLANMIYOR',
    })
    await expect(guncelleServisPersonelDurum('pd1', { bitisTarihi: '2026-02-01' }, 'user-1'))
      .rejects.toThrow('zaten aktif bir "Kullanmıyor" kaydı var')
    expect(mocks.personelDurumUpdate).not.toHaveBeenCalled()
  })

  it('neden güncellemesi çakışma kontrolü tetiklemez', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', personnelId: 'personel-1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null,
    })
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1' })
    await guncelleServisPersonelDurum('pd1', { neden: 'düzeltme' }, 'user-1')
    expect(mocks.personelDurumFindFirst).not.toHaveBeenCalled()
  })

  it('yalnız değişen alanı (neden) ServisIslemGecmisi’ye yazar', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', personnelId: 'personel-1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: 'Eski neden',
    })
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1' })
    await guncelleServisPersonelDurum('pd1', { neden: 'Yeni neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_DURUM', hedefId: 'pd1', islem: 'GUNCELLEME', userId: 'user-1',
        oncekiDeger: { neden: 'Eski neden' }, yeniDeger: { neden: 'Yeni neden' },
      }),
    }))
  })

  it('hiçbir alan değişmezse ServisIslemGecmisi kaydı YAZILMAZ', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', personnelId: 'personel-1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: 'Aynı neden',
    })
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1' })
    await guncelleServisPersonelDurum('pd1', { neden: 'Aynı neden' }, 'user-1')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisPersonelDurum — pasifleştir/geri-al (madde 14/15: satır silinmez)', () => {
  it('pasifleştirme bitisTarihi ister ve aktif=false yapar', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({ id: 'pd1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1', aktif: false })
    await pasiflestirServisPersonelDurum('pd1', '2026-01-15', 'user-1')
    expect(mocks.personelDurumUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bitisTarihi: expect.any(Date), aktif: false, updatedById: 'user-1' }),
    }))
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({ id: 'pd1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null })
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1', aktif: false })
    await pasiflestirServisPersonelDurum('pd1', '2026-01-15', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_DURUM', hedefId: 'pd1', islem: 'PASIFLESTIRME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null, aktif: true },
        yeniDeger: { bitisTarihi: new Date('2026-01-15'), aktif: false },
      }),
    }))
  })

  it('bitisTarihi verilmeden pasifleştirilemez', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({ id: 'pd1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisPersonelDurum('pd1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
    expect(mocks.personelDurumUpdate).not.toHaveBeenCalled()
  })

  it('geri-al: çakışma yoksa aktif=true yapar', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelDurumFindFirst.mockResolvedValue(null)
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1', aktif: true })
    await geriAlServisPersonelDurum('pd1', 'user-1')
    expect(mocks.personelDurumUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { aktif: true, updatedById: 'user-1' },
    }))
  })

  it('geri alma ServisIslemGecmisi kaydı yazar', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelDurumFindFirst.mockResolvedValue(null)
    mocks.personelDurumUpdate.mockResolvedValue({ id: 'pd1', aktif: true })
    await geriAlServisPersonelDurum('pd1', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_DURUM', hedefId: 'pd1', islem: 'AKTIFLESTIRME', userId: 'user-1',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })

  it('geri-al: aradan başka bir aktif kayıt oluşmuşsa (yeniden çakışma) reddeder', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({
      id: 'pd1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelDurumFindFirst.mockResolvedValue({
      id: 'pd-yeni', baslangicTarihi: new Date('2026-01-05'), bitisTarihi: null, durum: 'SERVIS_KULLANIYOR',
    })
    await expect(geriAlServisPersonelDurum('pd1', 'user-1')).rejects.toThrow('zaten aktif bir "Servis Kullanıyor" kaydı var')
    expect(mocks.personelDurumUpdate).not.toHaveBeenCalled()
  })

  it('zaten aktif kaydı tekrar geri almaz', async () => {
    mocks.personelDurumFindUnique.mockResolvedValue({ id: 'pd1', aktif: true })
    await expect(geriAlServisPersonelDurum('pd1', 'user-1')).rejects.toThrow('zaten aktif')
  })
})

const gecerliPersonelAtama = {
  personnelId: 'personel-1',
  guzergahId: 'guzergah-1',
  baslangicTarihi: '2026-01-01',
  dilimIdleri: ['dilim-1'],
}

describe('ServisPersonelAtama — view', () => {
  it('guzergahId ve aktif filtresiyle listeler', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([{ id: 'pa1' }])
    const data = await listServisPersonelAtamalari('guzergah-1', { aktif: true })
    expect(mocks.personelAtamaFindMany).toHaveBeenCalledWith({
      where: { guzergahId: 'guzergah-1', aktif: true },
      include: expect.any(Object),
      orderBy: [{ aktif: 'desc' }, { baslangicTarihi: 'desc' }],
    })
    expect(data).toHaveLength(1)
  })

  it('aktif filtresi verilmezse tüm kayıtları listeler', async () => {
    mocks.personelAtamaFindMany.mockResolvedValue([])
    await listServisPersonelAtamalari('guzergah-1')
    expect(mocks.personelAtamaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { guzergahId: 'guzergah-1' } })
    )
  })
})

describe('ServisPersonelAtama — oluşturma ve çakışma (EXCLUDE simülasyonu, personnelId bazlı)', () => {
  beforeEach(() => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: true })
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'dilim-1', kod: 'S1', aktif: true }])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaCreate.mockResolvedValue({ id: 'pa1' })
    mocks.personelAtamaDilimCreateMany.mockResolvedValue({ count: 1 })
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', ...gecerliPersonelAtama })
  })

  it('geçerli formu atama+dilim olarak atomik oluşturur', async () => {
    const data = await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        personnelId: 'personel-1',
        guzergahId: 'guzergah-1',
        durakId: null,
        atamaKaynagi: 'MANUEL',
        createdById: 'user-1',
      }),
    }))
    expect(mocks.personelAtamaDilimCreateMany).toHaveBeenCalledWith({
      data: [{ atamaId: 'pa1', dilimId: 'dilim-1' }],
    })
    expect(data.id).toBe('pa1')
  })

  it('oluşturma İKİ ServisIslemGecmisi kaydı yazar — PERSONEL_ATAMA ve PERSONEL_ATAMA_DILIM, ikisi de aynı hedefId (atama.id)', async () => {
    await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_ATAMA', hedefId: 'pa1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: expect.objectContaining({ personnelId: 'personel-1', guzergahId: 'guzergah-1' }),
      }),
    }))
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_ATAMA_DILIM', hedefId: 'pa1', islem: 'OLUSTURMA', userId: 'user-1',
        yeniDeger: { dilimIdleri: ['dilim-1'] },
      }),
    }))
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledTimes(2)
  })

  it('KVKK/madde 23: ServisIslemGecmisi yeniDeger içinde personel adı/sicil no gibi JOIN alanı YOK, yalnız personnelId (FK)', async () => {
    await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    const cagri = mocks.islemGecmisiCreate.mock.calls.find(
      (c: [{ data: { hedefTipi: string } }]) => c[0].data.hedefTipi === 'PERSONEL_ATAMA',
    )
    const yeniDeger = cagri?.[0].data.yeniDeger as Record<string, unknown>
    expect(yeniDeger).not.toHaveProperty('adSoyad')
    expect(yeniDeger).not.toHaveProperty('sicilNo')
    expect(yeniDeger.personnelId).toBe('personel-1')
  })

  it('pasif personel için atama oluşturmaz', async () => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: false })
    await expect(createServisPersonelAtama(gecerliPersonelAtama, 'user-1')).rejects.toThrow('Pasif personel')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('pasif güzergaha atama oluşturmaz', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', aktif: false })
    await expect(createServisPersonelAtama(gecerliPersonelAtama, 'user-1')).rejects.toThrow('Pasif güzergaha')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('durakId, seçilen güzergahın durağı değilse anlaşılır hata verir (çiğ FK hatası değil)', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    await expect(createServisPersonelAtama({ ...gecerliPersonelAtama, durakId: 'durak-99' }, 'user-1'))
      .rejects.toThrow('Bu durak, seçilen güzergahın bir durağı değil.')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('durakId, güzergahın durağıysa (bileşik FK’in Prisma karşılığı) kabul eder', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', guzergahId: 'guzergah-1', durakId: 'durak-1' })
    await createServisPersonelAtama({ ...gecerliPersonelAtama, durakId: 'durak-1' }, 'user-1')
    expect(mocks.guzergahDurakFindUnique).toHaveBeenCalledWith({
      where: { guzergahId_durakId: { guzergahId: 'guzergah-1', durakId: 'durak-1' } },
    })
    expect(mocks.personelAtamaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durakId: 'durak-1' }),
    }))
  })

  it('bulunamayan sefer dilimi ile hata verir', async () => {
    mocks.seferDilimiFindMany.mockResolvedValue([])
    await expect(createServisPersonelAtama(gecerliPersonelAtama, 'user-1')).rejects.toThrow('bulunamadı')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('pasif sefer dilimi ile hata verir', async () => {
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'dilim-1', kod: 'S1', aktif: false }])
    await expect(createServisPersonelAtama(gecerliPersonelAtama, 'user-1')).rejects.toThrow('S1" dilimi pasif')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('aynı personelin çakışan tarihte zaten aktif bir ataması varsa reddeder — GÜZERGAH FARKLI OLSA BİLE', async () => {
    mocks.personelAtamaFindFirst.mockResolvedValue({
      id: 'pa-eski', baslangicTarihi: new Date('2025-12-01'), bitisTarihi: null,
      guzergah: { kod: 'G1', ad: 'Eski Güzergah' },
    })
    await expect(createServisPersonelAtama(gecerliPersonelAtama, 'user-1'))
      .rejects.toThrow('zaten "G1 — Eski Güzergah" güzergahına aktif bir ataması var')
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
  })

  it('geçersiz formla (dilim seçilmeden) DB çağrısı yapmaz', async () => {
    await expect(createServisPersonelAtama({ ...gecerliPersonelAtama, dilimIdleri: [] }, 'user-1'))
      .rejects.toThrow('sefer dilimi seçilmelidir')
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  // Regresyon (Ders 59): süresiz (bitisTarihi=null) mevcut bir atamayı SQL'de
  // NULL karşılaştırması yüzünden kaçırıp çiğ EXCLUDE hatası sızdıran
  // NOT+lt/gt formuna karşı — WHERE'in NULL-güvenli AND-of-OR biçiminde
  // kaldığını sabitler.
  it('süresiz mevcut kayıtla çakışma sorgusu NULL-güvenli (AND-of-OR) kurulur', async () => {
    await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    expect(mocks.personelAtamaFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [
          { OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: expect.any(Date) } }] },
        ],
      }),
    }))
  })
})

describe('ServisPersonelAtama — güncelleme (sınırlı, yalnız bitisTarihi)', () => {
  it('bitisTarihi verilirken yeni bir çakışma varsa reddeder', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null,
    })
    mocks.personelAtamaFindFirst.mockResolvedValue({
      id: 'pa-baska', baslangicTarihi: new Date('2026-02-15'), bitisTarihi: null,
      guzergah: { kod: 'G2', ad: 'Başka Güzergah' },
    })
    await expect(guncelleServisPersonelAtama('pa1', { bitisTarihi: '2026-03-01' }, 'user-1'))
      .rejects.toThrow('zaten "G2 — Başka Güzergah" güzergahına aktif bir ataması var')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('bitisTarihi, baslangicTarihi öncesi olamaz', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-10'), bitisTarihi: null,
    })
    await expect(guncelleServisPersonelAtama('pa1', { bitisTarihi: '2026-01-01' }, 'user-1'))
      .rejects.toThrow('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('değişmeyen bitisTarihi çakışma kontrolünü tetiklemez', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-02-01'),
    })
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1' })
    await guncelleServisPersonelAtama('pa1', { bitisTarihi: '2026-02-01' }, 'user-1')
    expect(mocks.personelAtamaFindFirst).not.toHaveBeenCalled()
  })

  it('olmayan atama için hata verir', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(null)
    await expect(guncelleServisPersonelAtama('yok', { bitisTarihi: '2026-01-01' }, 'user-1'))
      .rejects.toThrow('bulunamadı')
  })

  it('bitisTarihi fiilen değiştiğinde ServisIslemGecmisi (PERSONEL_ATAMA/GUNCELLEME) yazar', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null,
    })
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1' })
    await guncelleServisPersonelAtama('pa1', { bitisTarihi: '2026-03-01' }, 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_ATAMA', hedefId: 'pa1', islem: 'GUNCELLEME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null },
        yeniDeger: { bitisTarihi: new Date('2026-03-01') },
      }),
    }))
  })

  it('değişmeyen bitisTarihi ServisIslemGecmisi kaydı YAZMAZ', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', personnelId: 'personel-1', aktif: true,
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-02-01'),
    })
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1' })
    await guncelleServisPersonelAtama('pa1', { bitisTarihi: '2026-02-01' }, 'user-1')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

describe('ServisPersonelAtama — pasifleştir/geri-al (zaman bağımlı, satır silinmez)', () => {
  it('pasifleştirme bitisTarihi ister ve aktif=false yapar', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1', aktif: false })
    await pasiflestirServisPersonelAtama('pa1', '2026-01-15', 'user-1')
    expect(mocks.personelAtamaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bitisTarihi: expect.any(Date), aktif: false, updatedById: 'user-1' }),
    }))
  })

  it('pasifleştirme ServisIslemGecmisi kaydı yazar (PERSONEL_ATAMA/PASIFLESTIRME)', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null })
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1', aktif: false })
    await pasiflestirServisPersonelAtama('pa1', '2026-01-15', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_ATAMA', hedefId: 'pa1', islem: 'PASIFLESTIRME', userId: 'user-1',
        oncekiDeger: { bitisTarihi: null, aktif: true },
        yeniDeger: { bitisTarihi: new Date('2026-01-15'), aktif: false },
      }),
    }))
  })

  it('bitisTarihi verilmeden pasifleştirilemez', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisPersonelAtama('pa1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('zaten pasif atamayı tekrar pasifleştirmez', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', aktif: false, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisPersonelAtama('pa1', '2026-01-15', 'user-1')).rejects.toThrow('zaten pasif')
  })

  it('geri-al: çakışma yoksa aktif=true yapar', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1', aktif: true })
    await geriAlServisPersonelAtama('pa1', 'user-1')
    expect(mocks.personelAtamaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { aktif: true, updatedById: 'user-1' },
    }))
  })

  it('geri-al ServisIslemGecmisi kaydı yazar (PERSONEL_ATAMA/AKTIFLESTIRME)', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1', aktif: true })
    await geriAlServisPersonelAtama('pa1', 'user-1')
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        hedefTipi: 'PERSONEL_ATAMA', hedefId: 'pa1', islem: 'AKTIFLESTIRME', userId: 'user-1',
        oncekiDeger: { aktif: false }, yeniDeger: { aktif: true },
      }),
    }))
  })

  it('geri-al: aradan başka bir aktif kayıt oluşmuşsa (yeniden çakışma) reddeder', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({
      id: 'pa1', aktif: false, personnelId: 'personel-1',
      baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-01-15'),
    })
    mocks.personelAtamaFindFirst.mockResolvedValue({
      id: 'pa-yeni', baslangicTarihi: new Date('2026-01-05'), bitisTarihi: null,
      guzergah: { kod: 'G3', ad: 'Yeni Güzergah' },
    })
    await expect(geriAlServisPersonelAtama('pa1', 'user-1'))
      .rejects.toThrow('zaten "G3 — Yeni Güzergah" güzergahına aktif bir ataması var')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('zaten aktif atamayı tekrar geri almaz', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', aktif: true })
    await expect(geriAlServisPersonelAtama('pa1', 'user-1')).rejects.toThrow('zaten aktif')
  })
})

describe('ServisPersonelAtama — transferServisPersonelAtama (FAZ 1B: Alternatif Servis)', () => {
  const eskiAtama = {
    id: 'pa1', aktif: true, personnelId: 'personel-1', guzergahId: 'guzergah-1',
    baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null,
  }
  const gecerliTransferForm = { guzergahId: 'guzergah-2', durakId: null, dilimIdleri: ['dilim-1'], transferTarihi: '2026-03-01' }

  beforeEach(() => {
    mocks.personelAtamaFindUnique.mockReset()
    mocks.personelAtamaFindUnique.mockResolvedValueOnce(eskiAtama) // eskiAtama lookup
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-2', aktif: true })
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'dilim-1', kod: 'S1', aktif: true }])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1', aktif: false })
    mocks.personelAtamaCreate.mockResolvedValue({ id: 'pa2' })
    mocks.personelAtamaDilimCreateMany.mockResolvedValue({ count: 1 })
    mocks.personelAtamaFindUnique.mockResolvedValueOnce({ id: 'pa2', ...gecerliTransferForm }) // sonuc lookup
  })

  it('eski atamayı kapatır + yeni atamayı TEK transaction içinde açar', async () => {
    const data = await transferServisPersonelAtama('pa1', gecerliTransferForm, 'user-9')

    expect(mocks.personelAtamaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pa1' },
      data: { bitisTarihi: new Date('2026-03-01'), aktif: false, updatedById: 'user-9' },
    }))
    expect(mocks.personelAtamaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        personnelId: 'personel-1', guzergahId: 'guzergah-2', durakId: null,
        baslangicTarihi: new Date('2026-03-01'), bitisTarihi: null,
        atamaKaynagi: 'MANUEL', createdById: 'user-9',
      }),
    }))
    expect(mocks.personelAtamaDilimCreateMany).toHaveBeenCalledWith({ data: [{ atamaId: 'pa2', dilimId: 'dilim-1' }] })
    expect(data.id).toBe('pa2')
  })

  it('eski atamanın personelId\'sini kullanır — formda personnelId YOK', () => {
    expect(gecerliTransferForm).not.toHaveProperty('personnelId')
  })

  it('audit kaydında (PASIFLESTIRME ve OLUSTURMA, ikisinde de) "Alternatif Servis Önerisi ile transfer" açıklaması yazılır', async () => {
    await transferServisPersonelAtama('pa1', gecerliTransferForm, 'user-9')

    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefId: 'pa1', islem: 'PASIFLESTIRME', aciklama: 'Alternatif Servis Önerisi ile transfer' }),
    }))
    expect(mocks.islemGecmisiCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hedefId: 'pa2', islem: 'OLUSTURMA', hedefTipi: 'PERSONEL_ATAMA', aciklama: 'Alternatif Servis Önerisi ile transfer' }),
    }))
  })

  it('pasif bir atama transfer edilemez', async () => {
    mocks.personelAtamaFindUnique.mockReset()
    mocks.personelAtamaFindUnique.mockResolvedValueOnce({ ...eskiAtama, aktif: false })
    await expect(transferServisPersonelAtama('pa1', gecerliTransferForm, 'user-9')).rejects.toThrow('zaten pasif')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('eski atama bulunamazsa hata verir', async () => {
    mocks.personelAtamaFindUnique.mockReset()
    mocks.personelAtamaFindUnique.mockResolvedValueOnce(null)
    await expect(transferServisPersonelAtama('yok', gecerliTransferForm, 'user-9')).rejects.toThrow('bulunamadı')
  })

  it('transfer tarihi eski atamanın başlangıcından önce olamaz', async () => {
    await expect(
      transferServisPersonelAtama('pa1', { ...gecerliTransferForm, transferTarihi: '2025-12-01' }, 'user-9'),
    ).rejects.toThrow('başlangıç tarihinden önce olamaz')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('pasif güzergaha transfer edilemez', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-2', aktif: false })
    await expect(transferServisPersonelAtama('pa1', gecerliTransferForm, 'user-9')).rejects.toThrow('Pasif güzergaha')
  })

  it('personelin başka bir aktif ataması varsa (çakışma) transfer reddedilir', async () => {
    mocks.personelAtamaFindFirst.mockResolvedValue({
      id: 'pa-baska', baslangicTarihi: new Date('2026-02-01'), bitisTarihi: null,
      guzergah: { kod: 'G9', ad: 'Başka Güzergah' },
    })
    await expect(transferServisPersonelAtama('pa1', gecerliTransferForm, 'user-9'))
      .rejects.toThrow('zaten "G9 — Başka Güzergah" güzergahına aktif bir ataması var')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('geçersiz form (güzergah/dilim eksik) ile hata verir, hiçbir sorgu atmaz', async () => {
    await expect(transferServisPersonelAtama('pa1', { ...gecerliTransferForm, guzergahId: '', dilimIdleri: [] }, 'user-9'))
      .rejects.toThrow('Güzergâh seçimi zorunludur.')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })
})

// ============================================================================
// A3 — başlangıç/bitiş düzenleme + kapatma tarihi sınırı
// ============================================================================
describe('A3 — varsayılan araç/şoför ataması: başlangıç + bitiş düzenleme', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    // Önceki testlerden kalan mockResolvedValueOnce kuyruğu bu testleri bozmasın.
    for (const m of [
      mocks.aracVarsayilanFindUnique, mocks.aracVarsayilanFindFirst, mocks.aracVarsayilanUpdate,
      mocks.soforVarsayilanFindUnique, mocks.soforVarsayilanFindFirst, mocks.soforVarsayilanUpdate,
      mocks.sorumluFindUnique, mocks.sorumluUpdate,
      mocks.personelAtamaFindUnique, mocks.personelAtamaFindFirst, mocks.personelAtamaUpdate,
      mocks.islemGecmisiCreate,
    ]) m.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  const arac = (ek: Record<string, unknown> = {}) => ({
    id: 'v1', aracId: 'arac-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
    baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-06-30'), neden: null, aciklama: null, ...ek,
  })
  const sofor = (ek: Record<string, unknown> = {}) => ({
    id: 's1', soforId: 'sofor-1', dilimId: 'dilim-1', rol: 'ANA', aktif: true,
    baslangicTarihi: new Date('2026-01-01'), bitisTarihi: new Date('2026-06-30'), neden: null, aciklama: null, ...ek,
  })

  it('araç: başlangıç tarihi düzeltilir, çakışma YENİ aralıkla kontrol edilir, audit eski → yeni yazar', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })

    await guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2026-02-01' }, 'user-1')

    const where = mocks.aracVarsayilanFindFirst.mock.calls[0][0].where
    expect(where.AND[1]).toEqual({ baslangicTarihi: { lte: new Date('2026-06-30T00:00:00.000Z') } })
    expect(mocks.aracVarsayilanUpdate.mock.calls[0][0].data.baslangicTarihi).toEqual(new Date('2026-02-01T00:00:00.000Z'))
    const audit = mocks.islemGecmisiCreate.mock.calls[0][0].data
    expect(audit).toMatchObject({ hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', islem: 'GUNCELLEME', userId: 'user-1' })
    expect(JSON.stringify(audit.oncekiDeger)).toContain('2026-01-01')
    expect(JSON.stringify(audit.yeniDeger)).toContain('2026-02-01')
    expect(Object.keys(audit.yeniDeger)).toEqual(['baslangicTarihi']) // yalnız değişen alan
  })

  it('araç: başlangıç ve bitiş birlikte düzeltilebilir', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2026-03-01', bitisTarihi: '2026-12-31' }, 'user-1')
    const data = mocks.aracVarsayilanUpdate.mock.calls[0][0].data
    expect(data.baslangicTarihi).toEqual(new Date('2026-03-01T00:00:00.000Z'))
    expect(data.bitisTarihi).toEqual(new Date('2026-12-31T00:00:00.000Z'))
  })

  it('araç: bitiş boşaltılırsa süresiz (null) olur', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    mocks.aracVarsayilanFindFirst.mockResolvedValue(null)
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { bitisTarihi: '' }, 'user-1')
    expect(mocks.aracVarsayilanUpdate.mock.calls[0][0].data.bitisTarihi).toBeNull()
  })

  it('araç: bitiş < başlangıç reddedilir (yeni başlangıç mevcut bitişten sonraysa da)', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    await expect(
      guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2026-08-01' }, 'user-1'),
    ).rejects.toThrow('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    await expect(
      guncelleServisGuzergahAracVarsayilan('v1', { bitisTarihi: '2025-12-31' }, 'user-1'),
    ).rejects.toThrow('Bitiş tarihi başlangıç tarihinden önce olamaz.')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('araç: makul aralık dışı ve geçersiz tarih reddedilir (Invalid Date artık sızmaz)', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    for (const bitisTarihi of ['2099-01-01', 'abc', '2026-02-30']) {
      await expect(guncelleServisGuzergahAracVarsayilan('v1', { bitisTarihi }, 'u')).rejects.toThrow(/Bitiş tarihi/)
    }
    await expect(guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '1999-01-01' }, 'u')).rejects.toThrow(/Başlangıç tarihi/)
    await expect(guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '' }, 'u')).rejects.toThrow('Başlangıç tarihi zorunludur.')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('araç: başlangıç çakışma yaratıyorsa mevcut Türkçe çakışma mesajıyla reddedilir', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    mocks.aracVarsayilanFindFirst.mockResolvedValue({
      id: 'v-baska', baslangicTarihi: new Date('2025-12-01'), bitisTarihi: new Date('2026-01-15'),
      guzergah: { kod: 'BASKA', ad: 'Başka Güzergah' },
    })
    await expect(
      guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2025-12-20' }, 'user-1'),
    ).rejects.toThrow('zaten "BASKA — Başka Güzergah"')
    expect(mocks.aracVarsayilanUpdate).not.toHaveBeenCalled()
  })

  it('araç: PASİF kayıtta tarih düzeltmesi çakışma sorgusu yapmaz (geri alınırken kontrol edilir)', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac({ aktif: false }))
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2026-02-01' }, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).not.toHaveBeenCalled()
  })

  it('araç: tarih değişmezse (aynı değer gönderildi) çakışma sorgusu ve audit YOK', async () => {
    mocks.aracVarsayilanFindUnique.mockResolvedValue(arac())
    mocks.aracVarsayilanUpdate.mockResolvedValue({ id: 'v1' })
    await guncelleServisGuzergahAracVarsayilan('v1', { baslangicTarihi: '2026-01-01', bitisTarihi: '2026-06-30' }, 'user-1')
    expect(mocks.aracVarsayilanFindFirst).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('şoför: başlangıç düzeltme + çakışma kontrolü + audit', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue(sofor())
    mocks.soforVarsayilanFindFirst.mockResolvedValue(null)
    mocks.soforVarsayilanUpdate.mockResolvedValue({ id: 's1' })
    await guncelleServisGuzergahSoforVarsayilan('s1', { baslangicTarihi: '2026-02-01' }, 'user-1')
    expect(mocks.soforVarsayilanFindFirst).toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data).toMatchObject({
      hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', islem: 'GUNCELLEME', userId: 'user-1',
    })
  })

  it('şoför: bitiş < başlangıç ve makul dışı tarih reddedilir', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue(sofor())
    await expect(guncelleServisGuzergahSoforVarsayilan('s1', { bitisTarihi: '2025-01-01' }, 'u')).rejects.toThrow('başlangıç tarihinden önce')
    await expect(guncelleServisGuzergahSoforVarsayilan('s1', { bitisTarihi: '2099-01-01' }, 'u')).rejects.toThrow(/en fazla 1 yıl/)
    expect(mocks.soforVarsayilanUpdate).not.toHaveBeenCalled()
  })
})

describe('A3 — servis sorumlusu düzenleme', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    // Önceki testlerden kalan mockResolvedValueOnce kuyruğu bu testleri bozmasın.
    for (const m of [
      mocks.aracVarsayilanFindUnique, mocks.aracVarsayilanFindFirst, mocks.aracVarsayilanUpdate,
      mocks.soforVarsayilanFindUnique, mocks.soforVarsayilanFindFirst, mocks.soforVarsayilanUpdate,
      mocks.sorumluFindUnique, mocks.sorumluUpdate,
      mocks.personelAtamaFindUnique, mocks.personelAtamaFindFirst, mocks.personelAtamaUpdate,
      mocks.islemGecmisiCreate,
    ]) m.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  const sorumlu = () => ({
    id: 'sr1', personnelId: 'p1', rol: 'ANA', aktif: true,
    baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, neden: null, aciklama: null,
  })

  it('başlangıç, bitiş, neden, açıklama düzenlenir ve her biri audit\'e eski → yeni yazılır', async () => {
    mocks.sorumluFindUnique.mockResolvedValue(sorumlu())
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu(
      'sr1',
      { baslangicTarihi: '2026-02-01', bitisTarihi: '2026-12-31', neden: 'Görev değişikliği', aciklama: 'Not' },
      'user-1',
    )
    const audit = mocks.islemGecmisiCreate.mock.calls[0][0].data
    expect(audit).toMatchObject({ hedefTipi: 'SORUMLUSU', islem: 'GUNCELLEME', userId: 'user-1' })
    expect(Object.keys(audit.yeniDeger).sort()).toEqual(['aciklama', 'baslangicTarihi', 'bitisTarihi', 'neden'])
  })

  it('personel kimliği düzenlenemez: update verisinde personnelId/rol yok', async () => {
    mocks.sorumluFindUnique.mockResolvedValue(sorumlu())
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu('sr1', { neden: 'x', personnelId: 'p-baska', rol: 'YEDEK' } as never, 'user-1')
    const data = mocks.sorumluUpdate.mock.calls[0][0].data
    expect(data).not.toHaveProperty('personnelId')
    expect(data).not.toHaveProperty('rol')
  })

  it('bitiş < başlangıç ve geçersiz tarih reddedilir', async () => {
    mocks.sorumluFindUnique.mockResolvedValue(sorumlu())
    await expect(guncelleServisSorumlusu('sr1', { bitisTarihi: '2025-12-31' }, 'u')).rejects.toThrow('başlangıç tarihinden önce')
    await expect(guncelleServisSorumlusu('sr1', { baslangicTarihi: 'abc' }, 'u')).rejects.toThrow(/Başlangıç tarihi geçersiz/)
    expect(mocks.sorumluUpdate).not.toHaveBeenCalled()
  })

  it('çakışma kontrolü YOK (bilinçli: bir personel birden çok güzergâhta sorumlu olabilir)', async () => {
    mocks.sorumluFindUnique.mockResolvedValue(sorumlu())
    mocks.sorumluUpdate.mockResolvedValue({ id: 'sr1' })
    await guncelleServisSorumlusu('sr1', { baslangicTarihi: '2026-03-01' }, 'u')
    expect(mocks.sorumluUpdate).toHaveBeenCalled()
  })
})

describe('A3 — personel ataması bitiş tarihi düzeltme', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    // Önceki testlerden kalan mockResolvedValueOnce kuyruğu bu testleri bozmasın.
    for (const m of [
      mocks.aracVarsayilanFindUnique, mocks.aracVarsayilanFindFirst, mocks.aracVarsayilanUpdate,
      mocks.soforVarsayilanFindUnique, mocks.soforVarsayilanFindFirst, mocks.soforVarsayilanUpdate,
      mocks.sorumluFindUnique, mocks.sorumluUpdate,
      mocks.personelAtamaFindUnique, mocks.personelAtamaFindFirst, mocks.personelAtamaUpdate,
      mocks.islemGecmisiCreate,
    ]) m.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  const atama = (ek: Record<string, unknown> = {}) => ({
    id: 'a1', personnelId: 'p1', aktif: true,
    baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null, ...ek,
  })

  it('bitiş düzeltilir, çakışma kontrolü kendi kaydını dışlar, audit yazılır', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(atama())
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'a1' })
    await guncelleServisPersonelAtama('a1', { bitisTarihi: '2026-09-30' }, 'user-1')
    expect(mocks.personelAtamaUpdate.mock.calls[0][0].data.bitisTarihi).toEqual(new Date('2026-09-30T00:00:00.000Z'))
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data).toMatchObject({
      hedefTipi: 'PERSONEL_ATAMA', islem: 'GUNCELLEME', userId: 'user-1',
    })
  })

  it('başlangıçtan önceki, makul dışı ve geçersiz bitiş reddedilir', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(atama())
    await expect(guncelleServisPersonelAtama('a1', { bitisTarihi: '2025-12-31' }, 'u')).rejects.toThrow('başlangıç tarihinden önce')
    await expect(guncelleServisPersonelAtama('a1', { bitisTarihi: '2062-01-01' }, 'u')).rejects.toThrow(/en fazla 1 yıl/)
    await expect(guncelleServisPersonelAtama('a1', { bitisTarihi: 'abc' }, 'u')).rejects.toThrow(/Bitiş tarihi geçersiz/)
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('bitiş boşaltılırsa süresiz olur', async () => {
    mocks.personelAtamaFindUnique.mockResolvedValue(atama({ bitisTarihi: new Date('2026-06-30') }))
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'a1' })
    await guncelleServisPersonelAtama('a1', { bitisTarihi: '' }, 'user-1')
    expect(mocks.personelAtamaUpdate.mock.calls[0][0].data.bitisTarihi).toBeNull()
  })
})

describe('A3 — kapatma (pasifleştirme) tarihi bugünden ileri olamaz', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    // Önceki testlerden kalan mockResolvedValueOnce kuyruğu bu testleri bozmasın.
    for (const m of [
      mocks.aracVarsayilanFindUnique, mocks.aracVarsayilanFindFirst, mocks.aracVarsayilanUpdate,
      mocks.soforVarsayilanFindUnique, mocks.soforVarsayilanFindFirst, mocks.soforVarsayilanUpdate,
      mocks.sorumluFindUnique, mocks.sorumluUpdate,
      mocks.personelAtamaFindUnique, mocks.personelAtamaFindFirst, mocks.personelAtamaUpdate,
      mocks.islemGecmisiCreate,
    ]) m.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  const kayit = { id: 'k1', aktif: true, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null }
  const durumlar: [string, () => void, (b: string) => Promise<unknown>][] = [
    ['araç varsayılan', () => mocks.aracVarsayilanFindUnique.mockResolvedValue(kayit), (b) => pasiflestirServisGuzergahAracVarsayilan('k1', b, 'u')],
    ['şoför varsayılan', () => mocks.soforVarsayilanFindUnique.mockResolvedValue(kayit), (b) => pasiflestirServisGuzergahSoforVarsayilan('k1', b, 'u')],
    ['sorumlu', () => mocks.sorumluFindUnique.mockResolvedValue(kayit), (b) => pasiflestirServisSorumlusu('k1', b, 'u')],
    ['personel ataması', () => mocks.personelAtamaFindUnique.mockResolvedValue(kayit), (b) => pasiflestirServisPersonelAtama('k1', b, 'u')],
  ]

  it.each(durumlar)('%s: ileri tarihli kapatma reddedilir, yazma/audit olmaz', async (_ad, kur, kapat) => {
    kur()
    await expect(kapat('2026-12-31')).rejects.toThrow(/bugünden ileri olamaz/)
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it.each(durumlar)('%s: başlangıçtan önceki ve geçersiz kapatma reddedilir', async (_ad, kur, kapat) => {
    kur()
    await expect(kapat('2025-12-31')).rejects.toThrow('başlangıç tarihinden önce')
    await expect(kapat('abc')).rejects.toThrow(/Kapatma tarihi geçersiz/)
    await expect(kapat('')).rejects.toThrow('Kapatma tarihi zorunludur')
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})

// ============================================================================
// A4 — bağımlılık korumaları
// ============================================================================
import { BagliKayitHatasi } from './bagimlilik'

describe('A4 — pasifleştirmede bağlı AKTİF kayıt: onaysız reddedilir, onaylı audit\'e yazılır', () => {
  const BAG = [
    { tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145', '41P0327'] },
    { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 1, ornekler: [] },
  ]
  type Durum = {
    ad: string
    hedefTipi: string
    kur: () => void
    bag: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    pasiflestir: (onay?: boolean) => Promise<unknown>
  }
  const durumlar: Durum[] = [
    { ad: 'yerleşke', hedefTipi: 'YERLESKE', bag: mocks.bagYerleske, update: mocks.yerleskeUpdate,
      kur: () => mocks.yerleskeFindUnique.mockResolvedValue({ id: 'k1', aktif: true }),
      pasiflestir: (onay) => pasiflestirServisYerleske('k1', 'user-1', { onay }) },
    // firma: A5'te ZİNCİRLEME pasif — aşağıdaki A5 bloğunda ayrıca test edilir.
    { ad: 'güzergâh', hedefTipi: 'GUZERGAH', bag: mocks.bagGuzergah, update: mocks.guzergahUpdate,
      kur: () => mocks.guzergahFindUnique.mockResolvedValue({ id: 'k1', aktif: true }),
      pasiflestir: (onay) => pasiflestirServisGuzergah('k1', 'user-1', { onay }) },
    { ad: 'araç', hedefTipi: 'ARAC', bag: mocks.bagArac, update: mocks.aracUpdate,
      kur: () => mocks.aracFindUnique.mockResolvedValue({ id: 'k1', aktif: true }),
      pasiflestir: (onay) => pasiflestirServisArac('k1', 'user-1', { onay }) },
    { ad: 'şoför', hedefTipi: 'SOFOR', bag: mocks.bagSofor, update: mocks.soforUpdate,
      kur: () => mocks.soforFindUnique.mockResolvedValue({ id: 'k1', aktif: true }),
      pasiflestir: (onay) => pasiflestirServisSofor('k1', 'user-1', { onay }) },
    { ad: 'sefer dilimi', hedefTipi: 'SEFER_DILIMI', bag: mocks.bagDilim, update: mocks.seferDilimiUpdate,
      kur: () => mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'k1', aktif: true }),
      pasiflestir: (onay) => pasiflestirServisSeferDilimi('k1', 'user-1', { onay }) },
  ]

  it.each(durumlar)('🔴 %s: bağlı kayıt varken onaysız istek BagliKayitHatasi ile reddedilir, yazma/audit YOK', async (d) => {
    d.kur()
    d.bag.mockResolvedValueOnce(BAG)
    const hata = await d.pasiflestir().catch((e) => e)
    expect(hata).toBeInstanceOf(BagliKayitHatasi)
    expect((hata as BagliKayitHatasi).bagimliliklar).toEqual(BAG)
    expect((hata as Error).message).toMatch(/bağlı aktif kayıtlar var \(2 aktif araç, 1 aktif şoför\)/)
    expect((hata as Error).message).toMatch(/otomatik kapatılmaz/)
    expect(d.update).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it.each(durumlar)('%s: onay=false açıkça verilse de reddedilir', async (d) => {
    d.kur()
    d.bag.mockResolvedValueOnce(BAG)
    await expect(d.pasiflestir(false)).rejects.toBeInstanceOf(BagliKayitHatasi)
    expect(d.update).not.toHaveBeenCalled()
  })

  it.each(durumlar)('🔴 %s: onaylı istek pasifleştirir ve ONAY + özet audit aciklamasına yazılır', async (d) => {
    d.kur()
    d.bag.mockResolvedValueOnce(BAG)
    d.update.mockResolvedValue({ id: 'k1', aktif: false })
    await d.pasiflestir(true)
    expect(d.update).toHaveBeenCalledWith(expect.objectContaining({ data: { aktif: false } }))
    const audit = mocks.islemGecmisiCreate.mock.calls[0][0].data
    expect(audit).toMatchObject({
      hedefTipi: d.hedefTipi, hedefId: 'k1', islem: 'PASIFLESTIRME', userId: 'user-1',
      oncekiDeger: { aktif: true }, yeniDeger: { aktif: false },
    })
    expect(audit.aciklama).toMatch(/kullanıcı onayıyla pasifleştirildi: 2 aktif araç, 1 aktif şoför/)
    expect(audit.aciklama).toMatch(/otomatik kapatılmadı/)
  })

  it.each(durumlar)('%s: bağlı kayıt yoksa onaysız pasifleştirme normal çalışır, audit aciklama içermez', async (d) => {
    d.kur()
    d.bag.mockResolvedValueOnce([])
    d.update.mockResolvedValue({ id: 'k1', aktif: false })
    await d.pasiflestir()
    expect(d.update).toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data.aciklama).toBeNull()
  })

  it.each(durumlar)('%s: bağlı kayıt okuması mutasyonla AYNI transaction (tx) üzerinde yapılır', async (d) => {
    d.kur()
    d.bag.mockResolvedValueOnce([])
    d.update.mockResolvedValue({ id: 'k1', aktif: false })
    await d.pasiflestir()
    const [dbArg, idArg] = d.bag.mock.calls[0]
    expect(idArg).toBe('k1')
    expect(typeof dbArg.servisIslemGecmisi.create).toBe('function') // tx nesnesi (prisma mock'u ile aynı delegeler)
  })
})

describe('A4 — güzergâh / durak KODU kimliktir: kullanım kaydı varsa değiştirilemez', () => {
  const kullanim = [
    { tur: 'PERSONEL_ATAMA', etiket: 'personel ataması', sayi: 3, ornekler: [] },
    { tur: 'SIKAYET', etiket: 'şikâyet', sayi: 1, ornekler: [] },
  ]

  it('🔴 güzergâh: kod değişiyor + kullanım var → reddedilir (ad serbest notuyla), yazma yok', async () => {
    mocks.guzergahFindUnique.mockReset()
    mocks.guzergahFindUnique.mockResolvedValueOnce({ id: 'g1', kod: 'ESKI-KOD' }).mockResolvedValueOnce(null)
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.kodGuzergah.mockResolvedValueOnce(kullanim)
    await expect(updateServisGuzergah('g1', { ...gecerliGuzergah, kod: 'yeni-kod' }, 'u')).rejects.toThrow(
      'Bu güzergâhın kodu değiştirilemez: 3 personel ataması, 1 şikâyet bu kodla ilişkili. Ad serbestçe değiştirilebilir.',
    )
    expect(mocks.guzergahUpdate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('güzergâh: kullanım kaydı VARKEN yalnız ad (kod aynı) serbestçe değişir; kullanım sorgusu hiç yapılmaz', async () => {
    mocks.guzergahFindUnique.mockReset()
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', kod: 'DAR-1' })
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', ad: 'Yeni Ad' })
    mocks.kodGuzergah.mockClear()
    await updateServisGuzergah('g1', { ...gecerliGuzergah, kod: 'dar-1', ad: 'Yeni Ad' }, 'u')
    expect(mocks.kodGuzergah).not.toHaveBeenCalled()
    expect(mocks.guzergahUpdate).toHaveBeenCalled()
  })

  it('güzergâh: kullanım kaydı YOKSA kod değiştirilebilir', async () => {
    mocks.guzergahFindUnique.mockReset()
    mocks.guzergahFindUnique.mockResolvedValueOnce({ id: 'g1', kod: 'ESKI-KOD' }).mockResolvedValueOnce(null)
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
    mocks.kodGuzergah.mockResolvedValueOnce([])
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', kod: 'YENI-KOD' })
    await updateServisGuzergah('g1', { ...gecerliGuzergah, kod: 'yeni-kod' }, 'u')
    expect(mocks.kodGuzergah).toHaveBeenCalledTimes(1)
    expect(mocks.guzergahUpdate).toHaveBeenCalled()
  })

  it('🔴 durak: kod değişiyor + kullanım var → reddedilir', async () => {
    mocks.durakFindUnique.mockReset()
    mocks.durakFindUnique.mockResolvedValueOnce({ id: 'd1', kod: 'ESKI' }).mockResolvedValueOnce(null)
    mocks.kodDurak.mockResolvedValueOnce([{ tur: 'PERSONEL_ATAMA', etiket: 'personel ataması', sayi: 2, ornekler: [] }])
    await expect(updateServisDurak('d1', { ...gecerliDurak, kod: 'yeni' }, 'u')).rejects.toThrow(
      'Bu durağın kodu değiştirilemez: 2 personel ataması bu kodla ilişkili. Ad serbestçe değiştirilebilir.',
    )
    expect(mocks.durakUpdate).not.toHaveBeenCalled()
  })

  it('durak: kullanım kaydı VARKEN ad serbestçe değişir (kod aynı)', async () => {
    mocks.durakFindUnique.mockReset()
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', kod: 'DRK-01' })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', ad: 'Yeni Ad' })
    mocks.kodDurak.mockClear()
    await updateServisDurak('d1', { ...gecerliDurak, kod: 'drk-01', ad: 'Yeni Ad' }, 'u')
    expect(mocks.kodDurak).not.toHaveBeenCalled()
    expect(mocks.durakUpdate).toHaveBeenCalled()
  })

  it('durak: kullanım kaydı YOKSA kod değiştirilebilir', async () => {
    mocks.durakFindUnique.mockReset()
    mocks.durakFindUnique.mockResolvedValueOnce({ id: 'd1', kod: 'ESKI' }).mockResolvedValueOnce(null)
    mocks.kodDurak.mockResolvedValueOnce([])
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', kod: 'YENI' })
    await updateServisDurak('d1', { ...gecerliDurak, kod: 'yeni' }, 'u')
    expect(mocks.durakUpdate).toHaveBeenCalled()
  })
})

// ============================================================================
// A5 — firma pasifinde ZİNCİRLEME pasif + seçici geri alma
// ============================================================================
import { firmaGeriAlOnizleme } from './service'

describe('A5 — firma pasifleştirme (zincirleme, onaylı)', () => {
  const BAG = [
    { tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145', '41P0327'] },
    { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 1, ornekler: [] },
    { tur: 'ARAC_VARSAYILAN', etiket: 'Aktif varsayılan araç ataması', sayi: 2, ornekler: ['DARICA — Darıca Hattı (SABAH_GIDIS)'] },
  ]
  const kur = () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'f1', ad: 'Taşeron A', aktif: true })
    mocks.firmaUpdate.mockResolvedValue({ id: 'f1', aktif: false })
  }

  it('🔴 bağlı aktif kayıt + onaysız: BagliKayitHatasi zincirleme=true + not; zincir ve firma güncellemesi YOK', async () => {
    kur()
    mocks.bagFirma.mockResolvedValueOnce(BAG)
    const hata = await pasiflestirServisFirma('f1', 'user-1').catch((e) => e)
    expect(hata).toBeInstanceOf(BagliKayitHatasi)
    expect(hata.zincirleme).toBe(true)
    expect(hata.notlar).toEqual(['Araçlar yeni firmaya geçiyorsa önce araçların firmasını değiştirin.'])
    expect(hata.message).toMatch(/birlikte pasifleşir\/kapanır \(2 aktif araç, 1 aktif şoför, 2 aktif varsayılan araç ataması\)/)
    expect(mocks.zincirPasif).not.toHaveBeenCalled()
    expect(mocks.firmaUpdate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('🔴 onaylı: zincir AYNI tx üzerinde çalışır, sonra firma pasif; firma audit\'i zincirIslemId + özet taşır', async () => {
    kur()
    mocks.bagFirma.mockResolvedValueOnce(BAG)
    const sira: string[] = []
    mocks.zincirPasif.mockImplementationOnce(async () => {
      sira.push('zincir')
      return { islemId: 'z-123', arac: 2, sofor: 1, aracAtama: 2, soforAtama: 0 }
    })
    mocks.firmaUpdate.mockImplementationOnce(async () => {
      sira.push('firma')
      return { id: 'f1', aktif: false }
    })
    await pasiflestirServisFirma('f1', 'user-1', { onay: true })

    expect(sira).toEqual(['zincir', 'firma'])
    const [txArg, firmaArg, yapanArg] = mocks.zincirPasif.mock.calls[0]
    expect(typeof txArg.servisIslemGecmisi.create).toBe('function') // tx nesnesi
    expect(firmaArg).toMatchObject({ id: 'f1', ad: 'Taşeron A' })
    expect(yapanArg).toBe('user-1')
    const audit = mocks.islemGecmisiCreate.mock.calls.at(-1)![0].data
    expect(audit).toMatchObject({
      hedefTipi: 'FIRMA', hedefId: 'f1', islem: 'PASIFLESTIRME', userId: 'user-1',
      oncekiDeger: { aktif: true }, yeniDeger: { aktif: false, zincirIslemId: 'z-123' },
    })
    expect(audit.aciklama).toMatch(/Firma kullanıcı onayıyla pasifleştirildi; bağlı kayıtlar birlikte pasifleşti\/kapandı: 2 aktif araç, 1 aktif şoför/)
  })

  it('bağlı kayıt YOKSA zincir çalışmaz; firma düz pasifleşir (zincirIslemId yok, açıklama yok)', async () => {
    kur()
    mocks.bagFirma.mockResolvedValueOnce([])
    await pasiflestirServisFirma('f1', 'user-1')
    expect(mocks.zincirPasif).not.toHaveBeenCalled()
    const audit = mocks.islemGecmisiCreate.mock.calls.at(-1)![0].data
    expect(audit.yeniDeger).toEqual({ aktif: false })
    expect(audit.aciklama).toBeNull()
  })

  it('🔴 zincir hata verirse (audit/atama) firma pasifleştirilmez', async () => {
    kur()
    mocks.bagFirma.mockResolvedValueOnce(BAG)
    mocks.zincirPasif.mockRejectedValueOnce(new Error('audit yazılamadı'))
    await expect(pasiflestirServisFirma('f1', 'user-1', { onay: true })).rejects.toThrow('audit yazılamadı')
    expect(mocks.firmaUpdate).not.toHaveBeenCalled()
  })
})

describe('A5 — firma geri alma (seçici)', () => {
  beforeEach(() => {
    mocks.firmaFindUnique.mockResolvedValue({ id: 'f1', ad: 'Taşeron A', aktif: false })
    mocks.firmaUpdate.mockResolvedValue({ id: 'f1', aktif: true })
    mocks.zincirGeriAl.mockReset()
    mocks.zincirSonId.mockReset()
    mocks.zincirOnizleme.mockReset()
  })

  it('seçenek yok: yalnız firma geri alınır; zincir kimliği hiç sorgulanmaz', async () => {
    await geriAlServisFirma('f1', 'user-1')
    expect(mocks.zincirSonId).not.toHaveBeenCalled()
    expect(mocks.zincirGeriAl).not.toHaveBeenCalled()
  })

  it('🔴 zincirGeriAl=true + zincir var: firma aktifleşir SONRA zincir geri alınır; sonuç döner', async () => {
    mocks.zincirSonId.mockResolvedValueOnce('z-123')
    const sira: string[] = []
    mocks.firmaUpdate.mockImplementationOnce(async () => {
      sira.push('firma')
      return { id: 'f1', aktif: true }
    })
    mocks.zincirGeriAl.mockImplementationOnce(async () => {
      sira.push('zincir')
      return { arac: 2, sofor: 1, kapananAtama: 3 }
    })
    const sonuc = await geriAlServisFirma('f1', 'user-1', { zincirGeriAl: true })
    expect(sira).toEqual(['firma', 'zincir'])
    expect(mocks.zincirGeriAl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'f1' }), 'z-123', 'user-1')
    expect((sonuc as { zincirSonucu: unknown }).zincirSonucu).toEqual({ arac: 2, sofor: 1, kapananAtama: 3 })
  })

  it('zincirGeriAl=true ama son pasifleştirme zincirsiz: yalnız firma, zincirGeriAl çağrılmaz', async () => {
    mocks.zincirSonId.mockResolvedValueOnce(null)
    const sonuc = await geriAlServisFirma('f1', 'user-1', { zincirGeriAl: true })
    expect(mocks.zincirGeriAl).not.toHaveBeenCalled()
    expect(sonuc).not.toHaveProperty('zincirSonucu')
  })

  it('firma audit\'i her durumda AKTIFLESTIRME yazar', async () => {
    mocks.zincirSonId.mockResolvedValueOnce(null)
    await geriAlServisFirma('f1', 'user-9', { zincirGeriAl: true })
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data).toMatchObject({
      hedefTipi: 'FIRMA', islem: 'AKTIFLESTIRME', userId: 'user-9',
    })
  })

  it('önizleme: pasif firma için zincir önizlemesini döner; aktif firmada hata', async () => {
    mocks.zincirOnizleme.mockResolvedValueOnce({ zincirIslemId: 'z', geriAlinabilirArac: 2, geriAlinabilirSofor: 1, kapananAtama: 3 })
    expect(await firmaGeriAlOnizleme('f1')).toEqual({ zincirIslemId: 'z', geriAlinabilirArac: 2, geriAlinabilirSofor: 1, kapananAtama: 3 })
    mocks.firmaFindUnique.mockResolvedValueOnce({ id: 'f1', aktif: true })
    await expect(firmaGeriAlOnizleme('f1')).rejects.toThrow('Firma zaten aktif.')
    mocks.firmaFindUnique.mockResolvedValueOnce(null)
    await expect(firmaGeriAlOnizleme('yok')).rejects.toThrow('Firma bulunamadı.')
  })
})

// ============================================================================
// A6 — plaka doğrulama
// ============================================================================
import { BenzerPlakaHatasi } from './plaka'

describe('A6 — araç plakası: normalize + biçim + aynı/benzer kontrolü', () => {
  const arac = (ek: Record<string, unknown> = {}) => ({ ...gecerliArac, plaka: '41P0145', gecerlilikBaslangici: null, gecerlilikBitisi: null, ...ek })
  beforeEach(() => {
    mocks.aracFindMany.mockReset()
    mocks.aracFindUnique.mockReset()
    mocks.aracCreate.mockReset()
    mocks.aracUpdate.mockReset()
    mocks.islemGecmisiCreate.mockReset()
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracCreate.mockResolvedValue({ id: 'a-yeni' })
  })

  it('normalize: " 41 p-0145 " → "41P0145" olarak kaydedilir', async () => {
    mocks.aracFindMany.mockResolvedValue([])
    await createServisArac(arac({ plaka: ' 41 p-0145 ' }))
    expect(mocks.aracCreate.mock.calls[0][0].data.plaka).toBe('41P0145')
  })

  it.each(['99A123', '41', 'ABC123', '41ŞAA123', '41P01451'])('🔴 geçersiz biçim "%s" reddedilir; DB sorgusu/yazma YOK', async (plaka) => {
    await expect(createServisArac(arac({ plaka }))).rejects.toThrow(/Geçersiz plaka biçimi|en az 5 karakter/)
    expect(mocks.aracFindMany).not.toHaveBeenCalled()
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('biçim hatası açık Türkçe mesaj taşır', async () => {
    await expect(createServisArac(arac({ plaka: '99 ABC 123' }))).rejects.toThrow(
      'Geçersiz plaka biçimi: "99ABC123". Plaka il kodu (01-81), 1-3 harf ve 2-4 rakamdan oluşmalıdır (örn. 41P0145).',
    )
  })

  it('aynı plaka AKTİF araçta varsa reddedilir', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    await expect(createServisArac(arac({ plaka: '41 P 0145' }))).rejects.toThrow('"41P0145" plakası zaten kullanılıyor.')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('🔴 aynı plaka PASİF araçta varsa reddedilir ve "Geri Al ile etkinleştirin" önerilir', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: false }])
    await expect(createServisArac(arac())).rejects.toThrow(/pasif bir araç olarak kayıtlı.*Geri Al ile etkinleştirin/)
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('🔴 benzer plaka (41PO145 ↔ 41P0145): onaysız → BenzerPlakaHatasi, KAYIT YOK', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    const hata = await createServisArac(arac({ plaka: '41PO145' })).catch((e) => e)
    expect(hata).toBeInstanceOf(BenzerPlakaHatasi)
    expect(hata.message).toBe('Benzer plaka var: 41P0145 — aynı araç mı?')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('🔴 benzer plaka (41PO0145 ↔ 41P0145) — fazladan O/0 yazımı da yakalanır', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    await expect(createServisArac(arac({ plaka: '41PO0145' }))).rejects.toBeInstanceOf(BenzerPlakaHatasi)
  })

  it('benzer plaka PASİF kayıtla da uyarır', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: false }])
    await expect(createServisArac(arac({ plaka: '41PO145' }))).rejects.toBeInstanceOf(BenzerPlakaHatasi)
  })

  it('🔴 benzer plaka + onay (benzerPlakaOnayi: true): kaydedilir, ONAY audit açıklamasına yazılır', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    await createServisArac(arac({ plaka: '41PO145', benzerPlakaOnayi: true }), 'user-1')
    expect(mocks.aracCreate).toHaveBeenCalled()
    expect(mocks.aracCreate.mock.calls[0][0].data).not.toHaveProperty('benzerPlakaOnayi') // DB'ye yazılmaz
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data.aciklama).toBe(
      'Benzer plaka uyarısı kullanıcı onayıyla geçildi: 41P0145.',
    )
  })

  it('onay yalnız benzer plakayı geçer: AYNI plaka onayla da reddedilir', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    await expect(createServisArac(arac({ benzerPlakaOnayi: true }))).rejects.toThrow('zaten kullanılıyor')
  })

  it('benzemeyen plaka (34LAC828 ↔ 34LAC829): uyarısız kaydedilir, audit açıklaması yok', async () => {
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '34LAC829', aktif: true }])
    await createServisArac(arac({ plaka: '34LAC828' }), 'user-1')
    expect(mocks.aracCreate).toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate.mock.calls[0][0].data.aciklama).toBeNull()
  })

  // ---- güncelleme ----
  const mevcut = (ek: Record<string, unknown> = {}) => ({
    id: 'a1', plaka: '41P0145', kapasite: 16, firmaId: 'firma-1', aracTipi: 'Minibüs',
    gecerlilikBaslangici: null, gecerlilikBitisi: null, ...ek,
  })

  it('güncelleme: plaka DEĞİŞİYORSA biçim denetlenir', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut())
    await expect(updateServisArac('a1', arac({ plaka: '99X123' }))).rejects.toThrow(/Geçersiz plaka biçimi/)
    expect(mocks.aracUpdate).not.toHaveBeenCalled()
  })

  it('🔴 güncelleme: plaka DEĞİŞMİYORSA eski (kural öncesi) geçersiz plakalı kayıt yine de düzenlenebilir; plaka sorgusu yok', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut({ plaka: 'ESKI-PLAKA9' }))
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', arac({ plaka: 'ESKI-PLAKA9', kapasite: 20 }))
    expect(mocks.aracFindMany).not.toHaveBeenCalled()
    expect(mocks.aracUpdate).toHaveBeenCalled()
  })

  it('güncelleme: başka bir araçla aynı plakaya değiştirme reddedilir (kendisi hariç)', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut())
    mocks.aracFindMany.mockResolvedValue([
      { id: 'a1', plaka: '41P0145', aktif: true }, // kendisi
      { id: 'a2', plaka: '34LAC828', aktif: false },
    ])
    await expect(updateServisArac('a1', arac({ plaka: '34 lac 828' }))).rejects.toThrow(/pasif bir araç olarak kayıtlı/)
  })

  it('güncelleme: plakayı kendi benzerine çevirme (41P0145 → 41PO145) KENDİSİYLE uyarmaz', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut())
    mocks.aracFindMany.mockResolvedValue([{ id: 'a1', plaka: '41P0145', aktif: true }])
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', arac({ plaka: '41PO145' }), 'user-1')
    expect(mocks.aracUpdate).toHaveBeenCalled()
  })

  it('güncelleme: başka araca benzer plaka → onaysız BenzerPlakaHatasi; onayla geçer + audit açıklaması', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut())
    mocks.aracFindMany.mockResolvedValue([
      { id: 'a1', plaka: '41P0145', aktif: true },
      { id: 'a2', plaka: '06AB123', aktif: true },
    ])
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await expect(updateServisArac('a1', arac({ plaka: '06A8123' }))).rejects.toBeInstanceOf(BenzerPlakaHatasi)
    expect(mocks.aracUpdate).not.toHaveBeenCalled()

    await updateServisArac('a1', arac({ plaka: '06A8123', benzerPlakaOnayi: true }), 'user-1')
    expect(mocks.aracUpdate).toHaveBeenCalled()
    const audit = mocks.islemGecmisiCreate.mock.calls[0][0].data
    expect(audit).toMatchObject({ hedefTipi: 'ARAC', islem: 'GUNCELLEME', userId: 'user-1' })
    expect(audit.aciklama).toBe('Benzer plaka uyarısı kullanıcı onayıyla geçildi: 06AB123.')
  })
})

// ============================================================================
// A7 — araç/güzergâh geçerlilik tarihleri + araç tipi listesi
// ============================================================================
import { ARAC_TIPLERI } from './arac-tipleri'

describe('A7 — araç geçerlilik tarihleri (A3 kuralları)', () => {
  const arac = (ek: Record<string, unknown> = {}) => ({ ...gecerliArac, plaka: '41P0145', ...ek })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    mocks.aracFindMany.mockReset()
    mocks.aracFindUnique.mockReset()
    mocks.aracCreate.mockReset()
    mocks.aracUpdate.mockReset()
    mocks.islemGecmisiCreate.mockReset()
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracCreate.mockResolvedValue({ id: 'a-yeni' })
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['2099-12-31', 'bitis', /Geçerlilik bitiş tarihi bugünden en fazla 1 yıl/],
    ['1999-01-01', 'baslangic', /Geçerlilik başlangıç tarihi 2020-01-01 tarihinden önce olamaz/],
  ])('🔴 oluşturma: %s (%s) reddedilir; DB yazması YOK', async (tarih, alan, mesaj) => {
    const form = alan === 'bitis' ? arac({ gecerlilikBaslangici: '2026-08-01', gecerlilikBitisi: tarih }) : arac({ gecerlilikBaslangici: tarih, gecerlilikBitisi: null })
    await expect(createServisArac(form)).rejects.toThrow(mesaj)
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('oluşturma: bitiş < başlangıç reddedilir', async () => {
    await expect(createServisArac(arac({ gecerlilikBaslangici: '2026-09-01', gecerlilikBitisi: '2026-08-01' }))).rejects.toThrow(/başlangıç tarihinden önce/)
  })

  it('oluşturma: geçerli aralık (bugün + 1 yıl sınırı dahil) kaydedilir', async () => {
    await createServisArac(arac({ gecerlilikBaslangici: '2026-10-03', gecerlilikBitisi: '2027-10-03' }))
    expect(mocks.aracCreate).toHaveBeenCalled()
  })

  const mevcutArac = (ek: Record<string, unknown> = {}) => ({
    id: 'a1', plaka: '41P0145', kapasite: 16, firmaId: 'firma-1', aracTipi: 'Minibüs',
    gecerlilikBaslangici: null, gecerlilikBitisi: null, ...ek,
  })

  it('güncelleme: yeni 2099 bitişi reddedilir', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcutArac())
    await expect(updateServisArac('a1', arac({ gecerlilikBitisi: '2099-01-01' }))).rejects.toThrow(/Geçerlilik bitiş tarihi/)
    expect(mocks.aracUpdate).not.toHaveBeenCalled()
  })

  it('🔴 güncelleme: kural öncesi eski tarih DEĞİŞMİYORSA kayıt diğer alanlar için düzenlenebilir', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcutArac({
      gecerlilikBaslangici: new Date('2019-03-01T00:00:00.000Z'), gecerlilikBitisi: new Date('2031-01-01T00:00:00.000Z'),
    }))
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', arac({ kapasite: 20, gecerlilikBaslangici: '2019-03-01', gecerlilikBitisi: '2031-01-01' }))
    expect(mocks.aracUpdate).toHaveBeenCalled()
  })
})

describe('A7 — güzergâh geçerlilik tarihleri', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
    mocks.guzergahFindUnique.mockReset()
    mocks.guzergahCreate.mockReset()
    mocks.guzergahUpdate.mockReset()
    mocks.yerleskeFindUnique.mockResolvedValue({ id: 'yer-1' })
  })
  afterEach(() => vi.useRealTimers())

  it('🔴 oluşturma: 2099 bitişi ve 1999 başlangıcı reddedilir', async () => {
    await expect(createServisGuzergah({ ...gecerliGuzergah, gecerlilikBitisi: '2099-12-31' })).rejects.toThrow(/Geçerlilik bitiş tarihi bugünden en fazla 1 yıl/)
    await expect(createServisGuzergah({ ...gecerliGuzergah, gecerlilikBaslangici: '1999-01-01' })).rejects.toThrow(/Geçerlilik başlangıç tarihi/)
    expect(mocks.guzergahCreate).not.toHaveBeenCalled()
  })

  it('oluşturma: geçerli aralık (2026-08-01 .. 2026-12-31) kaydedilir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue(null)
    mocks.guzergahCreate.mockResolvedValue({ id: 'g1' })
    await createServisGuzergah(gecerliGuzergah)
    expect(mocks.guzergahCreate).toHaveBeenCalled()
  })

  it('güncelleme: yeni 2099 bitişi reddedilir; DEĞİŞMEYEN eski tarih (2019) muaf', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({
      id: 'g1', kod: 'DAR-1', gecerlilikBaslangici: new Date('2019-03-01T00:00:00.000Z'), gecerlilikBitisi: null,
    })
    await expect(updateServisGuzergah('g1', { ...gecerliGuzergah, gecerlilikBaslangici: '2019-03-01', gecerlilikBitisi: '2099-01-01' })).rejects.toThrow(/Geçerlilik bitiş tarihi/)
    expect(mocks.guzergahUpdate).not.toHaveBeenCalled()

    mocks.guzergahFindUnique.mockResolvedValue({
      id: 'g1', kod: 'DAR-1', gecerlilikBaslangici: new Date('2019-03-01T00:00:00.000Z'), gecerlilikBitisi: null,
    })
    mocks.kodGuzergah.mockResolvedValue([])
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1' })
    await updateServisGuzergah('g1', { ...gecerliGuzergah, kod: 'dar-1', gecerlilikBaslangici: '2019-03-01', gecerlilikBitisi: '' })
    expect(mocks.guzergahUpdate).toHaveBeenCalled()
  })
})

describe('A7 — araç tipi seçim listesi', () => {
  beforeEach(() => {
    mocks.aracFindMany.mockReset()
    mocks.aracFindUnique.mockReset()
    mocks.aracCreate.mockReset()
    mocks.aracUpdate.mockReset()
    mocks.aracFindMany.mockResolvedValue([])
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    mocks.aracCreate.mockResolvedValue({ id: 'a-yeni' })
  })

  it('liste sabittir: Minibüs, Midibüs, Otobüs, Otomobil, Diğer', () => {
    expect([...ARAC_TIPLERI]).toEqual(['Minibüs', 'Midibüs', 'Otobüs', 'Otomobil', 'Diğer'])
  })

  it.each(ARAC_TIPLERI)('oluşturma: "%s" kabul edilir ve string olarak yazılır', async (tip) => {
    await createServisArac({ ...gecerliArac, plaka: '41P0145', aracTipi: tip })
    expect(mocks.aracCreate.mock.calls.at(-1)![0].data.aracTipi).toBe(tip)
  })

  it('oluşturma: boş araç tipi (opsiyonel) kabul edilir → null', async () => {
    await createServisArac({ ...gecerliArac, plaka: '41P0145', aracTipi: '' })
    expect(mocks.aracCreate.mock.calls.at(-1)![0].data.aracTipi).toBeNull()
  })

  it('🔴 oluşturma: listede olmayan serbest metin reddedilir', async () => {
    await expect(createServisArac({ ...gecerliArac, plaka: '41P0145', aracTipi: 'Kamyonet' })).rejects.toThrow(
      'Araç tipi şunlardan biri olmalıdır: Minibüs, Midibüs, Otobüs, Otomobil, Diğer.',
    )
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('küçük harf varyantı ("minibüs") yeni kayıtta reddedilir (liste kesin eşleşme)', async () => {
    await expect(createServisArac({ ...gecerliArac, plaka: '41P0145', aracTipi: 'minibüs' })).rejects.toThrow(/Araç tipi şunlardan biri/)
  })

  const mevcut = (tip: string | null) => ({
    id: 'a1', plaka: '41P0145', kapasite: 16, firmaId: 'firma-1', aracTipi: tip, gecerlilikBaslangici: null, gecerlilikBitisi: null,
  })
  const form = (tip: string) => ({ ...gecerliArac, plaka: '41P0145', gecerlilikBaslangici: null, gecerlilikBitisi: null, aracTipi: tip })

  it('🔴 güncelleme: eski serbest değer ("arapçeşme") DEĞİŞMEDİKÇE kabul edilir (bozulmaz)', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut('arapçeşme'))
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', { ...form('arapçeşme'), kapasite: 20 })
    expect(mocks.aracUpdate.mock.calls[0][0].data.aracTipi).toBe('arapçeşme')
  })

  it('güncelleme: eski serbest değerden başka bir serbest metne geçiş reddedilir; listeden seçim kabul', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut('arapçeşme'))
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await expect(updateServisArac('a1', form('başka serbest'))).rejects.toThrow(/Araç tipi şunlardan biri/)
    await updateServisArac('a1', form('Otobüs'))
    expect(mocks.aracUpdate.mock.calls.at(-1)![0].data.aracTipi).toBe('Otobüs')
  })

  it('güncelleme: araç tipi boşaltılabilir', async () => {
    mocks.aracFindUnique.mockResolvedValue(mevcut('arapçeşme'))
    mocks.aracUpdate.mockResolvedValue({ id: 'a1' })
    await updateServisArac('a1', form(''))
    expect(mocks.aracUpdate.mock.calls[0][0].data.aracTipi).toBeNull()
  })
})

// ============================================================================
// C0 — ORTAK KAPASİTE AŞIMI KURALI: Yeni Atama ve Transfer (B5 mantığıyla AYNI yardımcı)
// ============================================================================
describe('C0 — Yeni Atama: kapasite aşımı onayı', () => {
  const DOLU = { kapasite: 10, atananPersonelSayisi: 10, bosKoltuk: 0, dolulukOrani: 100, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 }
  beforeEach(() => {
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-1', kod: 'DARICA', aktif: true })
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'dilim-1', kod: 'SABAH_GIDIŞ', ad: 'Sabah', aktif: true }])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaCreate.mockResolvedValue({ id: 'pa1' })
    mocks.personelAtamaDilimCreateMany.mockResolvedValue({ count: 1 })
    mocks.personelAtamaFindUnique.mockResolvedValue({ id: 'pa1', ...gecerliPersonelAtama })
  })

  it('🔴 tam dolu dilimde atama → ASIM_ONAYI_GEREKLI (409), KAYIT YOK', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    const e = await createServisPersonelAtama(gecerliPersonelAtama, 'user-1').catch((x: unknown) => x) as { kod?: string; ayrinti?: { etki: { dilimKod: string; fazla: number }[] } }
    expect(e.kod).toBe('ASIM_ONAYI_GEREKLI')
    expect(e.ayrinti?.etki[0]).toMatchObject({ dilimKod: 'SABAH_GIDIŞ', fazla: 1 })
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
    expect(mocks.personelAtamaDilimCreateMany).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('onay (asimOnayi:true) ile aşımda da kaydedilir', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    await createServisPersonelAtama({ ...gecerliPersonelAtama, asimOnayi: true }, 'user-1')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)
  })

  it('aşım yoksa onay istenmez', async () => {
    mocks.kapasiteOzeti.mockResolvedValue({ ...DOLU, atananPersonelSayisi: 9 })
    await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)
  })

  it('araçsız dilimde aşım sayılmaz (motorla aynı kural)', async () => {
    mocks.kapasiteOzeti.mockResolvedValue({ ...DOLU, kapasite: 0, atananPersonelSayisi: 5, durum: 'ARAC_YOK' })
    await createServisPersonelAtama(gecerliPersonelAtama, 'user-1')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)
  })

  it('🔴 yalnız bugünün kapasitesine girenler sayılır: başlangıcı İLERİ tarihli atama aşım uyarısı üretmez', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    await createServisPersonelAtama({ ...gecerliPersonelAtama, baslangicTarihi: '2027-06-01' }, 'user-1')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)
  })
})

describe('C0 + C1 — Transfer: serbest hedef ve kapasite aşımı onayı', () => {
  const DOLU = { kapasite: 10, atananPersonelSayisi: 10, bosKoltuk: 0, dolulukOrani: 100, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0 }
  const eski = { id: 'pa1', aktif: true, personnelId: 'personel-1', guzergahId: 'guzergah-1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null }
  // Hedef: ÖNERİ LİSTESİNDE olması gerekmeyen herhangi aktif güzergâh + durak + dilim
  const form = { guzergahId: 'guzergah-77', durakId: 'durak-5', dilimIdleri: ['dilim-1', 'dilim-2'], transferTarihi: '2026-03-01' }

  beforeEach(() => {
    mocks.personelAtamaFindUnique.mockReset()
    mocks.personelAtamaFindUnique.mockResolvedValueOnce(eski)
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-77', kod: 'SERBEST', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1' })
    mocks.seferDilimiFindMany.mockResolvedValue([
      { id: 'dilim-1', kod: 'SABAH_GIDIŞ', ad: 'Sabah', aktif: true },
      { id: 'dilim-2', kod: 'AKŞAM_DÖNÜŞ', ad: 'Akşam', aktif: true },
    ])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaUpdate.mockResolvedValue({ id: 'pa1' })
    mocks.personelAtamaCreate.mockResolvedValue({ id: 'pa2' })
    mocks.personelAtamaDilimCreateMany.mockResolvedValue({ count: 2 })
    mocks.personelAtamaFindUnique.mockResolvedValueOnce({ id: 'pa2' })
  })

  it('C1: önerilen aday olmayan herhangi aktif güzergâh+durak+dilim seçilerek transfer edilir (eski kapanır, yeni açılır)', async () => {
    await transferServisPersonelAtama('pa1', form, 'user-9')
    expect(mocks.personelAtamaUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ aktif: false }) }))
    expect(mocks.personelAtamaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ guzergahId: 'guzergah-77', durakId: 'durak-5' }),
    }))
    expect(mocks.personelAtamaDilimCreateMany).toHaveBeenCalledWith({
      data: [{ atamaId: 'pa2', dilimId: 'dilim-1' }, { atamaId: 'pa2', dilimId: 'dilim-2' }],
    })
  })

  it('🔴 C1: dilimsiz transfer üretilemez (dilim zorunlu)', async () => {
    await expect(transferServisPersonelAtama('pa1', { ...form, dilimIdleri: [] }, 'user-9')).rejects.toThrow('En az bir sefer dilimi')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('C1: hedef durak o güzergâhın durağı değilse hata, hiçbir şey yazılmaz', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue(null)
    await expect(transferServisPersonelAtama('pa1', form, 'user-9')).rejects.toThrow('güzergahın bir durağı değil')
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
  })

  it('🔴 C0: hedefte aşım → ASIM_ONAYI_GEREKLI, eski atama KAPANMAZ, yenisi AÇILMAZ', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU) // her iki dilim de dolu
    const e = await transferServisPersonelAtama('pa1', form, 'user-9').catch((x: unknown) => x) as { kod?: string; ayrinti?: { etki: unknown[] } }
    expect(e.kod).toBe('ASIM_ONAYI_GEREKLI')
    expect(e.ayrinti?.etki).toHaveLength(2)
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })

  it('C0: onayla → transfer tamamlanır; transfer tarihi İLERİ ise bugünün kapasitesine girmez (aşım uyarısı yok)', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    await transferServisPersonelAtama('pa1', { ...form, asimOnayi: true }, 'user-9')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    mocks.personelAtamaFindUnique.mockResolvedValueOnce(eski).mockResolvedValueOnce({ id: 'pa2' })
    mocks.personnelFindUnique.mockResolvedValue({ id: 'personel-1', aktif: true })
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'guzergah-77', kod: 'SERBEST', aktif: true })
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1' })
    mocks.seferDilimiFindMany.mockResolvedValue([{ id: 'dilim-1', kod: 'S', ad: 'S', aktif: true }])
    mocks.personelAtamaFindFirst.mockResolvedValue(null)
    mocks.personelAtamaCreate.mockResolvedValue({ id: 'pa2' })
    await transferServisPersonelAtama('pa1', { ...form, dilimIdleri: ['dilim-1'], transferTarihi: '2027-05-01' }, 'user-9')
    expect(mocks.personelAtamaCreate).toHaveBeenCalledTimes(1)
  })

  it('transferKapasiteOnizle YAZMAZ: etki + asimVar döner', async () => {
    mocks.kapasiteOzeti.mockResolvedValue(DOLU)
    const o = await transferKapasiteOnizle('pa1', form)
    expect(o.asimVar).toBe(true)
    expect(o.etki.map((e) => [e.dilimKod, e.once, e.sonra, e.koltuk])).toEqual([['SABAH_GIDIŞ', 10, 11, 10], ['AKŞAM_DÖNÜŞ', 10, 11, 10]])
    expect(mocks.personelAtamaUpdate).not.toHaveBeenCalled()
    expect(mocks.personelAtamaCreate).not.toHaveBeenCalled()
    expect(mocks.islemGecmisiCreate).not.toHaveBeenCalled()
  })
})
