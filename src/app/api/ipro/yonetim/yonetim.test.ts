/**
 * IPRO yönetim API testleri (integration — gerçek dev DB).
 *
 * `requirePermission` MOCK'lu: yetki kümesi test içinden değiştirilebiliyor,
 * böylece "view yazamaz" kuralı da sınanıyor.
 *
 * Testin ürettiği HER kayıt afterAll'da temizlenir; mevcut seed verisine
 * (203 tezgah, 39 hurda, 115 duruş sebebi, 12 IFS eşlemesi) dokunulmaz.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextResponse } from 'next/server'

/** Test içinden değiştirilebilen yetki kümesi. */
const yetki = vi.hoisted(() => ({ keys: new Set<string>(['ipro.view', 'ipro.admin']) }))

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: vi.fn(async (key: string | string[]) => {
    const gerekli = Array.isArray(key) ? key : [key]
    if (gerekli.some((k) => yetki.keys.has(k))) {
      return { session: { user: { id: 'test-user' } }, userId: 'test-user', error: null }
    }
    return {
      session: null,
      userId: null,
      error: NextResponse.json({ error: 'Yetersiz yetki', required: gerekli }, { status: 403 }),
    }
  }),
}))

import { prisma } from '@/lib/prisma'
import { GET as tezgahlarGET } from '@/app/api/ipro/yonetim/tezgahlar/route'
import { PATCH as tezgahPATCH } from '@/app/api/ipro/yonetim/tezgahlar/[id]/route'
import { GET as eslemeGET, POST as eslemePOST } from '@/app/api/ipro/yonetim/operator-eslemeleri/route'
import { PATCH as eslemePATCH, DELETE as eslemeDELETE } from '@/app/api/ipro/yonetim/operator-eslemeleri/[id]/route'
import { GET as ifsGET, POST as ifsPOST } from '@/app/api/ipro/yonetim/ifs-eslemeleri/route'
import { PATCH as ifsPATCH, DELETE as ifsDELETE } from '@/app/api/ipro/yonetim/ifs-eslemeleri/[id]/route'
import { POST as kioskPOST } from '@/app/api/ipro/yonetim/kiosklar/route'
import { PATCH as kioskPATCH } from '@/app/api/ipro/yonetim/kiosklar/[id]/route'
import { POST as sifrePOST } from '@/app/api/ipro/yonetim/kiosklar/[id]/sifre/route'

