import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const guard = vi.fn(), find = vi.fn(), read = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => guard(...a) }))
vi.mock('@/lib/prisma', () => ({ prisma: { yillikTakvimEk: { findUnique: (...a: unknown[]) => find(...a) } } }))
vi.mock('@/lib/yillik-calisma-takvimi/storage', () => ({ readStoredFile: (...a: unknown[]) => read(...a) }))
import { GET } from './route'
const ctx = { params: Promise.resolve({ ekId: 'e1' }) }, req = new NextRequest('http://local/download')
beforeEach(() => vi.clearAllMocks())
describe('ek download', () => {
  it('yetkisizde 403 ve DB yok', async () => { guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) }); expect((await GET(req, ctx)).status).toBe(403); expect(find).not.toHaveBeenCalled() })
  it('olmayan ekte 404', async () => { guard.mockResolvedValue({ error: null }); find.mockResolvedValue(null); expect((await GET(req, ctx)).status).toBe(404) })
  it('root dışı/geçersiz storage yolunu engeller', async () => { guard.mockResolvedValue({ error: null }); find.mockResolvedValue({ id: 'e1', dosyaAdi: 'a.pdf', dosyaTuru: 'application/pdf', saklamaYolu: '../a.pdf', kayit: { id: 'r1' } }); read.mockRejectedValue(new Error('Geçersiz storage yolu')); expect((await GET(req, ctx)).status).toBe(400) })
  it('güvenli headerlarla ve path sızdırmadan indirir', async () => { guard.mockResolvedValue({ error: null }); find.mockResolvedValue({ id: 'e1', dosyaAdi: 'kanıt.pdf', dosyaTuru: 'application/pdf', saklamaYolu: 'r1/u.pdf', kayit: { id: 'r1' } }); read.mockResolvedValue(Buffer.from('%PDF')); const response = await GET(req, ctx); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('content-disposition')).toContain('attachment'); expect([...response.headers.values()].join(' ')).not.toContain('r1/u.pdf') })
})
