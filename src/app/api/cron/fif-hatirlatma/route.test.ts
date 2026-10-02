import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * /api/cron/fif-hatirlatma — Paket 4: hedef tarih hatırlatmasının alıcıları.
 * Mevcut alıcılar (KSS + izleme sorumlusu + sorumlu bölüm müdürü) KALIR; hatırlatmaya
 * giren satırların UYGULAMA SORUMLULARI eklenir. Aynı kişiye tek bildirim.
 */

const fifFindMany = vi.fn()
const bildir = vi.fn()
const notificationFindFirst = vi.fn()

vi.mock('@/lib/quality/fif-bildirim', () => ({
  fifKullaniciyaBildir: (...a: unknown[]) => bildir(...a),
  fifBildirimKonusu: (_f: unknown, olay: string) => `[FİF X] ${olay}`,
}))
vi.mock('@/lib/quality/fif-zincir', () => ({ kssKoltukKullanicilari: async () => [{ userId: 'uKss', ad: 'KSS' }] }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findMany: (...a: unknown[]) => fifFindMany(...a) },
    departmentDefinition: { findUnique: async () => ({ mudurId: 'pMudur', mudurYardimcisiId: null }) },
    user: {
      findFirst: async ({ where }: { where: { id?: string; personnelId?: string } }) =>
        where.personnelId === 'pMudur' ? { id: 'uMudur' } : where.id ? { id: where.id } : null,
    },
    notification: { findFirst: (...a: unknown[]) => notificationFindFirst(...a) },
    fifFaaliyet: { findMany: async () => [] },
    fifEkTermin: { findMany: async () => [] },
  },
}))
import { POST } from './route'

const istek = () => new NextRequest('http://local/api/cron/fif-hatirlatma', { method: 'POST', headers: { 'x-cron-secret': 's3cret' } })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cret'
  notificationFindFirst.mockResolvedValue(null)
  bildir.mockResolvedValue({ inApp: true, push: 0, mail: 'gitti' })
})

describe('FİF hatırlatma cron — Paket 4: uygulama sorumluları da alıcı', () => {
  it('KSS + izleme + müdür + satır sorumluları; aynı kişiye tek bildirim', async () => {
    const gecmis = new Date(Date.now() - 2 * 86400000)
    fifFindMany.mockResolvedValue([{
      id: 'fif1', kayitNo: 'FIF-2026-007', izlemeSorumlusuUserId: 'uIzleme', sorumluBolumId: 'd1',
      faaliyetler: [
        { hedefTarih: gecmis, sorumluUserId: 'uSatir1' },
        { hedefTarih: gecmis, sorumluUserId: 'uSatir1' },
        { hedefTarih: gecmis, sorumluUserId: 'uIzleme' }, // izleme sorumlusu da satır sorumlusu
        { hedefTarih: gecmis, sorumluUserId: null },
      ],
    }])
    const j = await (await POST(istek())).json()
    expect(bildir.mock.calls.map((c) => c[0]).sort()).toEqual(['uIzleme', 'uKss', 'uMudur', 'uSatir1'])
    expect(j.hatirlatilan).toBe(4)
    expect(bildir.mock.calls[0][1]).toBe('[FİF X] Hedef tarih hatırlatma')
    // Sorgu satırın sorumlusunu da seçer.
    expect(fifFindMany.mock.calls[0][0].select.faaliyetler.select).toEqual({ hedefTarih: true, sorumluUserId: true })
  })
  it('bugün zaten hatırlatılan kişi atlanır (günlük dedup aynen)', async () => {
    fifFindMany.mockResolvedValue([{
      id: 'fif1', kayitNo: 'FIF-2026-007', izlemeSorumlusuUserId: null, sorumluBolumId: 'd1',
      faaliyetler: [{ hedefTarih: new Date(), sorumluUserId: 'uSatir1' }],
    }])
    notificationFindFirst.mockImplementation(async ({ where }: { where: { userId: string } }) => (where.userId === 'uSatir1' ? { id: 'n' } : null))
    await POST(istek())
    expect(bildir.mock.calls.map((c) => c[0]).sort()).toEqual(['uKss', 'uMudur'])
  })
})
