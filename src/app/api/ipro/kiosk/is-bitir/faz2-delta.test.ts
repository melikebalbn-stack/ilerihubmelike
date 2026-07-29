/**
 * FAZ 2 — is-bitir Σ delta + fallback guard testi (entegrasyon, gerçek dev DB, HTTP'siz).
 * SİNYALLİ fixture: kendi PLC + pin + tezgahını kurar (is-bitir sinyalli dalını tetikler).
 * Poller /status fetch'i localhost:3020'ye gider; test ortamında erişilemezse yakalanır
 * (plcSayacBitis null) — FAZ 2 DELTA yolu seriden hesapladığı için bu sorun DEĞİL.
 * requireKiosk + IFS MOCK'lu. Kendi kayıtlarını afterAll'da temizler.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const KOD = 'FAZ2-TEST-TZ'
let tezgahId = ''
let plcId = ''
let sessionId = ''
const P1 = 'faz2-test-op'
const ORDER = 'FAZ2-TEST-9200'

vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: { id: 'k', kod: 'KIOSK-TEST', ad: 'T', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: tezgahId, kod: KOD, ad: 'Faz2 Test' } }] },
    error: null,
  })),
}))
vi.mock('@/lib/ifs/config', () => ({
  getIfsConfig: () => ({ baseUrl: 'x', tokenUrl: 'x', clientId: 'x', clientSecret: 'x', contract: 'ILER2', company: 'ILERI2' }),
}))
vi.mock('@/lib/ifs/shop-floor', () => ({
  reportQuantityComplete: vi.fn(async () => { throw new Error('IFS: ulaşılmamalı') }),
}))

import { prisma } from '@/lib/prisma'
import { POST as bitir } from '@/app/api/ipro/kiosk/is-bitir/route'

const req = (b: unknown): any => ({ json: async () => b })

async function temizle() {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  await prisma.iproSayacOkuma.deleteMany({ where: { tezgahKod: KOD } })
  const t = await prisma.iproTezgah.findUnique({ where: { kod: KOD }, select: { id: true } })
  if (t) {
    await prisma.iproOperatorSession.deleteMany({ where: { tezgahId: t.id } })
    await prisma.iproPlcPin.deleteMany({ where: { tezgahId: t.id } })
    await prisma.iproTezgah.deleteMany({ where: { id: t.id } })
  }
  await prisma.iproPlc.deleteMany({ where: { kod: 'FAZ2-PLC' } })
}

beforeAll(async () => {
  await temizle() // önceki yarım koşu kalıntısına karşı idempotent
  const plc = await prisma.iproPlc.create({ data: { kod: 'FAZ2-PLC', ad: 'Faz2 PLC', ip: '10.0.0.99', rack: 0, slot: 0, aktif: true }, select: { id: true } })
  plcId = plc.id
  const t = await prisma.iproTezgah.create({ data: { kod: KOD, ad: 'Faz2 Test', aktif: true }, select: { id: true } })
  tezgahId = t.id
  // Sinyalli yap: aktif pin (is-bitir sinyalli dalı bunu sayar)
  await prisma.iproPlcPin.create({ data: { plcId, tezgahId, kod: 99901, inputPin: 'I99.1', sayacAdresi: 0, resetAdresi: 2000, durusAdresi: 1000, aktif: true } })
  const sess = await prisma.iproOperatorSession.create({ data: { personnelId: P1, tezgahId, authMethod: 'LIST' }, select: { id: true } })
  sessionId = sess.id
})

beforeEach(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: ORDER } })
  await prisma.iproSayacOkuma.deleteMany({ where: { tezgahKod: KOD } })
  delete process.env.IPRO_FAZ2_DELTA
})

afterAll(async () => {
  await temizle() // FK-güvenli sıra: log → sayac → session → pin → tezgah → plc
  await prisma.$disconnect()
})

// Açık iş kurar (is-basla'yı by-pass — sinyalli is-basla poller fetch ister; doğrudan kayıt).
async function acikIsKur(baslangicOffsetSn: number, plcBaslangic: number | null) {
  const baslatildiAt = new Date(Date.now() - baslangicOffsetSn * 1000)
  return prisma.iproProductionLog.create({
    data: { tezgahId, sessionId, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 10,
      durum: 'ACIK', baslatildiAt, plcSayacBaslangic: plcBaslangic },
    select: { id: true },
  })
}
async function seriEkle(deltalar: number[]) {
  let mutlak = 0
  for (const d of deltalar) { mutlak += d; await prisma.iproSayacOkuma.create({ data: { tezgahKod: KOD, delta: d, mutlakSayac: BigInt(mutlak) } }) }
}
const bitirReq = (iyi: number, hurda = 0) =>
  req({ tezgahId, personnelId: P1, ifsOrderNo: ORDER, ifsOperationNo: 10, iyi, hurda, tamamlandi: true, hurdaSebebiKod: hurda > 0 ? 'TEST-HURDA' : undefined })

describe('FAZ 2 — is-bitir Σ delta', () => {
  it('flag KAPALI → çıkarma (plcBitis null olduğundan toplam null), hesapKaynagi CIKARMA değil null', async () => {
    // flag yok; poller /status erişilemez → plcSayacBitis null → çıkarma yapılamaz → toplam null.
    await acikIsKur(60, 100)
    await seriEkle([5, 5]) // seri var ama flag KAPALI → kullanılmaz
    const r = await bitir(bitirReq(3))
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.hesapKaynagi).toBeNull() // flag kapalı + plcBitis yok → hesap yok
  })

  it('flag AÇIK + seri VAR → toplam = Σ delta, hesapKaynagi DELTA', async () => {
    process.env.IPRO_FAZ2_DELTA = 'true'
    await acikIsKur(60, 100)
    await seriEkle([2, 3, 5]) // Σ=10
    const r = await bitir(bitirReq(7, 1))
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.hesapKaynagi).toBe('DELTA')
    expect(d.toplam).toBe(10)
    expect(d.ayarDeneme).toBe(2) // 10 - 7 - 1
    const row = await prisma.iproProductionLog.findFirst({ where: { ifsOrderNo: ORDER }, select: { uretimAdet: true, hesapKaynagi: true, qtyComplete: true } })
    expect(row).toMatchObject({ uretimAdet: 10, hesapKaynagi: 'DELTA', qtyComplete: 7 })
  })

  it('flag AÇIK + seri YOK → çıkarmaya FALLBACK (plcBitis yok → toplam null, hesapKaynagi null)', async () => {
    process.env.IPRO_FAZ2_DELTA = 'true'
    await acikIsKur(60, 100)
    // seri EKLENMEDİ → seriVar=false → fallback; plcBitis de yok → toplam null
    const r = await bitir(bitirReq(5))
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.hesapKaynagi).toBeNull() // fallback denendi ama çıkarma da yapılamadı (plcBitis null)
    expect(d.toplam).toBeNull()
  })

  it('flag AÇIK + seri VAR + iyi+hurda > Σ delta → 400 (doğrulama korundu)', async () => {
    process.env.IPRO_FAZ2_DELTA = 'true'
    await acikIsKur(60, 100)
    await seriEkle([1, 1]) // Σ=2
    const r = await bitir(bitirReq(5)) // 5 > 2
    expect(r.status).toBe(400)
  })

  it('reset içeren seri: delta dizisi reset sonrası doğru toplanır', async () => {
    process.env.IPRO_FAZ2_DELTA = 'true'
    await acikIsKur(60, 100)
    // poller reset'i delta=cur olarak yutar: 3, sonra reset→2, sonra 1 → Σ=6 (poller zaten böyle yazar)
    await seriEkle([3, 2, 1])
    const r = await bitir(bitirReq(6))
    expect(r.status).toBe(200)
    expect((await r.json()).toplam).toBe(6)
  })

  it('pencere DIŞI okuma sayılmaz (baslatildiAt öncesi delta Σ\'ya girmez)', async () => {
    process.env.IPRO_FAZ2_DELTA = 'true'
    // İş 30 sn önce başladı; ondan ÖNCE yazılmış okuma pencereye girmemeli.
    await prisma.iproSayacOkuma.create({ data: { tezgahKod: KOD, delta: 99, mutlakSayac: BigInt(99), ts: new Date(Date.now() - 120_000) } })
    await acikIsKur(30, 100)
    await seriEkle([4]) // pencere içi
    const r = await bitir(bitirReq(4))
    expect((await r.json()).toplam).toBe(4) // 99 girmedi
  })
})
