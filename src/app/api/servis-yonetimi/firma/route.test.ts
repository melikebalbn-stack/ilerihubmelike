import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listServisFirmalar: vi.fn(),
  createServisFirma: vi.fn(),
}))

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: mocks.requireSession,
}))

vi.mock('@/lib/servis-yonetimi/service', () => ({
  listServisFirmalar: mocks.listServisFirmalar,
  createServisFirma: mocks.createServisFirma,
}))

import { GET, POST } from './route'

function sessionWith(permissions: string[]) {
  return {
    session: { user: { id: 'u1', permissions } },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/servis-yonetimi/firma — permission guard', () => {
  it('servis.view izni olmayan kullanıcı 403 alır', async () => {
    mocks.requireSession.mockResolvedValue(sessionWith([]))
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/firma'))
    expect(res.status).toBe(403)
    expect(mocks.listServisFirmalar).not.toHaveBeenCalled()
  })

  it('servis.view izni olan kullanıcı listeyi görür', async () => {
    mocks.requireSession.mockResolvedValue(sessionWith(['servis.view']))
    mocks.listServisFirmalar.mockResolvedValue([{ id: '1', ad: 'ABC' }])
    const res = await GET(new NextRequest('http://localhost/api/servis-yonetimi/firma'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.toplam).toBe(1)
  })
})

describe('POST /api/servis-yonetimi/firma — permission guard', () => {
  it('servis.tanim.manage izni olmayan (yalnız servis.view) kullanıcı 403 alır', async () => {
    mocks.requireSession.mockResolvedValue(sessionWith(['servis.view']))
    const res = await POST(
      new NextRequest('http://localhost/api/servis-yonetimi/firma', {
        method: 'POST',
        body: JSON.stringify({ ad: 'Yeni Firma' }),
      })
    )
    expect(res.status).toBe(403)
    expect(mocks.createServisFirma).not.toHaveBeenCalled()
  })

  it('servis.tanim.manage izni olan kullanıcı firma oluşturabilir', async () => {
    mocks.requireSession.mockResolvedValue(sessionWith(['servis.tanim.manage']))
    mocks.createServisFirma.mockResolvedValue({ id: '1', ad: 'Yeni Firma' })
    const res = await POST(
      new NextRequest('http://localhost/api/servis-yonetimi/firma', {
        method: 'POST',
        body: JSON.stringify({ ad: 'Yeni Firma' }),
      })
    )
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.ad).toBe('Yeni Firma')
  })
})
