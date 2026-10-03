import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { BenzerPlakaHatasi } from '@/lib/servis-yonetimi/plaka'

// A6 — araç oluşturma/güncelleme uçları: benzer plaka 409 (+ onayla yeniden gönderim),
// biçim/aynı plaka 400, yetki (servis.tanim.manage), 401/403'te servis çağrılmaz.
const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServisArac: vi.fn(),
  updateServisArac: vi.fn(),
  listServisAraclar: vi.fn(),
}))

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: mocks.requirePermission }))
vi.mock('@/lib/prisma', () => ({ prisma: { servisArac: { findUnique: vi.fn() } } }))
vi.mock('@/lib/servis-yonetimi/service', () => ({
  createServisArac: mocks.createServisArac,
  updateServisArac: mocks.updateServisArac,
  listServisAraclar: mocks.listServisAraclar,
}))

import { POST as olustur } from './route'
import { PATCH as guncelle } from './[id]/route'

const BENZER = new BenzerPlakaHatasi([{ id: 'a1', plaka: '41P0145', aktif: true }])
const govde = { plaka: '41PO145', kapasite: 16, firmaId: 'f1' }
const istek = (g: unknown, method = 'POST') => new NextRequest('http://localhost/x', { method, body: JSON.stringify(g) })
const context = { params: Promise.resolve({ id: 'a1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requirePermission.mockResolvedValue({ error: null, userId: 'user-1' })
})

describe.each([
  { ad: 'POST /arac', cagir: (g: unknown) => olustur(istek(g)), servis: mocks.createServisArac },
  { ad: 'PATCH /arac/[id]', cagir: (g: unknown) => guncelle(istek(g, 'PATCH'), context), servis: mocks.updateServisArac },
])('$ad — plaka', ({ cagir, servis }) => {
  it('servis.tanim.manage istenir; 403 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }), userId: null })
    const res = await cagir(govde)
    expect(res.status).toBe(403)
    expect(mocks.requirePermission).toHaveBeenCalledWith('servis.tanim.manage')
    expect(servis).not.toHaveBeenCalled()
  })

  it('401 → servis çağrılmaz', async () => {
    mocks.requirePermission.mockResolvedValue({ error: NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 }), userId: null })
    expect((await cagir(govde)).status).toBe(401)
    expect(servis).not.toHaveBeenCalled()
  })

  it('🔴 benzer plaka: 409 + kod BENZER_PLAKA + "Benzer plaka var: 41P0145 — aynı araç mı?" + benzerler', async () => {
    servis.mockRejectedValue(BENZER)
    const res = await cagir(govde)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      ok: false,
      kod: 'BENZER_PLAKA',
      message: 'Benzer plaka var: 41P0145 — aynı araç mı?',
      benzerler: [{ plaka: '41P0145', aktif: true }],
    })
  })

  it('onay bayrağı gövdede AYNEN servise iletilir (benzerPlakaOnayi: true)', async () => {
    servis.mockResolvedValue({ id: 'a1' })
    await cagir({ ...govde, benzerPlakaOnayi: true })
    const form = servis.mock.calls[0].find((a: unknown) => typeof a === 'object' && a !== null && 'plaka' in (a as object))
    expect(form).toMatchObject({ plaka: '41PO145', benzerPlakaOnayi: true })
  })

  it('biçim hatası 400 + açık Türkçe mesaj (409 DEĞİL)', async () => {
    servis.mockRejectedValue(new Error('Geçersiz plaka biçimi: "99A123". Plaka il kodu (01-81), 1-3 harf ve 2-4 rakamdan oluşmalıdır (örn. 41P0145).'))
    const res = await cagir({ ...govde, plaka: '99A123' })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/Geçersiz plaka biçimi: "99A123"/)
  })

  it('aynı plaka (pasif) 400 + Geri Al önerisi', async () => {
    servis.mockRejectedValue(new Error('"41P0145" plakası pasif bir araç olarak kayıtlı. Yeni kayıt açmak yerine Geri Al ile etkinleştirin.'))
    const res = await cagir(govde)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('Geri Al ile etkinleştirin')
  })
})
