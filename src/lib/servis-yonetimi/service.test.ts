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
  },
}))

import {
  createServisFirma,
  createServisYerleske,
  geriAlServisFirma,
  geriAlServisYerleske,
  listServisFirmalar,
  listServisYerleskeler,
  pasiflestirServisFirma,
  pasiflestirServisYerleske,
  updateServisFirma,
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
