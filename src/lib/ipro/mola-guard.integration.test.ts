/**
 * ÇİFT DÜŞÜM ENGELİ PARİTESİ (entegrasyon, dev DB) — aynı senaryoda canlı yol (tezgahlarinCanliOee)
 * ile kapalı yol (oeeKaydiHesaplaVeYaz → IproOeeKaydi) AYNI availability'yi vermeli. İkisi de mola
 * düşümünü + molaDurusDuzeltmeSaniye guard'ını paylaşır (oee-canli.ts'e dokunulmadan çağıran tarafta).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { oeeKaydiHesaplaVeYaz } from './oee-hesap'
import { tezgahlarinCanliOee } from './oee-pano-service'

const V_KOD = 'TEST-MOLA-V'
const TZ_KOD = 'TEST-MOLA-TZ'
const BOLUM = 'TEST-MOLA-B'
const SEB_PLANLI = 'TEST-MOLA-SEB-P'
const SEB_PLANSIZ = 'TEST-MOLA-SEB-U'
// Pazartesi 2026-09-21. Vardiya 07:00–17:00 yerel (04:00–14:00Z). İş penceresi 06:00–15:00Z.
const BAS = new Date('2026-09-21T06:00:00Z')
const BIT = new Date('2026-09-21T15:00:00Z')

let tezgahId = ''
let vardiyaId = ''
let sebepPlanliId = ''
let sebepPlansizId = ''
let sessionId = ''
let logId = ''
const durusIds: string[] = []
let molaId = ''

beforeAll(async () => {
  const v = await prisma.iproVardiya.create({ data: { kod: V_KOD, ad: 'Test Mola Vardiya', baslangicSaat: '07:00', bitisSaat: '17:00', ertesiGuneTasar: false }, select: { id: true } })
  vardiyaId = v.id
  const tz = await prisma.iproTezgah.create({ data: { kod: TZ_KOD, ad: 'Test Mola Tezgah', masGrupKodu: BOLUM }, select: { id: true } })
  tezgahId = tz.id
  const sp = await prisma.iproDurusSebebi.create({ data: { kod: SEB_PLANLI, ad: 'Test Planlı Mola', bitisTipi: 'Both', planli: true }, select: { id: true } })
  sebepPlanliId = sp.id
  const su = await prisma.iproDurusSebebi.create({ data: { kod: SEB_PLANSIZ, ad: 'Test Plansız', bitisTipi: 'Both', planli: false }, select: { id: true } })
  sebepPlansizId = su.id
  const m = await prisma.iproMolaTanim.create({ data: { vardiyaId, bolum: BOLUM, sebepId: sebepPlanliId, baslangic: '12:00', sureDk: 45, gunMaskesi: 127 }, select: { id: true } })
  molaId = m.id
  // Planlı duruş: 12:00–12:30 yerel (09:00–09:30Z) — mola penceresi (09:00–09:45Z) içinde.
  const d1 = await prisma.iproMachineDowntime.create({ data: { tezgahId, durusSebebiId: sebepPlanliId, baslangic: new Date('2026-09-21T09:00:00Z'), bitis: new Date('2026-09-21T09:30:00Z'), kaynak: 'TAKVIM' }, select: { id: true } })
  // Plansız duruş: 10:00–10:10Z (mola dışı) — 600 sn gerçek kayıp.
  const d2 = await prisma.iproMachineDowntime.create({ data: { tezgahId, durusSebebiId: sebepPlansizId, baslangic: new Date('2026-09-21T10:00:00Z'), bitis: new Date('2026-09-21T10:10:00Z'), kaynak: 'PLC' }, select: { id: true } })
  durusIds.push(d1.id, d2.id)
  const s = await prisma.iproOperatorSession.create({ data: { personnelId: 'test-mola-op', tezgahId, authMethod: 'LIST' }, select: { id: true } })
  sessionId = s.id
  const log = await prisma.iproProductionLog.create({
    data: { tezgahId, sessionId, personnelId: 'test-mola-op', ifsOrderNo: 'TEST-MOLA-ORD', ifsOperationNo: 10, durum: 'ACIK', baslatildiAt: BAS, uretimAdet: 100 },
    select: { id: true },
  })
  logId = log.id
})

afterAll(async () => {
  await prisma.iproOeeKaydi.deleteMany({ where: { productionLogId: logId } }).catch(() => {})
  await prisma.iproProductionLog.deleteMany({ where: { id: logId } }).catch(() => {})
  await prisma.iproOperatorSession.deleteMany({ where: { id: sessionId } }).catch(() => {})
  await prisma.iproMachineDowntime.deleteMany({ where: { id: { in: durusIds } } }).catch(() => {})
  await prisma.iproMolaTanim.deleteMany({ where: { id: molaId } }).catch(() => {})
  await prisma.iproDurusSebebi.deleteMany({ where: { id: { in: [sebepPlanliId, sebepPlansizId] } } }).catch(() => {})
  await prisma.iproTezgah.deleteMany({ where: { id: tezgahId } }).catch(() => {})
  await prisma.iproVardiya.deleteMany({ where: { id: vardiyaId } }).catch(() => {})
  await prisma.$disconnect()
})

describe('mola guard — canlı/kapalı availability paritesi', () => {
  it('aynı senaryo: canlı pano availability === kapalı IproOeeKaydi availability', async () => {
    // CANLI (iş ACIK, simdi = BIT).
    const canli = await tezgahlarinCanliOee(
      prisma,
      [{ id: tezgahId, kod: TZ_KOD, masGrupKodu: BOLUM }],
      [{ tezgahId, ifsPartNo: null, baslatildiAt: BAS, kaynak: null, uretimAdet: null }],
      BIT,
    )
    const canliAvail = canli.get(tezgahId)?.availability
    expect(canliAvail).not.toBeNull()

    // KAPALI (işi kapat, OEE yaz, oku).
    await prisma.iproProductionLog.update({ where: { id: logId }, data: { durum: 'KAPALI', bitirildiAt: BIT, tamamlandi: true } })
    await oeeKaydiHesaplaVeYaz(prisma, logId)
    const kayit = await prisma.iproOeeKaydi.findUnique({ where: { productionLogId: logId }, select: { availability: true, durusSaniye: true, planliSaniye: true } })
    expect(kayit?.availability).not.toBeNull()

    // Guard doğru ise: durus = yalnız plansız 600 sn (planlı 1800 sn mola∩ düşüldü).
    expect(kayit?.durusSaniye).toBe(600)
    // Parite: iki yol aynı availability.
    expect(canliAvail!).toBeCloseTo(kayit!.availability!, 5)
  })
})
