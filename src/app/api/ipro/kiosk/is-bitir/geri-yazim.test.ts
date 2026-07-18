/**
 * bitir + birKaydiIfseYaz hibrit deneme davranış testi (entegrasyon — gerçek dev DB, HTTP'siz).
 * IFS sınırı MOCK'lu (config+shop-floor → server-only yüklenmez, gerçek IFS'e ULAŞILMAZ).
 * reportQuantityComplete mock'u throw eder = IFS başarısızlığı simülasyonu.
 * DB bağımlılığı: dev DB'de MM63 (sinyalsiz) + P1 (sicilNo dolu) seed'i gerekir.
 * Test satırları sonda SİLİNİR; KIOSK-TEST'e dokunulmaz.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const MM63_KOD = 'MM63'
const P1 = 'cmqm7al890000pbpeviggottj' // ILR-00207 (sicilNo dolu)
const PFAKE = 'fake-no-sicil-test-9200' // Personnel'de YOK → sicilNo çözülemez
const ORDER = 'TEST-GERIYAZIM-9200'

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: MM63_ID, kod: MM63_KOD, ad: 'MM63' } }],
    },
    error: null,
  })),
}))
vi.mock('@/lib/ifs/config', () => ({
  getIfsConfig: () => ({ baseUrl: 'x', tokenUrl: 'x', clientId: 'x', clientSecret: 'x', contract: 'ILER2', company: 'ILERI2' }),
}))
vi.mock('@/lib/ifs/shop-floor', () => ({
  reportQuantityComplete: vi.fn(async () => { throw new Error('IFS test: reportQuantityComplete simüle hata') }),
}))

import { prisma } from '@/lib/prisma'
import { POST as basla } from '@/app/api/ipro/kiosk/is-basla/route'
import { POST as bitir } from '@/app/api/ipro/kiosk/is-bitir/route'

function req(body: unknown): any {
  return { json: async () => body }
}

const createdSessionIds: string[] = []

async function sessionAc(personnelId: string) {
  const s = await prisma.iproOperatorSession.create({
    data: { personnelId, tezgahId: MM63_ID, authMethod: 'LIST' },
    select: { id: true },
  })
  createdSessionIds.push(s.id)
}

beforeAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  await sessionAc(P1)
  await sessionAc(PFAKE)
})

afterAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  for (const id of createdSessionIds) {
    await prisma.iproOperatorSession.updateMany({ where: { id, cikisAt: null }, data: { cikisAt: new Date() } })
  }
  await prisma.$disconnect()
})

async function baslat(personnelId: string, op: number) {
  const r = await basla(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: op, personnelId }))
  expect(r.status).toBe(201)
}

describe('bitir + IFS geri-yazım (hibrit)', () => {
  it('A) sicilNo yok → 200, ifsCompleteYazildi=false, ifsCompleteHata "Sicil...", IFS çağrısı YOK', async () => {
    await baslat(PFAKE, 10)
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: PFAKE, ifsOrderNo: ORDER, ifsOperationNo: 10, iyi: 5, hurda: 0, tamamlandi: true }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.durum).toBe('KAPALI')
    expect(d.ifs).toBe('kuyrukta')
    const row = await prisma.iproProductionLog.findUnique({
      where: { id: d.id },
      select: { ifsCompleteYazildi: true, ifsCompleteHata: true },
    })
    expect(row?.ifsCompleteYazildi).toBe(false)
    expect(row?.ifsCompleteHata ?? '').toMatch(/Sicil/i)
  })

  it('B) qtyComplete=0 (iyi=0 hurda=5) → complete atlanır, ifsCompleteYazildi=true', async () => {
    await baslat(P1, 20)
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 20, iyi: 0, hurda: 5, tamamlandi: true, hurdaSebebiKod: '01' }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ifs).toBe('yazıldı')
    const row = await prisma.iproProductionLog.findUnique({
      where: { id: d.id },
      select: { ifsCompleteYazildi: true, qtyComplete: true, qtyScrap: true },
    })
    expect(row?.ifsCompleteYazildi).toBe(true)
    expect(row?.qtyComplete).toBe(0)
    expect(row?.qtyScrap).toBe(5)
  })

  it('C) IFS denemesi başarısız (reportQuantityComplete throw) olsa bile endpoint 200', async () => {
    await baslat(P1, 30)
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 30, iyi: 10, hurda: 0, tamamlandi: true }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.durum).toBe('KAPALI')
    expect(d.ifs).toBe('kuyrukta')
    const row = await prisma.iproProductionLog.findUnique({
      where: { id: d.id },
      select: { ifsCompleteYazildi: true, ifsCompleteHata: true },
    })
    expect(row?.ifsCompleteYazildi).toBe(false)
    expect(row?.ifsCompleteHata ?? '').toMatch(/simüle hata/i)
  })
})
