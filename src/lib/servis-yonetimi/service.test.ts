import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
  transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
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
    $transaction: mocks.transaction,
  },
}))

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
} from './service'

beforeEach(() => {
  vi.clearAllMocks()
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
})

describe('ServisFirma — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.firmaFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.firmaUpdate.mockResolvedValue({ id: '1', aktif: false })
    const data = await pasiflestirServisFirma('1')
    expect(mocks.firmaUpdate).toHaveBeenCalledWith({ where: { id: '1' }, data: { aktif: false } })
    expect(data.aktif).toBe(false)
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
})

describe('ServisYerleske — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: true })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: false })
    const data = await pasiflestirServisYerleske('1')
    expect(data.aktif).toBe(false)
  })

  it('pasif kaydı geri aktifleştirir', async () => {
    mocks.yerleskeFindUnique.mockResolvedValue({ id: '1', aktif: false })
    mocks.yerleskeUpdate.mockResolvedValue({ id: '1', aktif: true })
    const data = await geriAlServisYerleske('1')
    expect(data.aktif).toBe(true)
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
})

describe('ServisGuzergah — passive/restore', () => {
  it('aktif kaydı pasifleştirir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: true })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: false })
    const data = await pasiflestirServisGuzergah('g1')
    expect(data.aktif).toBe(false)
  })

  it('pasif kaydı geri aktifleştirir', async () => {
    mocks.guzergahFindUnique.mockResolvedValue({ id: 'g1', aktif: false })
    mocks.guzergahUpdate.mockResolvedValue({ id: 'g1', aktif: true })
    const data = await geriAlServisGuzergah('g1')
    expect(data.aktif).toBe(true)
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
})

describe('ServisDurak — passive/restore', () => {
  it('aktif durağı pasifleştirir', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: true })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: false })
    const data = await pasiflestirServisDurak('d1')
    expect(data.aktif).toBe(false)
  })

  it('pasif durağı geri aktifleştirir', async () => {
    mocks.durakFindUnique.mockResolvedValue({ id: 'd1', aktif: false })
    mocks.durakUpdate.mockResolvedValue({ id: 'd1', aktif: true })
    const data = await geriAlServisDurak('d1')
    expect(data.aktif).toBe(true)
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
    mocks.aracFindUnique.mockResolvedValue(null)
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
    mocks.aracFindUnique.mockResolvedValue({ id: 'baska', plaka: '41ABC123' })
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: true })
    await expect(createServisArac({ ...gecerliArac, plaka: ' 41 AbC 123 ' })).rejects.toThrow('zaten kullanılıyor')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5])('geçersiz kapasite %s değerini reddeder', async (kapasite) => {
    await expect(createServisArac({ ...gecerliArac, kapasite })).rejects.toThrow('pozitif tam sayı')
    expect(mocks.aracFindUnique).not.toHaveBeenCalled()
  })

  it('pasif firmaya yeni araç bağlamaz', async () => {
    mocks.aracFindUnique.mockResolvedValue(null)
    mocks.firmaFindUnique.mockResolvedValue({ id: 'firma-1', aktif: false })
    await expect(createServisArac(gecerliArac)).rejects.toThrow('Pasif firmaya')
    expect(mocks.aracCreate).not.toHaveBeenCalled()
  })

  it('olmayan firmaya araç bağlamaz', async () => {
    mocks.aracFindUnique.mockResolvedValue(null)
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
})

