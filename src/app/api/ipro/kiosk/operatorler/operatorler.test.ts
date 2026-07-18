/**
 * Kiosk operatorler + acik-is + hurda-sebepleri endpoint testleri (integration — gerçek dev DB).
 * requireKiosk MOCK'lu (KIOSK-TEST tezgahları). DB bağımlılığı: MM63 + KIOSK-TEST seed.
 * Test satırları temizlenir; KIOSK-TEST'e dokunulmaz.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const DIS_TEZGAH = 'cmrl3of9q001nybpecfj0rhf2' // DT08 — kiosk'a bağlı DEĞİL

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: MM63_ID, kod: 'MM63', ad: 'MM63' } }],
    },
    error: null,
  })),
}))

import { prisma } from '@/lib/prisma'
import { GET as operatorlerGET } from '@/app/api/ipro/kiosk/operatorler/route'
import { GET as acikIsGET } from '@/app/api/ipro/kiosk/acik-is/route'
import { GET as hurdaGET } from '@/app/api/ipro/kiosk/hurda-sebepleri/route'

function req(params: Record<string, string>): any {
  const u = new URL('http://x/api')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return { nextUrl: u }
}

const PFAKE = 'fake-operatorler-test'
const ORDER = 'TEST-OPLIST-9300'
let sessionId = ''
let opTezgahId = ''
let logId = ''

beforeAll(async () => {
  // Testin en az 1 operatör görmesi gerek. MM63'te KALICI eşleme olabilir (dev seed) —
  // o yüzden zaten eşli olmayan bir personel seç ve YALNIZ kendi eklediğimizi temizle.
  const mevcut = await prisma.iproOperatorTezgah.findMany({
    where: { tezgahId: MM63_ID },
    select: { personnelId: true },
  })
  const haricIds = mevcut.map((m) => m.personnelId)
  const p = await prisma.personnel.findFirst({
    where: { aktif: true, sicilNo: { not: null }, id: { notIn: haricIds } },
    select: { id: true },
  })
  if (p) {
    const ot = await prisma.iproOperatorTezgah.create({
      data: { personnelId: p.id, tezgahId: MM63_ID, aktif: true, kaynak: 'TEST' },
      select: { id: true },
    })
    opTezgahId = ot.id // yalnız bunu sileceğiz
  }
  // p yoksa: MM63'te zaten eşleme var demektir, test yine geçerli (liste boş olmaz).

  const s = await prisma.iproOperatorSession.create({
    data: { personnelId: PFAKE, tezgahId: MM63_ID, authMethod: 'LIST' }, select: { id: true },
  })
  sessionId = s.id
  const log = await prisma.iproProductionLog.create({
    data: {
      tezgahId: MM63_ID, sessionId, personnelId: PFAKE,
      ifsOrderNo: ORDER, ifsOperationNo: 5, qtyComplete: 0, qtyScrap: 0,
      durum: 'ACIK', baslatildiAt: new Date(),
    },
    select: { id: true },
  })
  logId = log.id
})

afterAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { id: logId } })
  // YALNIZ testin eklediği eşlemeyi sil (kalıcı seed eşlemelerine dokunma).
  if (opTezgahId) await prisma.iproOperatorTezgah.deleteMany({ where: { id: opTezgahId } })
  await prisma.iproOperatorSession.updateMany({ where: { id: sessionId, cikisAt: null }, data: { cikisAt: new Date() } })
  await prisma.$disconnect()
})

describe('kiosk operatorler', () => {
  it('tezgaha bağlı operatörler listelenir (en az 1)', async () => {
    const res = await operatorlerGET(req({ tezgahId: MM63_ID }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(Array.isArray(d.operatorler)).toBe(true)
    expect(d.operatorler.length).toBeGreaterThanOrEqual(1)
    expect(d.operatorler[0]).toHaveProperty('adSoyad')
  })

  it('tezgahId yok → 400', async () => {
    const res = await operatorlerGET(req({}))
    expect(res.status).toBe(400)
  })

  it('bağlı OLMAYAN tezgah → 403', async () => {
    const res = await operatorlerGET(req({ tezgahId: DIS_TEZGAH }))
    expect(res.status).toBe(403)
  })
})

describe('kiosk acik-is', () => {
  it('ACIK iş varsa döner', async () => {
    const res = await acikIsGET(req({ tezgahId: MM63_ID, personnelId: PFAKE }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.acik?.ifsOrderNo).toBe(ORDER)
  })

  it('ACIK iş yoksa null', async () => {
    const res = await acikIsGET(req({ tezgahId: MM63_ID, personnelId: 'baska-kimse' }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.acik).toBeNull()
  })
})

describe('kiosk hurda-sebepleri', () => {
  it('aktif sebepler listelenir (kod+ad)', async () => {
    const res = await hurdaGET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(Array.isArray(d.sebepler)).toBe(true)
    expect(d.sebepler.length).toBeGreaterThan(0)
    expect(d.sebepler[0]).toHaveProperty('kod')
    expect(d.sebepler[0]).toHaveProperty('ad')
  })
})