function req(body?: unknown, url = 'http://x/api'): Request {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const TEST_KIOSK_KOD = 'KIOSK-YONETIM-TEST'
const TEST_IFS_DEGER = 'TEST-YONETIM-BOLUM'

let tezgahId = ''
let tezgahKod = ''
let personnelId = ''
/** Test tezgahın IFS alanını değiştiriyor — orijinali afterAll'da geri yazılır.
 *  (backfill-from-ifs.ts verisi bilinçli olarak korunuyor, bkz. devir notu.) */
let orijinalWc: string | null = null

beforeAll(async () => {
  const t = await prisma.iproTezgah.findFirst({
    select: { id: true, kod: true, ifsWorkCenterNo: true },
    orderBy: { kod: 'asc' },
  })
  if (!t) throw new Error('Dev DB’de tezgah yok — önce scripts/ipro/import-all.ts koşulmalı')
  tezgahId = t.id
  tezgahKod = t.kod
  orijinalWc = t.ifsWorkCenterNo

  // Bu tezgaha HENÜZ bağlı olmayan bir personel seç (kopya eşleme testi bozulmasın).
  const mevcut = await prisma.iproOperatorTezgah.findMany({ where: { tezgahId }, select: { personnelId: true } })
  const p = await prisma.personnel.findFirst({
    where: { aktif: true, sicilNo: { not: null }, id: { notIn: mevcut.map((m) => m.personnelId) } },
    select: { id: true },
  })
  if (!p) throw new Error('Uygun test personeli bulunamadı')
  personnelId = p.id
})

afterAll(async () => {
  // Tezgahın IFS alanını orijinaline geri yaz — seed verisi bozulmasın.
  if (tezgahId) {
    await prisma.iproTezgah.update({ where: { id: tezgahId }, data: { ifsWorkCenterNo: orijinalWc } })
  }
  await prisma.iproOperatorTezgah.deleteMany({ where: { personnelId, tezgahId } })
  await prisma.iproIfsEslesme.deleteMany({ where: { ilerihubDeger: TEST_IFS_DEGER } })
  const k = await prisma.iproKiosk.findUnique({ where: { kod: TEST_KIOSK_KOD }, select: { id: true, userId: true } })
  if (k) {
    await prisma.iproKioskTezgah.deleteMany({ where: { kioskId: k.id } })
    await prisma.iproKiosk.delete({ where: { id: k.id } })
    await prisma.user.delete({ where: { id: k.userId } })
  }
  await prisma.$disconnect()
})

describe('yetki kapısı', () => {
  it('yetkisiz → 403, listeye erişemez', async () => {
    yetki.keys = new Set()
    const res = await tezgahlarGET()
    expect(res.status).toBe(403)
    yetki.keys = new Set(['ipro.view', 'ipro.admin'])
  })

  it('yalnız ipro.view → okuyabilir ama YAZAMAZ', async () => {
    yetki.keys = new Set(['ipro.view'])
    expect((await tezgahlarGET()).status).toBe(200)

    const yaz = await tezgahPATCH(req({ ad: 'olmaz' }), ctx(tezgahId))
    expect(yaz.status).toBe(403)

    yetki.keys = new Set(['ipro.view', 'ipro.admin'])
  })
})

describe('tezgahlar', () => {
  it('liste sinyalli/operatorSayisi türetilmiş alanları döner', async () => {
    const res = await tezgahlarGET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d.tezgahlar.length).toBeGreaterThan(0)
    expect(d.tezgahlar[0]).toHaveProperty('sinyalli')
    expect(d.tezgahlar[0]).toHaveProperty('operatorSayisi')
  })

  it('kod değiştirme DENEMESİ 400 ile reddedilir (IFS kaynak kimliği)', async () => {
    const res = await tezgahPATCH(req({ kod: 'YENI-KOD' }), ctx(tezgahId))
    expect(res.status).toBe(400)
    const d = await res.json()
    expect(d.error).toMatch(/kodu değiştirilemez/i)

    const t = await prisma.iproTezgah.findUnique({ where: { id: tezgahId }, select: { kod: true } })
    expect(t?.kod).toBe(tezgahKod) // gerçekten değişmemiş
  })

  it('IFS alanları güncellenir (orijinal değer hemen geri yazılır)', async () => {
    const res = await tezgahPATCH(req({ ifsWorkCenterNo: '999' }), ctx(tezgahId))
    expect(res.status).toBe(200)
    const t = await prisma.iproTezgah.findUnique({ where: { id: tezgahId }, select: { ifsWorkCenterNo: true } })
    expect(t?.ifsWorkCenterNo).toBe('999')

    // Gerçek seed alanı — testin ortasında kesinti olursa artık kalmasın diye
    // afterAll'ı beklemeden BURADA geri yazılır (afterAll emniyet kemeri).
    await prisma.iproTezgah.update({ where: { id: tezgahId }, data: { ifsWorkCenterNo: orijinalWc } })
    const geri = await prisma.iproTezgah.findUnique({ where: { id: tezgahId }, select: { ifsWorkCenterNo: true } })
    expect(geri?.ifsWorkCenterNo).toBe(orijinalWc)
  })
})

describe('operatör eşlemeleri', () => {
  let eslemeId = ''

  it('tezgahId olmadan 400', async () => {
    const res = await eslemeGET(req(undefined, 'http://x/api'))
    expect(res.status).toBe(400)
  })

  it('personel eklenir', async () => {
    const res = await eslemePOST(req({ tezgahId, personnelId }))
    expect(res.status).toBe(201)
    const d = await res.json()
    eslemeId = d.esleme.id
    expect(eslemeId).toBeTruthy()
  })

  it('aynı personel tekrar eklenince KOPYA oluşmaz, aynı satır döner', async () => {
    const res = await eslemePOST(req({ tezgahId, personnelId }))
    expect(res.status).toBe(201)
    const d = await res.json()
    expect(d.esleme.id).toBe(eslemeId)

    const sayi = await prisma.iproOperatorTezgah.count({ where: { tezgahId, personnelId } })
    expect(sayi).toBe(1)
  })

  it('pasifleştirilen eşleme yeniden eklenince AKTİFLEŞİR', async () => {
    await eslemePATCH(req({ aktif: false }), ctx(eslemeId))
    let e = await prisma.iproOperatorTezgah.findUnique({ where: { id: eslemeId }, select: { aktif: true } })
    expect(e?.aktif).toBe(false)

    await eslemePOST(req({ tezgahId, personnelId }))
    e = await prisma.iproOperatorTezgah.findUnique({ where: { id: eslemeId }, select: { aktif: true } })
    expect(e?.aktif).toBe(true)
  })

  it('listede personel bilgisi ikinci sorgudan gelir (FK yok)', async () => {
    const res = await eslemeGET(req(undefined, `http://x/api?tezgahId=${tezgahId}`))
    expect(res.status).toBe(200)
    const d = await res.json()
    const bizim = d.eslemeler.find((x: { id: string }) => x.id === eslemeId)
    expect(bizim).toBeTruthy()
    expect(bizim).toHaveProperty('adSoyad')
    expect(bizim).toHaveProperty('sicilNo')
  })

  it('silinir', async () => {
    const res = await eslemeDELETE(req(), ctx(eslemeId))
    expect(res.status).toBe(200)
    expect(await prisma.iproOperatorTezgah.count({ where: { id: eslemeId } })).toBe(0)
  })
})

