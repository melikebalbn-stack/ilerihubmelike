/**
 * oeePanoData — batched pano (entegrasyon, dev DB). Açık iş yoksa (dev'de 0) pano yine açılır:
 * tezgahlar dizisi dolu, her kartın canliOee null, durum boşta/fiziksel. statusCek poller'a
 * ulaşamazsa null → katman atlanır, çökmez. izleme-service'e DOKUNULMAZ (yalnız fiziksel-aktivite import).
 */
import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { oeePanoData } from './oee-pano-service'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('oeePanoData', () => {
  it('açık iş yokken pano açılır — tezgahlar dolu, canliOee null, esik=50', async () => {
    const acikSayisi = await prisma.iproProductionLog.count({ where: { durum: 'ACIK' } })
    const pano = await oeePanoData()

    expect(Array.isArray(pano.tezgahlar)).toBe(true)
    expect(pano.tezgahlar.length).toBeGreaterThan(0) // dev'de aktif tezgahlar var
    expect(pano.esik).toBe(50)
    expect(pano.ozet.toplam).toBe(pano.tezgahlar.length)
    // özet sayaçları toplam = toplam tezgah
    expect(pano.ozet.calisiyor + pano.ozet.durusta + pano.ozet.bosta).toBe(pano.ozet.toplam)

    if (acikSayisi === 0) {
      // Açık iş yoksa hiçbir kartta canlı OEE olmamalı, calisan null
      expect(pano.tezgahlar.every((t) => t.canliOee === null)).toBe(true)
      expect(pano.tezgahlar.every((t) => t.calisan === null)).toBe(true)
      expect(pano.ozet.calisiyor).toBe(0)
    }
  })

  it('durum yalnız calisiyor|durusta|bosta; kod/ad dolu', async () => {
    const pano = await oeePanoData()
    for (const t of pano.tezgahlar) {
      expect(['calisiyor', 'durusta', 'bosta']).toContain(t.durum)
      expect(typeof t.kod).toBe('string')
      expect(t.kod.length).toBeGreaterThan(0)
    }
  })
})

/**
 * SOĞUK-BAŞLANGIÇ FIX — Faz2 son-180sn hareketinden 'calisiyor'. Canlı poller karışmasına karşı
 * BOŞTAKİ (şu an 180sn Faz2 setinde OLMAYAN) bir tezgah seçilir; o tezgah için fizikselDurum'un
 * hareketsiz (null) olması beklenir — aynı sayaç sinyali. Seed edilenler id ile temizlenir.
 */
describe('oeePanoData — Faz2 soğuk-başlangıç hareket kaynağı', () => {
  let bostaId = ''
  let bostaKod = ''
  const DURUS_MARK = 'TEST-OEE-SICAK-9500'
  const sayacIds: bigint[] = []
  const durusIds: string[] = []
  const sessionIds: string[] = []
  const logOrders: string[] = []

  const durum = async (id: string) => (await oeePanoData()).tezgahlar.find((t) => t.id === id)?.durum

  beforeAll(async () => {
    const aktif = await prisma.iproTezgah.findMany({ where: { aktif: true }, select: { id: true, kod: true } })
    const hareketli = await prisma.$queryRaw<{ tezgahKod: string }[]>`
      SELECT DISTINCT "tezgahKod" FROM ipro_sayac_okuma WHERE ts > now() - interval '180 seconds'`
    const set = new Set(hareketli.map((r) => r.tezgahKod))
    const bosta = aktif.find((t) => !set.has(t.kod))
    if (!bosta) throw new Error('Test için boşta (180sn hareketsiz) aktif tezgah bulunamadı')
    bostaId = bosta.id
    bostaKod = bosta.kod
  })

  afterEach(async () => {
    if (sayacIds.length) await prisma.iproSayacOkuma.deleteMany({ where: { id: { in: sayacIds.splice(0) } } })
    if (durusIds.length) await prisma.iproMachineDowntime.deleteMany({ where: { id: { in: durusIds.splice(0) } } })
    if (logOrders.length) await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: { in: logOrders.splice(0) } } })
    for (const s of sessionIds.splice(0)) {
      await prisma.iproOperatorSession.updateMany({ where: { id: s, cikisAt: null }, data: { cikisAt: new Date() } })
    }
  })

  async function sayacEkle(ts: Date) {
    const r = await prisma.iproSayacOkuma.create({ data: { tezgahKod: bostaKod, delta: 5, mutlakSayac: BigInt(0), ts }, select: { id: true } })
    sayacIds.push(r.id)
  }

  it('Faz2 son-180sn kaydı olan tezgah → calisiyor (fizikselDurum soğuk/null olsa bile)', async () => {
    await sayacEkle(new Date()) // now → 180sn içinde
    expect(await durum(bostaId)).toBe('calisiyor')
  })

  it('180sn DIŞINDA hareket → durumu DEĞİŞTİRMEZ (set dışı, calisiyor kaynağı olmaz)', async () => {
    const oncesi = await durum(bostaId) // seed yok → baseline
    await sayacEkle(new Date(Date.now() - 300_000)) // 5dk önce → pencere dışı
    expect(await durum(bostaId)).toBe(oncesi)
  })

  it('açık duruş → durusta (Faz2 hareketini EZER — duruş önceliği)', async () => {
    await sayacEkle(new Date()) // hareket var
    const d = await prisma.iproMachineDowntime.create({
      data: { tezgahId: bostaId, baslangic: new Date(), bitis: null, kaynak: 'TEST', yorum: DURUS_MARK },
      select: { id: true },
    })
    durusIds.push(d.id)
    expect(await durum(bostaId)).toBe('durusta')
  })

  it('açık iş → calisiyor (Yaklaşım A regresyon — Faz2 olmadan da)', async () => {
    const ORDER = 'TEST-OEE-SICAK-ACIKIS-9600'
    logOrders.push(ORDER)
    const s = await prisma.iproOperatorSession.create({ data: { personnelId: 'test-sicak-op', tezgahId: bostaId, authMethod: 'LIST' }, select: { id: true } })
    sessionIds.push(s.id)
    await prisma.iproProductionLog.create({
      data: {
        tezgahId: bostaId, sessionId: s.id, personnelId: 'test-sicak-op', ifsOrderNo: ORDER, ifsOperationNo: 10,
        durum: 'ACIK', baslatildiAt: new Date(), qtyComplete: 0, qtyScrap: 0,
      },
    })
    expect(await durum(bostaId)).toBe('calisiyor')
  })
})
