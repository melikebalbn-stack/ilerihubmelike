/**
 * Kiosk duruş akışı testleri (integration — gerçek dev DB, HTTP'siz).
 * requireKiosk MOCK'lu. Kendi tezgah + sebepler + duruş kayıtlarını kurar,
 * afterAll'da temizler; mevcut seed verisine dokunmaz.
 *
 * Kapsam: durus-sebepleri filtresi, durus-basla (sebep validasyon + tekil açık→409),
 * durus-bitir, is-bitir guard (durusAktifkenIsBitirilemez→409).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const KOD = 'DRS-TEST-TZ'
let tezgahId = ''
let sebepGorunurId = '' // aktif + uretimdeGosterilsin + !yetkiliOnay, bitir kilidi YOK
let sebepKilitId = '' // durusAktifkenIsBitirilemez = true
let sebepGizliId = '' // yetkiliOnayGerekli = true → kiosk listesinde GİZLİ

// requireKiosk mock — test tezgahını bağlı gösterir.
vi.mock('@/lib/ipro/require-kiosk', () => ({
  requireKiosk: vi.fn(async () => ({
    kiosk: {
      id: 'test-kiosk', kod: 'KIOSK-TEST', ad: 'Test', aktif: true, userId: 'x',
      tezgahlar: [{ tezgah: { id: tezgahId, kod: KOD, ad: 'Duruş Test' } }],
    },
    error: null,
  })),
}))

import { prisma } from '@/lib/prisma'
import { GET as SEBEPLER } from '@/app/api/ipro/kiosk/durus-sebepleri/route'
import { POST as DURUS_BASLA } from '@/app/api/ipro/kiosk/durus-basla/route'
import { POST as DURUS_BITIR } from '@/app/api/ipro/kiosk/durus-bitir/route'
import { POST as IS_BITIR } from '@/app/api/ipro/kiosk/is-bitir/route'
import { tezgahDetay } from '@/lib/ipro/izleme-service'

function req(body: unknown): any {
  return { json: async () => body }
}

const P1 = 'drs-test-op-1'

beforeAll(async () => {
  const t = await prisma.iproTezgah.create({ data: { kod: KOD, ad: 'Duruş Test', aktif: true }, select: { id: true } })
  tezgahId = t.id
  const mk = async (kod: string, data: Record<string, unknown>) =>
    (await prisma.iproDurusSebebi.create({ data: { kod, ad: kod, bitisTipi: 'MANUEL', ...data }, select: { id: true } })).id
  sebepGorunurId = await mk('DRS-GORUNUR', { aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: false, durusAktifkenIsBitirilemez: false })
  sebepKilitId = await mk('DRS-KILIT', { aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: false, durusAktifkenIsBitirilemez: true })
  sebepGizliId = await mk('DRS-GIZLI', { aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: true })
})

afterAll(async () => {
  await prisma.iproMachineDowntime.deleteMany({ where: { tezgahId } })
  await prisma.iproDurusSebebi.deleteMany({ where: { id: { in: [sebepGorunurId, sebepKilitId, sebepGizliId] } } })
  await prisma.iproTezgah.deleteMany({ where: { id: tezgahId } })
  await prisma.$disconnect()
})

describe('durus-sebepleri', () => {
  it('yalnız aktif+uretimdeGosterilsin+!yetkiliOnay döner; onay gerektiren GİZLİ', async () => {
    const res = await SEBEPLER()
    const d = await res.json()
    const kodlar = d.sebepler.map((s: { kod: string }) => s.kod)
    expect(kodlar).toContain('DRS-GORUNUR')
    expect(kodlar).toContain('DRS-KILIT')
    expect(kodlar).not.toContain('DRS-GIZLI') // yetkiliOnayGerekli → gizli
    // durusAktifkenIsBitirilemez UI'a taşınır
    const kilit = d.sebepler.find((s: { kod: string }) => s.kod === 'DRS-KILIT')
    expect(kilit.durusAktifkenIsBitirilemez).toBe(true)
  })
})

describe('durus-basla / durus-bitir', () => {
  it('geçersiz/gizli sebep → 400', async () => {
    const res = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGizliId }))
    expect(res.status).toBe(400) // gizli sebep başlatılamaz
  })

  it('başla → 201, ikinci açık duruş → 409 (tekil açık), bitir → 200', async () => {
    const r1 = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    expect(r1.status).toBe(201)

    const r2 = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    expect(r2.status).toBe(409) // partial unique: tezgahta zaten açık duruş

    const rb = await DURUS_BITIR(req({ tezgahId }))
    expect(rb.status).toBe(200)
    const db = await rb.json()
    expect(db.bitis).toBeTruthy()

    // artık açık duruş yok → bitir tekrar 404
    const rb2 = await DURUS_BITIR(req({ tezgahId }))
    expect(rb2.status).toBe(404)
  })

  it('bitirdikten sonra yeniden açılabilir (unique yalnız AÇIK için)', async () => {
    const r = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    expect(r.status).toBe(201)
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('pano: açık duruş → tezgahDetay durum=durusta + bugunDuruslar dolu; bitince temizlenir', async () => {
    await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    const d1 = await tezgahDetay(tezgahId)
    expect(d1!.durum).toBe('durusta')
    expect(d1!.durus?.sebep).toBe('DRS-GORUNUR')
    expect(d1!.bugunDuruslar.some((x) => x.bitisAt === null && x.sebep === 'DRS-GORUNUR')).toBe(true)

    await DURUS_BITIR(req({ tezgahId }))
    const d2 = await tezgahDetay(tezgahId)
    expect(d2!.durum).toBe('bosta') // açık duruş yok, açık iş de yok
    // kapanan duruş bugünkü listede bitisAt dolu olarak kalır
    expect(d2!.bugunDuruslar.some((x) => x.sebep === 'DRS-GORUNUR' && x.bitisAt !== null)).toBe(true)
  })
})

describe('is-bitir guard', () => {
  it('durusAktifkenIsBitirilemez açık duruş varken is-bitir → 409', async () => {
    await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepKilitId }))
    const res = await IS_BITIR(req({
      tezgahId, personnelId: P1, ifsOrderNo: 'X', ifsOperationNo: 1, iyi: 0, hurda: 0, tamamlandi: true,
    }))
    expect(res.status).toBe(409) // önce duruşu bitir
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('kilitsiz sebep açık duruş is-bitir guard tetiklemez (açık iş yok → 404 döner, 409 DEĞİL)', async () => {
    await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    const res = await IS_BITIR(req({
      tezgahId, personnelId: P1, ifsOrderNo: 'YOK', ifsOperationNo: 9, iyi: 0, hurda: 0, tamamlandi: true,
    }))
    // guard geçer (kilit yok), açık iş bulunamaz → 404
    expect(res.status).toBe(404)
    await DURUS_BITIR(req({ tezgahId }))
  })
})