describe('IFS eşlemeleri', () => {
  let id = ''

  it('eklenir', async () => {
    const res = await ifsPOST(req({ tip: 'ORG', ilerihubDeger: TEST_IFS_DEGER, ifsKod: '999' }))
    expect(res.status).toBe(201)
    id = (await res.json()).esleme.id
  })

  it('aynı (tip, deger) ikinci kez → 409', async () => {
    const res = await ifsPOST(req({ tip: 'ORG', ilerihubDeger: TEST_IFS_DEGER, ifsKod: '888' }))
    expect(res.status).toBe(409)
    const d = await res.json()
    expect(d.error).toMatch(/zaten kayıtlı/i)
  })

  it('geçersiz tip → 400', async () => {
    const res = await ifsPOST(req({ tip: 'SACMA', ilerihubDeger: 'x', ifsKod: '1' }))
    expect(res.status).toBe(400)
  })

  it('zorunlu alan eksik → 400', async () => {
    const res = await ifsPOST(req({ tip: 'ORG', ifsKod: '1' }))
    expect(res.status).toBe(400)
  })

  it('güncellenir ve listede görünür', async () => {
    expect((await ifsPATCH(req({ ifsKod: '777' }), ctx(id))).status).toBe(200)
    const d = await (await ifsGET()).json()
    const bizim = d.eslemeler.find((x: { id: string }) => x.id === id)
    expect(bizim.ifsKod).toBe('777')
  })

  it('silinir', async () => {
    expect((await ifsDELETE(req(), ctx(id))).status).toBe(200)
    expect(await prisma.iproIfsEslesme.count({ where: { id } })).toBe(0)
  })
})

describe('kiosk cihazı', () => {
  let kioskId = ''
  let userId = ''
  let ilkSifre = ''

  it('oluşturulunca User(KIOSK) + kiosk + tezgah bağı tek seferde kurulur, şifre BİR KEZ döner', async () => {
    const res = await kioskPOST(req({ kod: TEST_KIOSK_KOD, ad: 'Yönetim Testi', tezgahIds: [tezgahId] }))
    expect(res.status).toBe(201)
    const d = await res.json()
    kioskId = d.kiosk.id
    ilkSifre = d.kiosk.sifre
    expect(ilkSifre).toBeTruthy()
    expect(ilkSifre.length).toBeGreaterThanOrEqual(8)

    const k = await prisma.iproKiosk.findUnique({
      where: { id: kioskId },
      select: { kod: true, sifreHash: true, userId: true, tezgahlar: { select: { tezgahId: true } } },
    })
    userId = k!.userId
    expect(k!.kod).toBe(TEST_KIOSK_KOD)
    expect(k!.tezgahlar.map((t) => t.tezgahId)).toEqual([tezgahId])
    // şifre DÜZ METİN saklanmaz
    expect(k!.sifreHash).not.toBe(ilkSifre)
    expect(k!.sifreHash.startsWith('$2')).toBe(true)

    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, employeeId: true },
    })
    expect(u!.role).toBe('KIOSK')
    expect(u!.isActive).toBe(true)
    expect(u!.employeeId).toBeNull() // İK listelerine düşmemeli
  })

  it('aynı kod ikinci kez → 409', async () => {
    const res = await kioskPOST(req({ kod: TEST_KIOSK_KOD, ad: 'kopya', tezgahIds: [] }))
    expect(res.status).toBe(409)
  })

  it('şifre yenilenince hash DEĞİŞİR ve yeni şifre döner', async () => {
    const onceki = (await prisma.iproKiosk.findUnique({ where: { id: kioskId }, select: { sifreHash: true } }))!.sifreHash
    const res = await sifrePOST(req(), ctx(kioskId))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.kiosk.sifre).toBeTruthy()
    expect(d.kiosk.sifre).not.toBe(ilkSifre)

    const sonraki = (await prisma.iproKiosk.findUnique({ where: { id: kioskId }, select: { sifreHash: true } }))!.sifreHash
    expect(sonraki).not.toBe(onceki)
  })

  it('cihaz pasifleşince BAĞLI USER HESABI da pasifleşir', async () => {
    expect((await kioskPATCH(req({ aktif: false }), ctx(kioskId))).status).toBe(200)
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
    expect(u!.isActive).toBe(false)
  })

  it('tezgah bağları verilen listeyle TAMAMEN değiştirilir', async () => {
    expect((await kioskPATCH(req({ tezgahIds: [] }), ctx(kioskId))).status).toBe(200)
    expect(await prisma.iproKioskTezgah.count({ where: { kioskId } })).toBe(0)
  })
})
