import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { VARSAYILAN_AYAR } from '@/lib/sla/calisma-takvimi'

/**
 * /api/cron/fif-eskalasyon — Paket 4 kök neden / faaliyet planı bölümü.
 *  · Başlangıç: SORUMLU_ATAMA_BEKLIYOR'a İLK giriş; 5 iş günü (SLA takvimi) dolmuş VE
 *    (kök neden boş VEYA hiç faaliyet yok).
 *  · Alıcılar: YALNIZ sorumlu bölüm müdürü + izleme sorumlusu (varsa) + KSS (tekil) — GMY/GM YOK.
 *  · FİF başına TEK gönderim (başlık bazlı); mail + zil + push (fifKullaniciyaBildir).
 */

const fifFindMany = vi.fn()
const notificationFindFirst = vi.fn()
const userFindFirst = vi.fn()
const bildir = vi.fn()
const ustYonetim = vi.fn()

vi.mock('@/lib/sla', () => ({ getSlaAyar: async () => VARSAYILAN_AYAR, getTatilMap: async () => new Map() }))
vi.mock('@/lib/org/ust-yonetim', () => ({
  ustYonetimKoltugu: (...a: unknown[]) => ustYonetim(...a),
  koltukKoduIle: async () => ({ userId: 'uGM' }),
  GM_KODU: 'GM',
}))
vi.mock('@/lib/quality/fif-bildirim', () => ({ fifKullaniciyaBildir: (...a: unknown[]) => bildir(...a) }))
vi.mock('@/lib/quality/fif-zincir', () => ({
  kssKoltukKullanicilari: async () => [{ userId: 'uKss1', ad: 'KSS 1' }, { userId: 'uMudur', ad: 'Müdür (KSS da)' }],
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findMany: (...a: unknown[]) => fifFindMany(...a) },
    notification: { findFirst: (...a: unknown[]) => notificationFindFirst(...a) },
    user: {
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      findMany: async () => [],
    },
    departmentDefinition: { findUnique: async () => null },
  },
}))
import { POST } from './route'

const istek = (q = '') =>
  new NextRequest(`http://local/api/cron/fif-eskalasyon${q}`, { method: 'POST', headers: { 'x-cron-secret': 's3cret' } })

const gunOnce = (n: number) => new Date(Date.now() - n * 86400000)
const aday = (over: Record<string, unknown> = {}) => ({
  id: 'fif1', kayitNo: 'FIF-2026-007', sorumluBolumId: 'd1', sorumluOnaylayanUserId: 'uMudur', izlemeSorumlusuUserId: 'uIzleme',
  kokNedenAnalizi: null, kokNedenler: [], besNedenler: [], _count: { faaliyetler: 0 },
  gecmis: [{ createdAt: gunOnce(20) }],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cret'
  notificationFindFirst.mockResolvedValue(null)
  userFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) =>
    where.id ? { id: where.id, email: null, name: where.id, personnel: null } : null)
  bildir.mockResolvedValue({ inApp: true, push: 1, mail: 'gitti' })
  ustYonetim.mockResolvedValue({ userId: 'uGMY' })
})

/** 1. sorgu: termin eskalasyonu (boş); 2. sorgu: kök neden adayları. */
function adaylar(liste: unknown[]) {
  fifFindMany.mockImplementation(async ({ where }: { where: { durum: unknown } }) =>
    typeof where.durum === 'object' ? liste : [])
}

describe('FİF eskalasyon cron — Paket 4: kök neden / faaliyet planı 5 iş günü', () => {
  it('aday sorgusu: SORUMLU_ATAMA_BEKLIYOR + FAALIYET, KSS yönlendirmesi geçmişte olanlar', async () => {
    adaylar([])
    await POST(istek())
    const where = fifFindMany.mock.calls[1][0].where
    expect(where).toEqual({
      durum: { in: ['SORUMLU_ATAMA_BEKLIYOR', 'FAALIYET'] },
      gecmis: { some: { yeniDurum: 'SORUMLU_ATAMA_BEKLIYOR' } },
    })
  })
  it('süre dolmuş + kök neden boş → müdür + izleme + KSS; GMY/GM YOK; kişi başına tek; WARNING', async () => {
    adaylar([aday()])
    const r = await POST(istek())
    const j = await r.json()
    expect(j.kokNeden.bildirilen).toBe(1)
    expect(bildir.mock.calls.map((c) => c[0])).toEqual(['uMudur', 'uIzleme', 'uKss1'])
    const [, konu, govde, link, tip] = bildir.mock.calls[0]
    expect(konu).toBe('[FİF FIF-2026-007] Eskalasyon — kök neden / faaliyet planı 5 iş gününde tamamlanmadı')
    expect(govde).toContain('kök neden analizi ve faaliyet planı')
    expect(link).toBe('/kalite/fif/fif1')
    expect(tip).toBe('WARNING')
    expect(ustYonetim).not.toHaveBeenCalled()
  })
  it('kök neden dolu ama faaliyet yok → yine eskale', async () => {
    adaylar([aday({ kokNedenAnalizi: 'Kök neden' })])
    await POST(istek())
    expect(bildir).toHaveBeenCalled()
    expect(bildir.mock.calls[0][2]).toContain('faaliyet planı henüz')
  })
  it('kök neden dolu VE faaliyet var → eskale YOK', async () => {
    adaylar([aday({ kokNedenAnalizi: 'Kök neden', _count: { faaliyetler: 2 } })])
    const j = await (await POST(istek())).json()
    expect(j.kokNeden.bildirilen).toBe(0)
    expect(bildir).not.toHaveBeenCalled()
  })
  it('5 iş günü dolmadıysa eskale YOK', async () => {
    adaylar([aday({ gecmis: [{ createdAt: new Date() }] })])
    await POST(istek())
    expect(bildir).not.toHaveBeenCalled()
  })
  it('FİF başına TEK gönderim: aynı başlıklı bildirim varsa atlanır', async () => {
    adaylar([aday()])
    notificationFindFirst.mockResolvedValue({ id: 'n1' })
    const j = await (await POST(istek())).json()
    expect(j.kokNeden.atlanan).toBe(1)
    expect(bildir).not.toHaveBeenCalled()
    expect(notificationFindFirst).toHaveBeenCalledWith({
      where: { link: '/kalite/fif/fif1', title: '[FİF FIF-2026-007] Eskalasyon — kök neden / faaliyet planı 5 iş gününde tamamlanmadı' },
      select: { id: true },
    })
  })
  it('izleme sorumlusu yoksa (boşaltılmış) atlanır: müdür + KSS', async () => {
    adaylar([aday({ izlemeSorumlusuUserId: null })])
    await POST(istek())
    expect(bildir.mock.calls.map((c) => c[0])).toEqual(['uMudur', 'uKss1'])
  })
  it('dryRun: plan döner, bildirim gönderilmez', async () => {
    adaylar([aday()])
    const j = await (await POST(istek('?dryRun=1'))).json()
    expect(j.kokNeden.plan).toHaveLength(1)
    expect(bildir).not.toHaveBeenCalled()
  })
})
