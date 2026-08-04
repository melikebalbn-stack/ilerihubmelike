/**
 * gozlemleriTopla — çakışma guard DB davranışı (entegrasyon, gerçek dev DB, MM63).
 * Ayrık iş → gözlem sayılır; aynı tezgahta zaman-örtüşen işler → İKİSİ de dışlanır.
 * Uzak 2030 zaman aralığı kullanılır (gerçek/diğer test verisiyle örtüşme olmasın).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { gozlemleriTopla } from './ideal-cevrim'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const MM63_KOD = 'MM63'
const PART = 'TEST-OEE-PART-GUARD'
const ORDER = 'TEST-OEE-GUARD-9300'
const P1 = 'test-oee-guard-op'

// 2030 aralığı — gerçek veriyle örtüşmez.
const A_BAS = new Date('2030-01-01T00:00:00Z')
const A_BIT = new Date('2030-01-01T00:01:40Z') // +100 sn
const B_BAS = new Date('2030-01-01T01:00:00Z')
const B_BIT = new Date('2030-01-01T01:05:00Z') // +300 sn (B ve C örtüşür)
const C_BAS = new Date('2030-01-01T01:04:00Z')
const C_BIT = new Date('2030-01-01T01:09:00Z')

let sessionId = ''

async function kapaliLog(op: number, bas: Date, bit: Date) {
  return prisma.iproProductionLog.create({
    data: {
      tezgahId: MM63_ID, sessionId, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: op,
      ifsPartNo: PART, durum: 'KAPALI', tamamlandi: true, baslatildiAt: bas, bitirildiAt: bit,
      qtyComplete: 0, qtyScrap: 0, uretimAdet: 50, hesapKaynagi: 'DELTA',
    },
    select: { id: true },
  })
}

async function sayac(ts: Date, delta: number) {
  await prisma.iproSayacOkuma.create({ data: { tezgahKod: MM63_KOD, delta, mutlakSayac: BigInt(0), ts } })
}

async function temizle() {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  await prisma.iproSayacOkuma.deleteMany({ where: { tezgahKod: MM63_KOD, ts: { gte: A_BAS, lte: C_BIT } } })
}

beforeAll(async () => {
  await temizle()
  const s = await prisma.iproOperatorSession.create({ data: { personnelId: P1, tezgahId: MM63_ID, authMethod: 'LIST' }, select: { id: true } })
  sessionId = s.id
  await kapaliLog(10, A_BAS, A_BIT) // ayrık
  await kapaliLog(20, B_BAS, B_BIT) // B — C ile örtüşür
  await kapaliLog(30, C_BAS, C_BIT) // C — B ile örtüşür
  // A penceresinde 2 okuma (Σ=30); B ve C pencerelerine de okuma koy (dışlanacaklar)
  await sayac(new Date('2030-01-01T00:00:30Z'), 10)
  await sayac(new Date('2030-01-01T00:01:00Z'), 20)
  await sayac(new Date('2030-01-01T01:02:00Z'), 99) // B penceresi
  await sayac(new Date('2030-01-01T01:06:00Z'), 99) // C penceresi
})

afterAll(async () => {
  await temizle()
  await prisma.iproOperatorSession.updateMany({ where: { id: sessionId, cikisAt: null }, data: { cikisAt: new Date() } })
  await prisma.$disconnect()
})

describe('gozlemleriTopla — çakışma guard', () => {
  it('yalnız ayrık iş (A) gözlem olur; örtüşen B & C dışlanır', async () => {
    const gozlemler = await gozlemleriTopla(prisma, MM63_KOD, PART)
    expect(gozlemler).toHaveLength(1)
    expect(gozlemler[0].pencereSn).toBe(100) // A penceresi 100 sn
    expect(gozlemler[0].toplamDelta).toBe(30) // A penceresindeki Σ delta (10+20)
  })
})
