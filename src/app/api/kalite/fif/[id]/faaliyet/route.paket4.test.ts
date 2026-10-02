import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * DELETE /api/kalite/fif/[id]/faaliyet?faaliyetId= — Paket 4: ek termin geçmişi
 * (onay/red/iptal dahil, her durumda) olan satır silinemez → 400; paraflı satır kuralı aynen.
 * DB'de FifEkTermin → FifFaaliyet FK'si RESTRICT (ikinci bekçi).
 */

const fifFindUnique = vi.fn()
const faaliyetFindFirst = vi.fn()
const transaction = vi.fn()
const faaliyetDelete = vi.fn()

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: async () => ({ session: { user: { id: 'uIzleme' } }, userId: 'uIzleme', error: null }),
}))
vi.mock('@/lib/quality/fif-access', () => ({
  fifDuzenleyebilirMi: async () => true,
  canManageFif: () => false,
  isFifKss: async () => false,
}))
vi.mock('@/lib/quality/fif-bildirim', () => ({ fifFaaliyetAtamaBildir: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findUnique: (...a: unknown[]) => fifFindUnique(...a) },
    fifFaaliyet: { findFirst: (...a: unknown[]) => faaliyetFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}))
import { DELETE } from './route'

const tx = { fifFaaliyet: { delete: faaliyetDelete }, fif: { update: vi.fn() } }
const ctx = { params: Promise.resolve({ id: 'fif1' }) }
const istek = () => new NextRequest('http://local/api/kalite/fif/fif1/faaliyet?faaliyetId=f1', { method: 'DELETE' })

beforeEach(() => {
  vi.clearAllMocks()
  fifFindUnique.mockResolvedValue({
    id: 'fif1', kayitNo: 'FIF-2026-007', durum: 'FAALIYET', createdById: 'uAcan', hazirlayanUserId: 'uAcan',
    sorumluBolumId: 'd1', yayinlayanBolumId: 'd2', izlemeSorumlusuUserId: 'uIzleme',
    sorumluOnaylayanUserId: 'uMudur', kokNedenAnalizi: 'Kök neden', kokNedenler: [], besNedenler: [],
  })
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
})

describe('FİF faaliyet DELETE — Paket 4: ek termin geçmişi', () => {
  it('ek termin kaydı olan satır → 400 "Ek termin geçmişi olan faaliyet silinemez.", silme yok', async () => {
    faaliyetFindFirst.mockResolvedValue({ id: 'f1', parafUserId: null, _count: { ekTerminler: 1 } })
    const r = await DELETE(istek(), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Ek termin geçmişi olan faaliyet silinemez.')
    expect(faaliyetDelete).not.toHaveBeenCalled()
    // Sayım sorgusu tüm durumları kapsar (durum filtresi YOK).
    expect(faaliyetFindFirst.mock.calls[0][0].select._count).toEqual({ select: { ekTerminler: true } })
  })
  it('ek termini olmayan parafsız satır silinir', async () => {
    faaliyetFindFirst.mockResolvedValue({ id: 'f1', parafUserId: null, _count: { ekTerminler: 0 } })
    expect((await DELETE(istek(), ctx)).status).toBe(200)
    expect(faaliyetDelete).toHaveBeenCalledWith({ where: { id: 'f1' } })
  })
  it('paraflı satır kuralı aynen (400 "Paraflı faaliyet silinemez")', async () => {
    faaliyetFindFirst.mockResolvedValue({ id: 'f1', parafUserId: 'uKss', _count: { ekTerminler: 0 } })
    const r = await DELETE(istek(), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Paraflı faaliyet silinemez')
  })
})
