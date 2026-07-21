/**
 * Operatör değiştir testleri (integration — gerçek dev DB, HTTP'siz).
 * requireKiosk MOCK'lu. Kendi tezgah + sebep + oturum/iş/duruş fixture'ı kurar,
 * afterAll'da temizler.
 *
 * Kural: AÇIK İŞ varken 409 (engel); açık DURUŞ (tezgah-seviyesi) → serbest,
 * duruş sürer, operatör oturumu kapanır.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const KOD = 'ODG-TEST-TZ'
let tezgahId = ''
let sebepId = ''
const P_ISLI = 'odg-op-isli' // açık işi olan operatör
const P_DURUS = 'odg-op-durus' // sadece duruş bağlamındaki operatör

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: tezgahId, kod: KOD, ad: 'ODG Test' } }],
    },
    error: null,
  })),
}))

import { prisma } from '@/lib/prisma'
import { POST as OPERATOR_DEGISTIR } from '@/app/api/ipro/kiosk/operator-degistir/route'

function req(body: unknown): any {
  return { json: async () => body }
}

const sessionIds: string[] = []

beforeAll(async () => {
  const t = await prisma.iproTezgah.create({ data: { kod: KOD, ad: 'ODG Test', aktif: true }, select: { id: true } })
  tezgahId = t.id
  const s = await prisma.iproDurusSebebi.create({
    data: { kod: 'ODG-SEBEP', ad: 'ODG', bitisTipi: 'MANUEL', aktif: true, uretimdeGosterilsin: true },
    select: { id: true },
  })
  sebepId = s.id
})

afterAll(async () => {
  await prisma.iproMachineDowntime.deleteMany({ where: { tezgahId } })
  await prisma.iproProductionLog.deleteMany({ where: { tezgahId } })
  if (sessionIds.length) await prisma.iproOperatorSession.deleteMany({ where: { id: { in: sessionIds } } })
  await prisma.iproDurusSebebi.deleteMany({ where: { id: sebepId } })
  await prisma.iproTezgah.deleteMany({ where: { id: tezgahId } })
  await prisma.$disconnect()
})

async function oturumAc(personnelId: string): Promise<string> {
  const s = await prisma.iproOperatorSession.create({
    data: { personnelId, tezgahId, authMethod: 'LIST' },
    select: { id: true },
  })
  sessionIds.push(s.id)
  return s.id
}

describe('operator-degistir', () => {
  it('AÇIK İŞ varken → 409, oturum KAPANMAZ', async () => {
    const sid = await oturumAc(P_ISLI)
    await prisma.iproProductionLog.create({
      data: { tezgahId, sessionId: sid, personnelId: P_ISLI, durum: 'ACIK', baslatildiAt: new Date() },
    })
    const res = await OPERATOR_DEGISTIR(req({ tezgahId, personnelId: P_ISLI }))
    expect(res.status).toBe(409)
    // oturum hâlâ açık (değişim engellendi)
    const s = await prisma.iproOperatorSession.findUnique({ where: { id: sid }, select: { cikisAt: true } })
    expect(s?.cikisAt).toBeNull()
  })

  it('açık DURUŞ varken (açık iş YOK) → 200, oturum kapanır, DURUŞ SÜRER', async () => {
    const sid = await oturumAc(P_DURUS)
    // Tezgah-seviyesi açık duruş (bitis null). Bu operatörden farklı biri başlatmış olabilir.
    await prisma.iproMachineDowntime.create({
      data: { tezgahId, personnelId: 'baska-operator', durusSebebiId: sebepId, baslangic: new Date(), kaynak: 'KIOSK' },
    })
    const res = await OPERATOR_DEGISTIR(req({ tezgahId, personnelId: P_DURUS }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    // operatör oturumu kapandı
    const s = await prisma.iproOperatorSession.findUnique({ where: { id: sid }, select: { cikisAt: true } })
    expect(s?.cikisAt).not.toBeNull()
    // duruş HÂLÂ açık — operatör değişimi duruşu bozmadı
    const acikDurus = await prisma.iproMachineDowntime.count({ where: { tezgahId, bitis: null } })
    expect(acikDurus).toBe(1)
  })

  it('açık iş de duruş da yoksa → 200 (serbest)', async () => {
    const sid = await oturumAc('odg-op-bos')
    const res = await OPERATOR_DEGISTIR(req({ tezgahId, personnelId: 'odg-op-bos' }))
    expect(res.status).toBe(200)
    const s = await prisma.iproOperatorSession.findUnique({ where: { id: sid }, select: { cikisAt: true } })
    expect(s?.cikisAt).not.toBeNull()
  })

  it('tezgah kiosk’a bağlı değilse → 403', async () => {
    const res = await OPERATOR_DEGISTIR(req({ tezgahId: 'baska-tezgah', personnelId: P_ISLI }))
    expect(res.status).toBe(403)
  })
})
