import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  orgEmployeeFindFirst: vi.fn(),
  orgEmployeeFindUnique: vi.fn(),
  personnelFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    orgEmployee: {
      findFirst: mocks.orgEmployeeFindFirst,
      findUnique: mocks.orgEmployeeFindUnique,
    },
    personnel: { findUnique: mocks.personnelFindUnique },
  },
}))

import { ycktOnaylayanZinciriCoz } from './hiyerarsi-cozumle'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('YCT onaylayan hiyerarşi çözümleyici', () => {
  it('istenen kademe sayısı kadar tam zinciri çözer', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.orgEmployeeFindFirst.mockResolvedValue({ id: 'org-ana', reportsToId: 'org-amir-1' })
    mocks.orgEmployeeFindUnique
      .mockResolvedValueOnce({ id: 'org-amir-1', personnelId: 'personnel-amir-1', reportsToId: 'org-amir-2' })
      .mockResolvedValueOnce({ id: 'org-amir-2', personnelId: 'personnel-amir-2', reportsToId: null })
    mocks.personnelFindUnique
      .mockResolvedValueOnce({ user: { id: 'user-amir-1' } })
      .mockResolvedValueOnce({ user: { id: 'user-amir-2' } })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([
      { adimSira: 1, userId: 'user-amir-1' },
      { adimSira: 2, userId: 'user-amir-2' },
    ])
  })

  it('zincir yarıda koparsa çözülen kısmi sonucu döndürür', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: 'personnel-ana' })
    mocks.orgEmployeeFindFirst.mockResolvedValue({ id: 'org-ana', reportsToId: 'org-amir-1' })
    mocks.orgEmployeeFindUnique.mockResolvedValueOnce({
      id: 'org-amir-1', personnelId: 'personnel-amir-1', reportsToId: null,
    })
    mocks.personnelFindUnique.mockResolvedValueOnce({ user: { id: 'user-amir-1' } })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 3)).resolves.toEqual([
      { adimSira: 1, userId: 'user-amir-1' },
    ])
  })

  it('ana sorumlunun Personnel bağlantısı yoksa boş sonuç döndürür', async () => {
    mocks.userFindUnique.mockResolvedValue({ personnelId: null })

    await expect(ycktOnaylayanZinciriCoz('user-ana', 2)).resolves.toEqual([])
    expect(mocks.orgEmployeeFindFirst).not.toHaveBeenCalled()
  })

  it('kademeSayisi sıfırsa veritabanına gitmeden boş sonuç döndürür', async () => {
    await expect(ycktOnaylayanZinciriCoz('user-ana', 0)).resolves.toEqual([])
    expect(mocks.userFindUnique).not.toHaveBeenCalled()
  })
})
