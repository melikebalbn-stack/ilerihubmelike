/**
 * IPRO izleme panosu API testleri (integration — gerçek dev DB).
 *
 * requirePermission MOCK'lu. Test kendi tezgah + oturum + açık iş kurar,
 * afterAll'da temizler; mevcut seed verisine dokunmaz. SALT OKUMA endpoint —
 * pano hiçbir yazma yapmaz, testler yalnız topladığı veriyi doğrular.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextResponse } from 'next/server'

const yetki = vi.hoisted(() => ({ keys: new Set<string>(['ipro.view']) }))

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: vi.fn(async (key: string | string[]) => {
    const gerekli = Array.isArray(key) ? key : [key]
    if (gerekli.some((k) => yetki.keys.has(k))) {
      return { session: { user: { id: 'test-user' } }, userId: 'test-user', error: null }
    }
    return { session: null, userId: null, error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) }
  }),
}))

import { prisma } from '@/lib/prisma'
import { GET } from '@/app/api/ipro/izleme/route'
import { GET as GET_DETAY } from '@/app/api/ipro/izleme/tezgah/[id]/route'
import { panoData } from '@/lib/ipro/izleme-service'

const KOD = 'IZL-TEST-TZ'
let tezgahId = ''
let sessionId = ''
let logId = ''
let personnelId = ''
let adSoyad = ''

beforeAll(async () => {
  const t = await prisma.iproTezgah.create({
    data: { kod: KOD, ad: 'İZLEME TEST', aktif: true, masGrupAdi: 'TEST GRUP' },
    select: { id: true },
  })
  tezgahId = t.id

  const p = await prisma.personnel.findFirst({ where: { aktif: true, adSoyad: { not: '' } }, select: { id: true, adSoyad: true } })
  if (!p) throw new Error('Test personeli yok')
  personnelId = p.id
  adSoyad = p.adSoyad

  const s = await prisma.iproOperatorSession.create({
    data: { personnelId, tezgahId, authMethod: 'LIST' },
    select: { id: true },
  })
  sessionId = s.id

  // ACIK iş — kartın "çalışıyor" görünmesi için baslatildiAt dolu. Malzeme snapshot dolu.
  const log = await prisma.iproProductionLog.create({
    data: {
      tezgahId,
      sessionId,
      personnelId,
      ifsOrderNo: 'IZL-9001',
      ifsOperationNo: 5,
      ifsPartNo: 'IZL-PART-1',
      ifsPartDescription: 'İZLEME TEST MALZEME',
      durum: 'ACIK',
      baslatildiAt: new Date(Date.now() - 12 * 60_000), // 12 dk önce
    },
    select: { id: true },
  })
  logId = log.id
})

afterAll(async () => {
  await prisma.iproProductionLog.deleteMany({ where: { id: logId } })
  await prisma.iproOperatorSession.deleteMany({ where: { id: sessionId } })
  await prisma.iproTezgah.deleteMany({ where: { id: tezgahId } })
  await prisma.$disconnect()
})

describe('izleme yetki', () => {
  it('yetkisiz → 403', async () => {
    yetki.keys = new Set()
    expect((await GET()).status).toBe(403)
    yetki.keys = new Set(['ipro.view'])
  })

  it('ipro.view → 200, {ok, tezgahlar, ozet, kuyruk}', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(Array.isArray(d.tezgahlar)).toBe(true)
    expect(d.ozet).toBeTruthy()
    expect(d.kuyruk).toBeTruthy()
    expect(d.olusturuldu).toBeTruthy()
  })
})

describe('panoData toplama', () => {
  it('ACIK işli tezgah "çalışan" olarak gelir — operatör adı FK-siz eşlenir + malzeme snapshot', async () => {
    const d = await panoData()
    const bizim = d.tezgahlar.find((t) => t.kod === KOD)
    expect(bizim).toBeTruthy()
    expect(bizim!.durum).toBe('calisiyor')
    expect(bizim!.calisan).toBeTruthy()
    expect(bizim!.calisan!.adSoyad).toBe(adSoyad) // ikinci sorgudan eşlendi
    expect(bizim!.calisan!.ifsOrderNo).toBe('IZL-9001')
    expect(bizim!.calisan!.ifsOperationNo).toBe(5)
    expect(bizim!.calisan!.ifsPartNo).toBe('IZL-PART-1') // malzeme kodu passthrough
    expect(bizim!.calisan!.ifsPartDescription).toBe('İZLEME TEST MALZEME')
    expect(bizim!.calisan!.baslatildiAt).toBeTruthy()
    expect(bizim!.durus).toBeNull() // duruş akışı yok → hep null
  })

  it('tezgah detay endpoint: aktif iş + malzeme; yetkisiz 403; yok 404', async () => {
    // yetkisiz
    yetki.keys = new Set()
    const r403 = await GET_DETAY(new Request('http://x'), { params: Promise.resolve({ id: tezgahId }) })
    expect(r403.status).toBe(403)
    yetki.keys = new Set(['ipro.view'])

    // bulunamayan tezgah
    const r404 = await GET_DETAY(new Request('http://x'), { params: Promise.resolve({ id: 'yok-boyle-tezgah' }) })
    expect(r404.status).toBe(404)

    // aktif iş + malzeme
    const res = await GET_DETAY(new Request('http://x'), { params: Promise.resolve({ id: tezgahId }) })
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d.kod).toBe(KOD)
    expect(d.durum).toBe('calisiyor')
    expect(d.aktifIs).toBeTruthy()
    expect(d.aktifIs.ifsOrderNo).toBe('IZL-9001')
    expect(d.aktifIs.ifsPartNo).toBe('IZL-PART-1')
    expect(d.aktifIs.operator).toBe(adSoyad)
    expect(Array.isArray(d.bugunKapanan)).toBe(true)
  })

  it('sadece AKTİF tezgahlar döner; pasif hariç', async () => {
    await prisma.iproTezgah.update({ where: { id: tezgahId }, data: { aktif: false } })
    const d = await panoData()
    expect(d.tezgahlar.find((t) => t.kod === KOD)).toBeUndefined()
    await prisma.iproTezgah.update({ where: { id: tezgahId }, data: { aktif: true } })
  })

  it('açık oturum aktif operatör sayısına girer', async () => {
    const d = await panoData()
    expect(d.ozet.aktifOperator).toBeGreaterThanOrEqual(1)
  })

  it('iş KAPANINCA çalışan boşalır ve gün özetine iyi/hurda yansır', async () => {
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { durum: 'KAPALI', bitirildiAt: new Date(), qtyComplete: 7, qtyScrap: 2 },
    })
    const d = await panoData()
    const bizim = d.tezgahlar.find((t) => t.kod === KOD)
    expect(bizim!.calisan).toBeNull() // artık boşta
    expect(bizim!.durum).toBe('bosta')
    expect(d.ozet.toplamIyi).toBeGreaterThanOrEqual(7)
    expect(d.ozet.toplamHurda).toBeGreaterThanOrEqual(2)
    expect(d.ozet.kapananIs).toBeGreaterThanOrEqual(1)

    // Detay: kapanan iş bugünKapanan listesine düşer.
    const dres = await GET_DETAY(new Request('http://x'), { params: Promise.resolve({ id: tezgahId }) })
    const detay = await dres.json()
    expect(detay.aktifIs).toBeNull()
    expect(detay.bugunKapanan.some((s: { id: string }) => s.id === logId)).toBe(true)

    // Geri al — sonraki testler ACIK bekliyor değil ama afterAll temizliği net kalsın.
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { durum: 'ACIK', bitirildiAt: null, qtyComplete: 0, qtyScrap: 0 },
    })
  })

  it('IFS kuyruğu: KAPALI+yazılmamış+qty>0 bekleyende sayılır', async () => {
    await prisma.iproProductionLog.update({
      where: { id: logId },
      data: { durum: 'KAPALI', bitirildiAt: new Date(), qtyComplete: 5, ifsCompleteYazildi: false },
    })
    const d = await panoData()
    expect(d.kuyruk.bekleyen).toBeGreaterThanOrEqual(1)
    expect(d.kuyruk.enEskiBeklemeAt).toBeTruthy()
    // yazıldı işaretle → bekleyenden düşmeli
    await prisma.iproProductionLog.update({ where: { id: logId }, data: { ifsCompleteYazildi: true } })
    const d2 = await panoData()
    const bekleyenBizim = await prisma.iproProductionLog.count({
      where: { id: logId, durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
    })
    expect(bekleyenBizim).toBe(0) // bizim kayıt artık bekleyende değil
    expect(d2.kuyruk).toBeTruthy()
  })
})
