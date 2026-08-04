/**
 * KRİTİK: OEE hesabı hata fırlatırsa is-bitir YİNE başarılı (200) olmalı — OEE bloklamaz.
 * oeeKaydiHesaplaVeYaz mock'lu → koşulsuz throw. Route'un try/catch'i yutmalı.
 * (entegrasyon — gerçek dev DB, MM63 sinyalsiz; requireKiosk + IFS sınırı mock'lu.)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const MM63_KOD = 'MM63'
const P1 = 'test-oee-blok-op-1'
const ORDER = 'TEST-OEE-BLOK-8200'

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
  reportQuantityComplete: vi.fn(async () => { throw new Error('IFS test: ulaşılmamalı') }),
}))
// OEE motoru KOŞULSUZ throw eder — route'un bloklamama garantisini kanıtlar.
const oeeMock = vi.fn(async () => { throw new Error('OEE test: kasıtlı hata') })
vi.mock('@/lib/ipro/oee-hesap', () => ({
  oeeKaydiHesaplaVeYaz: (...a: unknown[]) => (oeeMock as (...x: unknown[]) => Promise<void>)(...a),
}))

import { prisma } from '@/lib/prisma'
import { POST as basla } from '@/app/api/ipro/kiosk/is-basla/route'
import { POST as bitir } from '@/app/api/ipro/kiosk/is-bitir/route'

function req(body: unknown): any {
  return { json: async () => body }
}

const createdSessionIds: string[] = []

beforeAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  const s = await prisma.iproOperatorSession.create({
    data: { personnelId: P1, tezgahId: MM63_ID, authMethod: 'LIST' },
    select: { id: true },
  })
  createdSessionIds.push(s.id)
})

afterAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  for (const id of createdSessionIds) {
    await prisma.iproOperatorSession.updateMany({ where: { id, cikisAt: null }, data: { cikisAt: new Date() } })
  }
  await prisma.$disconnect()
})

describe('is-bitir — OEE bloklamama', () => {
  it('OEE throw etse bile is-bitir 200 + iş KAPALI (hata yutulur, çağrı yapıldı)', async () => {
    const r = await basla(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: 10, personnelId: P1 }))
    expect(r.status).toBe(201)

    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 10, iyi: 20, hurda: 0, tamamlandi: true }))
    expect(res.status).toBe(200) // OEE hatası is-bitir'i 500 YAPMADI
    const d = await res.json()
    expect(d.durum).toBe('KAPALI')
    expect(d.qtyComplete).toBe(20)
    expect(oeeMock).toHaveBeenCalledTimes(1) // OEE çağrısı gerçekten yapıldı (ve yutuldu)
  })
})
