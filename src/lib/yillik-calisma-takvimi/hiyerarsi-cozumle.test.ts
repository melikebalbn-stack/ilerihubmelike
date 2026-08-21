import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  personnelFindUnique: vi.fn(),
  amirCozumle: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    personnel: { findUnique: mocks.personnelFindUnique },
  },
}))

vi.mock('@/lib/is-analizi/amir-cozumle', () => ({
  amirCozumle: (...args: unknown[]) => mocks.amirCozumle(...args),
}))

import { ycktOnaylayanZinciriCoz } from './hiyerarsi-cozumle'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('YCT onaylayan hiyerarşi çözümleyici', () => {
  it('istenen kademe sayısı kadar tam zinciri çözer', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.amirCozumle
      .mockResolvedValueOnce({ amirPersonnelId: 'personnel-amir-1', kaynak: 'ORG', guvenilir: true })
      .mockResolvedValueOnce({ amirPersonnelId: 'personnel-amir-2', kaynak: 'ORG', guvenilir: true })
    mocks.personnelFindUnique
      .mockResolvedValueOnce({ user: { id: 'user-amir-1' } })
      .mockResolvedValueOnce({ user: { id: 'user-amir-2' } })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([
      { adimSira: 1, userId: 'user-amir-1' },
      { adimSira: 2, userId: 'user-amir-2' },
    ])
    expect(mocks.amirCozumle).toHaveBeenNthCalledWith(1, 'personnel-ana')
    expect(mocks.amirCozumle).toHaveBeenNthCalledWith(2, 'personnel-amir-1')
  })

  it('zincir yarıda koparsa çözülen kısmi sonucu döndürür', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.amirCozumle
      .mockResolvedValueOnce({ amirPersonnelId: 'personnel-amir-1', kaynak: 'ORG', guvenilir: true })
      .mockResolvedValueOnce({ amirPersonnelId: null, kaynak: null, guvenilir: false })
    mocks.personnelFindUnique.mockResolvedValueOnce({ user: { id: 'user-amir-1' } })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 3)).resolves.toEqual([
      { adimSira: 1, userId: 'user-amir-1' },
    ])
  })

  it('ana sorumlunun Personnel bağlantısı yoksa boş sonuç döndürür', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: null })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
    expect(mocks.amirCozumle).not.toHaveBeenCalled()
  })

  it('kademeSayisi sıfırsa veritabanına gitmeden boş sonuç döndürür', async () => {
    await expect(ycktOnaylayanZinciriCoz('user-ana', 0)).resolves.toEqual([])
    expect(mocks.userFindUnique).not.toHaveBeenCalled()
  })

  it('ortak çözümleyici amir bulamazsa hata vermeden boş sonuç döndürür', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'koltuksuz-personnel' })
    mocks.amirCozumle.mockResolvedValue({ amirPersonnelId: null, kaynak: null, guvenilir: false })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  it('koltuksuz personelde isim fallback sonucunu onay zincirine almaz', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'koltuksuz-personnel' })
    mocks.amirCozumle.mockResolvedValue({ amirPersonnelId: 'isimden-amir', kaynak: 'ISIM', guvenilir: true })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  it('öz-referans veya çevrim dönerse aynı kişiyi onaylayan yapmaz', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.amirCozumle.mockResolvedValue({ amirPersonnelId: 'personnel-ana', kaynak: 'ORG', guvenilir: true })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
    expect(mocks.personnelFindUnique).not.toHaveBeenCalled()
  })

  it('amir Personnel kaydının User bağlantısı yoksa zinciri güvenle keser', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.amirCozumle.mockResolvedValue({ amirPersonnelId: 'personnel-amir', kaynak: 'ORG', guvenilir: true })
    mocks.personnelFindUnique.mockResolvedValue({ user: null })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
  })
})
