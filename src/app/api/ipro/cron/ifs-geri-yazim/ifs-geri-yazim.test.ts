/**
 * IFS geri-yazım cron endpoint davranış testi (entegrasyon — gerçek dev DB, HTTP'siz).
 * IFS sınırı mock'lu (config+shop-floor → server-only yüklenmez, gerçek IFS'e gidilmez).
 * Bekleyen kayıtlar sahte personnelId (Personnel'de YOK → sicilNo çözülemez) → IFS'e ULAŞILMADAN basarisiz.
 * DB bağımlılığı: dev DB'de MM63 tezgah id'si (FK için) gerekir.
 * Test satırları SİLİNİR; oturum kapatılır; KIOSK-TEST'e dokunulmaz.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const PFAKE = 'fake-no-sicil-cron' // Personnel'de YOK
const ORDER_PREFIX = 'TEST-CRON'
const SECRET = 'test-cron-secret-xyz'

vi.mock('@/lib/ifs/config', () => ({
  getIfsConfig: () => ({ baseUrl: 'x', tokenUrl: 'x', clientId: 'x', clientSecret: 'x', contract: 'ILER2', company: 'ILERI2' }),
}))
vi.mock('@/lib/ifs/shop-floor', () => ({
  reportQuantityComplete: vi.fn(async () => { throw new Error('IFS test: ulaşılmamalı') }),
}))

import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/ipro/cron/ifs-geri-yazim/route'

function req(secret: string | null): any {
  return { headers: { get: (k: string) => (k === 'x-cron-secret' ? secret : null) } }
}

let sessionId = ''

async function temizle() {
  await prisma.iproProductionLog.deleteMany({ where: { ifsOrderNo: { startsWith: ORDER_PREFIX } } })
}

/** N adet bekleyen KAPALI kayıt (sahte personnelId, qtyComplete>0, ifsCompleteYazildi=false). */
async function bekleyenUret(n: number) {
  for (let i = 0; i < n; i++) {
    await prisma.iproProductionLog.create({
      data: {
        tezgahId: MM63_ID, sessionId, personnelId: PFAKE,
        ifsOrderNo: `${ORDER_PREFIX}-${i}`, ifsOperationNo: i,
        qtyComplete: 5, qtyScrap: 0,
        durum: 'KAPALI', bitirildiAt: new Date(Date.now() + i * 1000),
        ifsCompleteYazildi: false,
      },
    })
  }
}

beforeAll(async () => {
  process.env.CRON_SECRET = SECRET
  const s = await prisma.iproOperatorSession.create({
    data: { personnelId: PFAKE, tezgahId: MM63_ID, authMethod: 'LIST' },
    select: { id: true },
  })
  sessionId = s.id
  await temizle()
})

beforeEach(temizle)

afterAll(async () => {
  await temizle()
  await prisma.iproOperatorSession.updateMany({ where: { id: sessionId, cikisAt: null }, data: { cikisAt: new Date() } })
  await prisma.$disconnect()
})

describe('ifs-geri-yazim cron', () => {
  it('x-cron-secret yok → 401', async () => {
    const res = await POST(req(null))
    expect(res.status).toBe(401)
  })

  it('yanlış secret → 401', async () => {
    const res = await POST(req('yanlis'))
    expect(res.status).toBe(401)
  })

  // NOT: cron endpoint'i tabloyu GLOBAL tarar; paylaşılan dev DB'de paralel testler de satır
  // yazabilir. O yüzden global 'taranan'a değil, KENDİ satırlarımızın işlenmiş durumuna
  // ve cap davranışına (fazla satır bozmaz) assert ediyoruz.
  it('doğru secret → 200 + sayısal taranan/basarili/basarisiz alanları', async () => {
    const res = await POST(req(SECRET))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(typeof d.taranan).toBe('number')
    expect(typeof d.basarili).toBe('number')
    expect(typeof d.basarisiz).toBe('number')
  })

  it('bekleyen (sicilNo null) → cron işler: kendi satırlarımıza ifsCompleteHata "Sicil..." yazılır, endpoint 200', async () => {
    await bekleyenUret(3)
    const res = await POST(req(SECRET))
    expect(res.status).toBe(200)
    // Kendi 3 satırımız IFS'e ulaşmadan işlendi: ifsCompleteYazildi=false + hata dolu.
    const islenen = await prisma.iproProductionLog.findMany({
      where: { ifsOrderNo: { startsWith: ORDER_PREFIX } },
      select: { ifsCompleteYazildi: true, ifsCompleteHata: true },
    })
    expect(islenen).toHaveLength(3)
    for (const r of islenen) {
      expect(r.ifsCompleteYazildi).toBe(false)
      expect(r.ifsCompleteHata ?? '').toMatch(/Sicil/i)
    }
  })

  it('take:50 cap — 51 bekleyen oluştur → taranan:50 (fazla satır varsa da cap 50)', async () => {
    await bekleyenUret(51)
    const res = await POST(req(SECRET))
    expect(res.status).toBe(200)
    const d = await res.json()
    // Eşleşen satır >= 51 (kendi 51'imiz) → endpoint en fazla 50 alır.
    expect(d.taranan).toBe(50)
  })
})
