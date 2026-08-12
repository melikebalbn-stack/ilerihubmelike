/**
 * POST /api/ipro/yonetim/operator-eslemeleri/toplu — guard + validation (mock).
 * requirePermission + service MOCK'lu → DB'ye dokunmadan guard/400/özet yolu.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => requirePermissionMock(...a) }))

const topluMock = vi.fn()
const adaylarMock = vi.fn()
vi.mock('@/lib/ipro/yonetim-service', () => ({
  topluOperatorEsleme: (...a: unknown[]) => topluMock(...a),
  eklenebilirOperatorler: (...a: unknown[]) => adaylarMock(...a),
}))

import { POST } from '@/app/api/ipro/yonetim/operator-eslemeleri/toplu/route'

const req = (b: unknown): any => ({ json: async () => b, url: 'http://x/api' })
const RED = { error: NextResponse.json({ error: 'yetkisiz' }, { status: 403 }) }

beforeEach(() => {
  requirePermissionMock.mockReset()
  topluMock.mockReset()
})

describe('toplu operator-esleme route', () => {
  it('ipro.admin İSTER; guard reddederse 403 ve servis ÇAĞRILMAZ', async () => {
    requirePermissionMock.mockResolvedValue(RED)
    const r = await POST(req({ tezgahId: 't1', personnelIds: ['p1'] }))
    expect(r.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith('ipro.admin')
    expect(topluMock).not.toHaveBeenCalled()
  })

  it('personnelIds boş → 400 (servis çağrılmaz)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    const r = await POST(req({ tezgahId: 't1', personnelIds: [] }))
    expect(r.status).toBe(400)
    expect(topluMock).not.toHaveBeenCalled()
  })

  it('tezgahId yok → 400 (zorunlu alan)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    const r = await POST(req({ personnelIds: ['p1'] }))
    expect(r.status).toBe(400)
  })

  it('yetkili + geçerli → özet döner (ok:true + eklenen/reaktiveEdilen)', async () => {
    requirePermissionMock.mockResolvedValue({ userId: 'u1', error: null })
    topluMock.mockResolvedValue({ eklenen: 2, reaktiveEdilen: 1, zatenAktif: 0, toplam: 3 })
    const r = await POST(req({ tezgahId: 't1', personnelIds: ['p1', 'p2', 'p3'] }))
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.ok).toBe(true)
    expect(d.eklenen).toBe(2)
    expect(d.reaktiveEdilen).toBe(1)
    expect(topluMock).toHaveBeenCalledWith('t1', ['p1', 'p2', 'p3'])
  })
})