describe('ServisArac — passive/restore', () => {
  it('aktif aracı pasifleştirir', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: true })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: false })
    const data = await pasiflestirServisArac('a1')
    expect(data.aktif).toBe(false)
  })

  it('pasif aracı geri aktifleştirir', async () => {
    mocks.aracFindUnique.mockResolvedValue({ id: 'a1', aktif: false })
    mocks.aracUpdate.mockResolvedValue({ id: 'a1', aktif: true })
    const data = await geriAlServisArac('a1')
    expect(data.aktif).toBe(true)
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

  it('pasif şoförü geri aktifleştirir', async () => {
    mocks.soforFindUnique.mockResolvedValue({ id: 's1', aktif: false })
    mocks.soforUpdate.mockResolvedValue({ id: 's1', aktif: true })
    expect((await geriAlServisSofor('s1')).aktif).toBe(true)
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
})

describe('ServisSeferDilimi — passive/restore', () => {
  it('aktif dilimi pasifleştirir', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: true })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: false })
    expect((await pasiflestirServisSeferDilimi('sd1')).aktif).toBe(false)
  })

  it('pasif dilimi geri aktifleştirir', async () => {
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'sd1', aktif: false })
    mocks.seferDilimiUpdate.mockResolvedValue({ id: 'sd1', aktif: true })
    expect((await geriAlServisSeferDilimi('sd1')).aktif).toBe(true)
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
    mocks.guzergahDurakFindFirst.mockResolvedValue({ sira: 3 })
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
    mocks.guzergahDurakFindFirst.mockResolvedValue(null)
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
  // Gerçek Prisma findMany'nin döndürdüğü objeler DB'den taze snapshot'tır —
  // sonraki update() çağrıları onları GERİYE DÖNÜP mutasyona uğratmaz. Burada
  // da KLON döndürülür; aksi halde servis kodunun elinde tuttuğu referanslar
  // (secili/komsu) sahte-DB'nin kendi iç Map'iyle paylaşılır ve update()'in
  // Object.assign'ı onları test'in kontrolü dışında mutasyona uğratır — bu,
  // servis kodunda değil, sahte-DB'de yanlış bir "hata" üretir.
  function bul() {
    return [...kayitlar.values()].map((k) => ({ ...k })).sort((a, b) => a.sira - b.sira)
  }
  return { kayitlar, update, bul }
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

describe('ServisGuzergahDurakSaat — kaydet/sil', () => {
  const gecerliSaat = { dilimId: 'dilim-1', saat: '08:30' }

  it('geçerli saati upsert eder', async () => {
    mocks.guzergahDurakFindUnique.mockResolvedValue({ id: 'gd1', aktif: true })
    mocks.seferDilimiFindUnique.mockResolvedValue({ id: 'dilim-1', aktif: true })
    mocks.guzergahDurakSaatUpsert.mockResolvedValue({ id: 's1', ...gecerliSaat })

    await guzergahDurakSaatiKaydet('gd1', gecerliSaat)

    expect(mocks.guzergahDurakSaatUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { guzergahDurakId_dilimId: { guzergahDurakId: 'gd1', dilimId: 'dilim-1' } },
      create: { guzergahDurakId: 'gd1', dilimId: 'dilim-1', saat: '08:30' },
      update: { saat: '08:30' },
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

  it('mevcut saat kaydını siler', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue({ id: 's1' })
    mocks.guzergahDurakSaatDelete.mockResolvedValue({ id: 's1' })
    await guzergahDurakSaatiSil('s1')
    expect(mocks.guzergahDurakSaatDelete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })

  it('olmayan saat kaydını silmez', async () => {
    mocks.guzergahDurakSaatFindUnique.mockResolvedValue(null)
    await expect(guzergahDurakSaatiSil('yok')).rejects.toThrow('bulunamadı')
    expect(mocks.guzergahDurakSaatDelete).not.toHaveBeenCalled()
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
})

describe('ServisGuzergahSoforVarsayilan — pasifleştir/geri-al', () => {
  it('pasifleştirme bitisTarihi ister', async () => {
    mocks.soforVarsayilanFindUnique.mockResolvedValue({ id: 's1', aktif: true, baslangicTarihi: new Date('2026-01-01') })
    await expect(pasiflestirServisGuzergahSoforVarsayilan('s1', '', 'user-1')).rejects.toThrow('Kapatma tarihi zorunludur')
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

  it('zaten aktif kaydı tekrar geri almaz', async () => {
    mocks.sorumluFindUnique.mockResolvedValue({ id: 'sr1', aktif: true })
    await expect(geriAlServisSorumlusu('sr1', 'user-1')).rejects.toThrow('zaten aktif')
  })
})
