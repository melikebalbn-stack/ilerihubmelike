/**
 * is-basla route davranış testi (entegrasyon — gerçek dev DB, HTTP'siz).
 * requireKiosk MOCK'lu (sinyalsiz MM63 bağlı; DB kiosk kaydına dokunmaz).
 * DB bağımlılığı: dev DB'de MM63 (sinyalsiz tezgah) + aktif+sicilli personel seed'i gerekir.
 * Test satırları sonda temizlenir; KIOSK-TEST'e dokunulmaz.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo' // sinyalsiz tezgah (aktif pin yok)
const MM63_KOD = 'MM63'
// Sahte personnelId — is-basla personel çözümü YAPMAZ (yalnız session varlığı yeter).
// Dosyaya özel id'ler → paralel test dosyalarıyla (personnelId, MM63) session çakışması olmaz.
const P1 = 'test-basla-op-1'
const P2 = 'test-basla-op-2'
const ORDER = 'TEST-ORDER-7250'
const OPNO = 10

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: MM63_ID, kod: MM63_KOD, ad: 'MM63' } }],
    },
    error: null,
  })),
}))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/ipro/kiosk/is-basla/route'

function req(body: unknown): any {
  return { json: async () => body }
}

const createdSessionIds: string[] = []

async function ensureSession(personnelId: string): Promise<string> {
  const s = await prisma.iproOperatorSession.create({
    data: { personnelId, tezgahId: MM63_ID, authMethod: 'LIST' },
    select: { id: true },
  })
  createdSessionIds.push(s.id)
  return s.id
}

beforeAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER, ifsOperationNo: OPNO } })
  await ensureSession(P1)
  await ensureSession(P2)
})

afterAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER, ifsOperationNo: OPNO } })
  for (const id of createdSessionIds) {
    await prisma.iproOperatorSession.updateMany({ where: { id, cikisAt: null }, data: { cikisAt: new Date() } })
  }
  await prisma.$disconnect()
})

describe('is-basla', () => {
  it('sinyalsiz tezgahta başla → 201 ACIK, plcSayacBaslangic null', async () => {
    const res = await POST(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: OPNO, personnelId: P1 }))
    expect(res.status).toBe(201)
    const d = await res.json()
    expect(d.durum).toBe('ACIK')
    expect(d.plcSayacBaslangic).toBeNull()
  })

  it('aynı personnel+order+op tekrar → 409 (partial unique)', async () => {
    const res = await POST(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: OPNO, personnelId: P1 }))
    expect(res.status).toBe(409)
  })

  it('farklı personnelId aynı order+op → AYRI ACIK satır (izin var)', async () => {
    const res = await POST(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: OPNO, personnelId: P2 }))
    expect(res.status).toBe(201)
    const acik = await prisma.iproProductionLog.count({
      where: { ifsOrderNo: ORDER, ifsOperationNo: OPNO, durum: 'ACIK' },
    })
    expect(acik).toBe(2)
  })

  it('aktif oturum yoksa → 400', async () => {
    const res = await POST(req({ tezgahId: MM63_ID, ifsOrderNo: ORDER, ifsOperationNo: 999, personnelId: 'yok-boyle-biri' }))
    expect(res.status).toBe(400)
  })
})
