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
let sebepKaliteId = '' // kaliteBildirim = true → duruş başlayınca mail (Melike #8)

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

// email mock — GERÇEK SMTP'ye ÇIKMAZ. Kalite bildirimi çağrısı burada yakalanır.
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}))

import { prisma } from '@/lib/prisma'
import { GET as SEBEPLER } from '@/app/api/ipro/kiosk/durus-sebepleri/route'
import { POST as DURUS_BASLA } from '@/app/api/ipro/kiosk/durus-basla/route'
import { POST as DURUS_BITIR } from '@/app/api/ipro/kiosk/durus-bitir/route'
import { POST as DURUS_YORUM } from '@/app/api/ipro/kiosk/durus-yorum/route'
import { yorumNormalize } from '@/lib/ipro/durus-yorum'
import { sendEmail } from '@/lib/email'
import { kaliteBildirimIcerik, kaliteAliciAdresi } from '@/lib/ipro/kalite-bildirim'
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
  sebepKaliteId = await mk('DRS-KALITE', { aktif: true, uretimdeGosterilsin: true, yetkiliOnayGerekli: false, kaliteBildirim: true })
})

afterAll(async () => {
  await prisma.iproMachineDowntime.deleteMany({ where: { tezgahId } })
  await prisma.iproDurusSebebi.deleteMany({ where: { id: { in: [sebepGorunurId, sebepKilitId, sebepGizliId, sebepKaliteId] } } })
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

describe('duruş yorumu (OPSİYONEL)', () => {
  it('YORUMSUZ yol: durus-basla yorum göndermeden çalışır, yorum null', async () => {
    // Davranış değişikliği YOK — bugünkü akış aynen sürer.
    const r = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    expect(r.status).toBe(201)
    const d = await r.json()
    expect(d.yorum).toBeNull()
    const kayit = await prisma.iproMachineDowntime.findUnique({ where: { id: d.id }, select: { yorum: true } })
    expect(kayit?.yorum).toBeNull()
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('YORUMLU yol: durus-basla ile yorum kaydedilir', async () => {
    const r = await DURUS_BASLA(req({
      tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId, yorum: '  rulman değişimi bekleniyor  ',
    }))
    expect(r.status).toBe(201)
    const d = await r.json()
    expect(d.yorum).toBe('rulman değişimi bekleniyor') // trim uygulandı
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('durus-yorum: duruş sürerken yorum yazılır/güncellenir', async () => {
    const b = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    const id = (await b.json()).id

    const y1 = await DURUS_YORUM(req({ tezgahId, yorum: 'ilk not' }))
    expect(y1.status).toBe(200)
    expect((await y1.json()).yorum).toBe('ilk not')

    const y2 = await DURUS_YORUM(req({ tezgahId, yorum: 'düzeltilmiş not' }))
    expect((await y2.json()).yorum).toBe('düzeltilmiş not')

    const kayit = await prisma.iproMachineDowntime.findUnique({ where: { id }, select: { yorum: true } })
    expect(kayit?.yorum).toBe('düzeltilmiş not')
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('durus-yorum: açık duruş yoksa 404, tezgah kiosk\'a bağlı değilse 403', async () => {
    expect((await DURUS_YORUM(req({ tezgahId }))).status).toBe(404)
    expect((await DURUS_YORUM(req({ tezgahId: 'baska-tezgah', yorum: 'x' }))).status).toBe(403)
  })

  it('yorum pano detayında görünür (izleme entegrasyonu)', async () => {
    await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId, yorum: 'kalıp bekleniyor' }))
    const d = await tezgahDetay(tezgahId)
    const satir = d!.bugunDuruslar.find((x) => x.bitisAt === null)
    expect(satir?.yorum).toBe('kalıp bekleniyor')
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('yorumNormalize: boş/whitespace → null, 200 karakterde kırpılır', () => {
    expect(yorumNormalize('')).toBeNull()
    expect(yorumNormalize('   ')).toBeNull()
    expect(yorumNormalize(undefined)).toBeNull()
    expect(yorumNormalize(123)).toBeNull()
    expect(yorumNormalize(' not ')).toBe('not')
    expect(yorumNormalize('x'.repeat(250))).toHaveLength(200)
  })
})

describe('kalite bildirimi (Melike #8)', () => {
  const sendEmailMock = vi.mocked(sendEmail)

  it('bayrak AÇIK → sendEmail çağrılır, doğru alıcı + içerik', async () => {
    sendEmailMock.mockClear()
    const r = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepKaliteId }))
    expect(r.status).toBe(201)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [to, subject, body] = sendEmailMock.mock.calls[0]
    expect(to[0].email).toBe(kaliteAliciAdresi())
    expect(subject).toContain('Kalite Duruşu')
    expect(subject).toContain(KOD) // tezgah kodu
    expect(body).toContain('DRS-KALITE') // sebep adı
    expect(body).toContain(P1) // operatör sicil
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('bayrak KAPALI → sendEmail çağrılmaz', async () => {
    sendEmailMock.mockClear()
    const r = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepGorunurId }))
    expect(r.status).toBe(201)
    expect(sendEmailMock).not.toHaveBeenCalled()
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('KRİTİK: mail HATA fırlatsa da duruş 201 döner (bloklamama garantisi)', async () => {
    sendEmailMock.mockClear()
    sendEmailMock.mockRejectedValueOnce(new Error('SMTP down'))
    const r = await DURUS_BASLA(req({ tezgahId, personnelId: P1, durusSebebiId: sebepKaliteId }))
    expect(r.status).toBe(201) // mail patladı ama duruş yine başladı
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    await DURUS_BITIR(req({ tezgahId }))
  })

  it('içerik: yorumlu → Not satırı var; yorumsuz → Not satırı YOK', () => {
    const ortak = { tezgahKod: 'KH01', tezgahAd: 'Kaynak', sebepAd: 'Kalite Onay', sicil: 'MM63', baslangic: new Date('2026-07-24T10:00:00Z') }
    expect(kaliteBildirimIcerik({ ...ortak, yorum: 'rulman bekleniyor' }).body).toContain('Not: rulman bekleniyor')
    const yorumsuz = kaliteBildirimIcerik({ ...ortak, yorum: null }).body
    expect(yorumsuz).not.toContain('Not:')
    expect(kaliteBildirimIcerik({ ...ortak, yorum: '   ' }).body).not.toContain('Not:') // boşluk da düşer
  })

  it('alıcı: IPRO_KALITE_MAIL varsa onu, yoksa fallback', () => {
    const eski = process.env.IPRO_KALITE_MAIL
    process.env.IPRO_KALITE_MAIL = 'kalite@ilerigroup.com'
    expect(kaliteAliciAdresi()).toBe('kalite@ilerigroup.com')
    delete process.env.IPRO_KALITE_MAIL
    expect(kaliteAliciAdresi()).toContain('@ilerigroup.com') // fallback
    if (eski !== undefined) process.env.IPRO_KALITE_MAIL = eski
  })
})
