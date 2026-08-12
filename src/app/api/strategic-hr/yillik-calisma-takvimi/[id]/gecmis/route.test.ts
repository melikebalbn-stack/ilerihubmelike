import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const guard = vi.fn(), recordFind = vi.fn(), historyFind = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => guard(...a) }))
vi.mock('@/lib/prisma', () => ({ prisma: { yillikTakvimKaydi: { findUnique: (...a: unknown[]) => recordFind(...a) }, yillikTakvimIslemGecmisi: { findMany: (...a: unknown[]) => historyFind(...a) } } }))
import { GET } from './route'
const context = { params: Promise.resolve({ id: 'r1' }) }, request = new NextRequest('http://local/gecmis')
beforeEach(() => vi.clearAllMocks())
describe('işlem geçmişi GET', () => {
  it('yetkisiz istekte 403 ve DB yok', async () => { guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) }); expect((await GET(request, context)).status).toBe(403); expect(recordFind).not.toHaveBeenCalled() })
  it('olmayan kayıt için 404', async () => { guard.mockResolvedValue({ error: null }); recordFind.mockResolvedValue(null); expect((await GET(request, context)).status).toBe(404); expect(historyFind).not.toHaveBeenCalled() })
  it('view/admin ile en yeni sıralı ve yalnız güvenli User adı seçer', async () => { guard.mockResolvedValue({ error: null }); recordFind.mockResolvedValue({ id: 'r1' }); historyFind.mockResolvedValue([{ islemTuru: 'GUNCELLE', alan: 'kayit', eskiDeger: null, yeniDeger: '{"degisenAlanlar":["aciklama"]}', createdAt: new Date('2026-08-09T10:00:00Z'), yapan: { name: 'Kullanıcı' } }]); const response = await GET(request, context); expect(response.status).toBe(200); expect(historyFind.mock.calls[0][0]).toMatchObject({ orderBy: { createdAt: 'desc' }, select: { yapan: { select: { name: true } } } }); expect(await response.json()).toMatchObject({ data: [{ actorName: 'Kullanıcı', label: 'Kayıt güncellendi' }] }) })
  it('raw metadata, e-posta ve storage path sızdırmaz', async () => { guard.mockResolvedValue({ error: null }); recordFind.mockResolvedValue({ id: 'r1' }); historyFind.mockResolvedValue([{ islemTuru: 'ESKI', alan: 'email', eskiDeger: 'a@b.com', yeniDeger: '{"saklamaYolu":"/secret","email":"x@y.com"}', createdAt: new Date(), yapan: { name: null } }]); const text = JSON.stringify(await (await GET(request, context)).json()); expect(text).not.toMatch(/a@b|x@y|saklamaYolu|secret/) })
})
