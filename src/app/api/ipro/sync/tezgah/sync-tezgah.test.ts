/**
 * POST /api/ipro/sync/tezgah — Melike #15 elle senkron wrapper.
 * requirePermission + tezgahSenkronu MOCK'lu (cron/lib'e dokunmadan guard + özet + hata yolu).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => requirePermissionMock(...a) }))

const tezgahSenkronuMock = vi.fn()
vi.mock('@/lib/ipro/tezgah-sync', () => ({ tezgahSenkronu: (...a: unknown[]) => tezgahSenkronuMock(...a) }))

import { POST } from '@/app/api/ipro/sync/tezgah/route'

const RED = { error: NextResponse.json({ error: 'yetkisiz' }, { status: 403 }) }

beforeEach(() => {
  requirePermissionMock.mockReset()
  tezgahSenkronuMock.mockReset()
})

describe('sync/tezgah route', () => {
  it('ipro.admin İSTER; guard reddederse 403 ve tezgahSenkronu ÇAĞRILMAZ', async () => {
    requirePermissionMock.mockResolvedValue(RED)
    const r = await POST()
    expect(r.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith('ipro.admin')
    expect(tezgahSenkronuMock).not.toHaveBeenCalled()
  })

  it('yetkili → sync koşar, özet döner (ok:true + taranan/eklenen/guncellenen)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    tezgahSenkronuMock.mockResolvedValue({
      taranan: 214, eklenen: 3, guncellenen: 5, atlanan: 0, hatalilar: [], mukerrerRidler: [],
    })
    const r = await POST()
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.ok).toBe(true)
    expect(d.eklenen).toBe(3)
    expect(d.guncellenen).toBe(5)
    expect(d.taranan).toBe(214)
    expect(tezgahSenkronuMock).toHaveBeenCalledTimes(1)
  })

  it('sync hata fırlatır → 500 + ok:false (bloklamaz, mantık lib’de)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    tezgahSenkronuMock.mockRejectedValue(new Error('IFS erişilemedi'))
    const r = await POST()
    expect(r.status).toBe(500)
    const d = await r.json()
    expect(d.ok).toBe(false)
    expect(d.error).toContain('IFS')
  })
})
