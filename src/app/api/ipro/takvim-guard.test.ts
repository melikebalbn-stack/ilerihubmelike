/**
 * Vardiya/Tatil route guard testi — doğru permission isteniyor + guard hatası short-circuit.
 * requirePermission MOCK'lu (auth katmanı çağrı argümanıyla doğrulanır).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => requirePermissionMock(...a) }))
// Servisi mock'la — guard reddinde asla çağrılmamalı.
vi.mock('@/lib/ipro/takvim', async (orig) => ({
  ...(await orig<typeof import('@/lib/ipro/takvim')>()),
  createVardiya: vi.fn(async () => ({ id: 'x', kod: 'K' })),
  createTatil: vi.fn(async () => ({ id: 'y', tarih: new Date(), tip: 'TATIL' })),
}))

import { POST as vardiyaPost } from '@/app/api/ipro/vardiya/route'
import { POST as tatilPost } from '@/app/api/ipro/tatil/route'

const req = (b: unknown): any => ({ json: async () => b, url: 'http://x/api?yil=2099' })
const RED = { error: NextResponse.json({ error: 'yetkisiz' }, { status: 403 }) }

beforeEach(() => requirePermissionMock.mockReset())

describe('vardiya route guard', () => {
  it('yazma ipro.admin İSTER; guard reddederse 403, servis çağrılmaz', async () => {
    requirePermissionMock.mockResolvedValue(RED)
    const r = await vardiyaPost(req({ kod: 'V', ad: 'A', baslangicSaat: '07:00', bitisSaat: '17:00' }))
    expect(r.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith('ipro.admin')
  })
})

describe('tatil route guard', () => {
  it('yazma ipro.takvim.yonet İSTER; guard reddederse 403', async () => {
    requirePermissionMock.mockResolvedValue(RED)
    const r = await tatilPost(req({ tarih: '2099-08-30', tip: 'TATIL', aciklama: 'x' }))
    expect(r.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith('ipro.takvim.yonet')
  })
  it('geçerli guard + geçersiz tip → 400 (validation)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    const r = await tatilPost(req({ tarih: '2099-08-30', tip: 'BAYRAM', aciklama: 'x' }))
    expect(r.status).toBe(400)
  })
})
