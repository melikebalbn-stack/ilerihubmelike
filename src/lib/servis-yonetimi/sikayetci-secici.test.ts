import { describe, expect, it, vi } from 'vitest'
import { sikayetciAra } from './sikayetci-secici'
import type { PrismaClient } from '@/generated/prisma'

function sahtePrisma(donenler: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(donenler)
  return { prisma: { personnel: { findMany } } as unknown as PrismaClient, findMany }
}

describe('sikayetciAra', () => {
  it('1 karakterlik arama DB\'ye HİÇ GİTMEDEN boş dizi döner', async () => {
    const { prisma, findMany } = sahtePrisma()
    const sonuc = await sikayetciAra(prisma, 'a')
    expect(sonuc).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('boş/null arama terimi de DB\'ye gitmez', async () => {
    const { prisma, findMany } = sahtePrisma()
    expect(await sikayetciAra(prisma, '')).toEqual([])
    expect(await sikayetciAra(prisma, null)).toEqual([])
    expect(await sikayetciAra(prisma, undefined)).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('2 karakter ve üzeri arama DB\'ye gider, aktif filtresi ve limit uygulanır', async () => {
    const { prisma, findMany } = sahtePrisma([
      { id: 'p1', adSoyad: 'Ayşe Yılmaz', sicilNo: '111', bolum: 'Montaj' },
    ])
    const sonuc = await sikayetciAra(prisma, 'ay')
    expect(sonuc).toEqual([{ id: 'p1', adSoyad: 'Ayşe Yılmaz', sicilNo: '111', bolum: 'Montaj' }])
    expect(findMany).toHaveBeenCalledTimes(1)
    const cagriArg = findMany.mock.calls[0][0]
    expect(cagriArg.where.aktif).toBe(true)
    expect(cagriArg.take).toBe(20)
  })

  it('🔴 KVKK sınır bekçisi: select TAM OLARAK dört alan, fazlası yok', async () => {
    const { prisma, findMany } = sahtePrisma([])
    await sikayetciAra(prisma, 'ay')
    const cagriArg = findMany.mock.calls[0][0]
    expect(Object.keys(cagriArg.select).sort()).toEqual(['adSoyad', 'bolum', 'id', 'sicilNo'])
    // Yasaklı alanlar select'te hiç yer almamalı.
    for (const yasakli of ['serviceRoute', 'serviceStop', 'telefon', 'ikametAdresi', 'mailAdresi']) {
      expect(cagriArg.select[yasakli]).toBeUndefined()
    }
  })

  it('20 sonuç sınırı uygulanıyor (take:20)', async () => {
    const { prisma, findMany } = sahtePrisma([])
    await sikayetciAra(prisma, 'ahmet')
    expect(findMany.mock.calls[0][0].take).toBe(20)
  })
})
