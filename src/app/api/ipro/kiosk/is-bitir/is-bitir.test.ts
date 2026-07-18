/**
 * is-bitir route davranış testi (entegrasyon — gerçek dev DB, HTTP'siz).
 * requireKiosk + IFS sınırı (config/shop-floor) MOCK'lu → server-only yüklenmez, gerçek IFS'e gidilmez.
 * DB bağımlılığı: dev DB'de MM63 (sinyalsiz) + aktif+sicilli personel (P1) seed'i gerekir.
 * is-basla ile ACIK açar, is-bitir ile kapatır. Test satırları sonda temizlenir; KIOSK-TEST'e dokunulmaz.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo' // sinyalsiz
const MM63_KOD = 'MM63'
// Sahte personnelId — is-bitir close-session mantığı sicilNo'ya bağlı DEĞİL (birKaydiIfseYaz
// 'Sicil yok' döner, endpoint yine 200). Dosyaya özel id → paralel session çakışması olmaz.
const P1 = 'test-bitir-op-1'
const ORDER = 'TEST-BITIR-8100'

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: MM63_ID, kod: MM63_KOD, ad: 'MM63' } }],
    },
    error: null,
  })),
}))
// IFS sınırı — server-only yüklenmesin + gerçek IFS'e gidilmesin (bitir hibrit denemesi).
vi.mock('@/lib/ifs/config', () => ({
  getIfsConfig: () => ({ baseUrl: 'x', tokenUrl: 'x', clientId: 'x', clientSecret: 'x', contract: 'ILER2', company: 'ILERI2' }),
}))
vi.mock('@/lib/ifs/shop-floor', () => ({
  reportQuantityComplete: vi.fn(async () => { throw new Error('IFS test: ulaşılmamalı') }),
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

async function baslat(op: number) {
  const r = await basla(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: op, personnelId: P1 }))
  expect(r.status).toBe(201)
}

describe('is-bitir', () => {
  it('bitir: sinyalsiz iyi=50 hurda=0 tamamlandi=true → KAPALI, qtyComplete=50, plcSayacBitis=null', async () => {
    await baslat(10)
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 10, iyi: 50, hurda: 0, tamamlandi: true }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.durum).toBe('KAPALI')
    expect(d.qtyComplete).toBe(50)
    const row = await prisma.iproProductionLog.findUnique({ where: { id: d.id }, select: { plcSayacBitis: true, qtyComplete: true } })
    expect(row?.plcSayacBitis).toBeNull()
    expect(row?.qtyComplete).toBe(50)
  })

  it('hurda>0 && hurdaSebebiKod=null → 400', async () => {
    await baslat(20)
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 20, iyi: 10, hurda: 5, tamamlandi: true, hurdaSebebiKod: null }))
    expect(res.status).toBe(400)
    const acik = await prisma.iproProductionLog.count({ where: { ifsOrderNo: ORDER, ifsOperationNo: 20, durum: 'ACIK' } })
    expect(acik).toBe(1)
  })

  it('durdur: iyi=30 tamamlandi=false → KAPALI + tamamlandi=false', async () => {
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 20, iyi: 30, hurda: 0, tamamlandi: false }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.durum).toBe('KAPALI')
    expect(d.tamamlandi).toBe(false)
    expect(d.qtyComplete).toBe(30)
  })

  it('kapalı satırı tekrar bitir → 404', async () => {
    const res = await bitir(req({ tezgahId: MM63_ID, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 10, iyi: 5, hurda: 0, tamamlandi: true }))
    expect(res.status).toBe(404)
  })

  it('aynı operatör+iş+op yeniden başla → 201 (KAPALI olduğu için partial unique serbest)', async () => {
    const res = await basla(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: 10, personnelId: P1 }))
    expect(res.status).toBe(201)
  })
})
