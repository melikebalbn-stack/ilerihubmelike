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
  },
}))

import {
  createServisFirma,
  createServisArac,
  createServisDurak,
  createServisGuzergah,
  createServisYerleske,
  geriAlServisFirma,
  geriAlServisArac,
  geriAlServisDurak,
  geriAlServisGuzergah,
  geriAlServisYerleske,
  listServisFirmalar,
  listServisAraclar,
  listServisDuraklar,
  listServisGuzergahlar,
  listServisYerleskeler,
  pasiflestirServisFirma,
  pasiflestirServisArac,
  pasiflestirServisDurak,
  pasiflestirServisGuzergah,
  pasiflestirServisYerleske,
  updateServisFirma,
  updateServisArac,
  updateServisDurak,
  updateServisGuzergah,
  updateServisYerleske,
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
