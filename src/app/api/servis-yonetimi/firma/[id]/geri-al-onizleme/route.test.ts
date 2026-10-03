import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), firmaGeriAlOnizleme: vi.fn() }))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/servis-yonetimi/service', () => ({ firmaGeriAlOnizleme: mocks.firmaGeriAlOnizleme }))

import { GET } from './route'

const context = { params: Promise.resolve({ id: 'f1' }) }
beforeEach(() => vi.clearAllMocks())

describe('GET /api/servis-yonetimi/firma/[id]/geri-al-onizleme', () => {
  it('servis.restore ister (ilk ifade); 403 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }), userId: null })
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.restore')
    expect(mocks.firmaGeriAlOnizleme).not.toHaveBeenCalled()
  })

  it('401 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }), userId: null })
    expect((await GET(new NextRequest('http://localhost/x'), context)).status).toBe(401)
    expect(mocks.firmaGeriAlOnizleme).not.toHaveBeenCalled()
  })

  it('önizlemeyi döner', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'u' })
    const onizleme = { zincirIslemId: 'z1', geriAlinabilirArac: 3, geriAlinabilirSofor: 1, kapananAtama: 4 }
    mocks.firmaGeriAlOnizleme.mockResolvedValue(onizleme)
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, data: onizleme })
    expect(mocks.firmaGeriAlOnizleme).toHaveBeenCalledWith('f1')
  })

  it('servis hatası 400 + Türkçe mesaj (ör. firma zaten aktif)', async () => {
    mocks.requirePermission.mockResolvedValue({ error: null, userId: 'u' })
    mocks.firmaGeriAlOnizleme.mockRejectedValue(new Error('Firma zaten aktif.'))
    const res = await GET(new NextRequest('http://localhost/x'), context)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Firma zaten aktif.')
  })
})
