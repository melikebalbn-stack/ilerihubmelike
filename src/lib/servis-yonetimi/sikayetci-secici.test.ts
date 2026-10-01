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

// ---------------------------------------------------------------------------
// Gerçek karakterlerle uçtan uca filtre davranışı.
//
// Mock findMany, Prisma `where` ağacını GERÇEKTEN uygular (aktif + OR[contains,
// mode:'insensitive']); böylece test "findMany çağrıldı" değil "filtre sonucu
// süzdü" der. `mode:'insensitive'` PostgreSQL ILIKE'dır ve Türkçe I/İ/ı için
// tr kuralıyla çalışmaz: dev DB'de ölçüldü —
//   'IŞIK' ILIKE 'ışık' = false, 'Şahin' ILIKE 'ŞAHİN' = true (lower('İ') = 'i').
// Emülasyon bu iki davranışı birebir taklit eder; İ→i için birleşik nokta
// (U+0307) atılır.
// ---------------------------------------------------------------------------
type Kayit = { id: string; adSoyad: string; sicilNo: string | null; bolum: string | null; aktif: boolean }
type Kosul = { adSoyad?: { contains: string }; sicilNo?: { contains: string } }

const pgKucuk = (s: string) => s.toLocaleLowerCase('en-US').replace(/\u0307/g, '')
const pgIlike = (deger: string | null, parca: string) => deger !== null && pgKucuk(deger).includes(pgKucuk(parca))

const KAYITLAR: Kayit[] = [
  { id: 'p-elif', adSoyad: 'Elif Demir', sicilNo: 'S-100', bolum: 'Montaj', aktif: true },
  { id: 'p-isik', adSoyad: 'IŞIK Kaya', sicilNo: 'S-200', bolum: 'Boya', aktif: true },
  { id: 'p-sahin', adSoyad: 'Şahin Aydın', sicilNo: 'S-300', bolum: 'Kalite', aktif: true },
  { id: 'p-pasif', adSoyad: 'Elif Pasif', sicilNo: 'S-400', bolum: 'Montaj', aktif: false },
]

function filtreleyenPrisma() {
  const findMany = vi.fn(async (arg: { where: { aktif: boolean; OR: Kosul[] } }) =>
    KAYITLAR.filter(
      (k) =>
        k.aktif === arg.where.aktif &&
        arg.where.OR.some(
          (o) =>
            (o.adSoyad !== undefined && pgIlike(k.adSoyad, o.adSoyad.contains)) ||
            (o.sicilNo !== undefined && pgIlike(k.sicilNo, o.sicilNo.contains)),
        ),
    ).map(({ id, adSoyad, sicilNo, bolum }) => ({ id, adSoyad, sicilNo, bolum })),
  )
  return { prisma: { personnel: { findMany } } as unknown as PrismaClient }
}

describe('sikayetciAra — gerçek Türkçe karakterlerle filtre sonucu', () => {
  it.each([
    ['ELİF', 'p-elif'],
    ['elif', 'p-elif'],
    ['ışık', 'p-isik'],
    ['IŞIK', 'p-isik'],
    ['ŞAHİN', 'p-sahin'],
    ['şahin', 'p-sahin'],
    ['s-300', 'p-sahin'],
    ['S-200', 'p-isik'],
  ])('"%s" araması yalnız %s kaydını döndürür', async (terim, beklenenId) => {
    const { prisma } = filtreleyenPrisma()
    const sonuc = await sikayetciAra(prisma, terim)
    expect(sonuc.map((s) => s.id)).toEqual([beklenenId])
  })

  it('"ELİF" araması Elif kaydının adSoyad/sicilNo/bolum alanlarını olduğu gibi döndürür', async () => {
    const { prisma } = filtreleyenPrisma()
    expect(await sikayetciAra(prisma, 'ELİF')).toEqual([
      { id: 'p-elif', adSoyad: 'Elif Demir', sicilNo: 'S-100', bolum: 'Montaj' },
    ])
  })

  it('pasif personel hiçbir terimle dönmez (aktif filtresi sonucu süzer)', async () => {
    const { prisma } = filtreleyenPrisma()
    expect((await sikayetciAra(prisma, 'pasif')).length).toBe(0)
  })

  it('eşleşmeyen terim boş dizi döner (hata değil)', async () => {
    const { prisma } = filtreleyenPrisma()
    expect(await sikayetciAra(prisma, 'olmayanisim')).toEqual([])
  })
})
