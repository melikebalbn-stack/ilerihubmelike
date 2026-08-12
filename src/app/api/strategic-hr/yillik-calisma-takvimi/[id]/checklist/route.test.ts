import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const guard = vi.fn(), recordFind = vi.fn(), list = vi.fn(), userFind = vi.fn(), transaction = vi.fn()
const aggregate = vi.fn(), create = vi.fn(), audit = vi.fn()
const lock = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => guard(...a) }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  yillikTakvimKaydi: { findUnique: (...a: unknown[]) => recordFind(...a) },
  yillikTakvimChecklist: { findMany: (...a: unknown[]) => list(...a) }, user: { findFirst: (...a: unknown[]) => userFind(...a) },
  $transaction: (...a: unknown[]) => transaction(...a),
} }))
import { GET, POST } from './route'
const ctx = { params: Promise.resolve({ id: 'r1' }) }
const req = (body?: unknown) => new NextRequest('http://local/checklist', { method: body ? 'POST' : 'GET', ...(body && { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) })
beforeEach(() => { vi.clearAllMocks(); lock.mockResolvedValue([{ id: 'r1', durum: 'PLANLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }]); transaction.mockImplementation(async cb => cb({ $queryRaw: lock, yillikTakvimKaydi: { findUnique: recordFind }, yillikTakvimChecklist: { aggregate, create }, yillikTakvimIslemGecmisi: { create: audit } })); aggregate.mockResolvedValue({ _max: { sira: 0 } }); create.mockResolvedValue({ id: 'c1' }) })
describe('checklist collection', () => {
  it('yetkisiz yazmada 403 ve DB yok', async () => { guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) }); expect((await POST(req({ baslik: 'A' }), ctx)).status).toBe(403); expect(recordFind).not.toHaveBeenCalled() })
  it('view ile liste döner', async () => { guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: [] } } }); recordFind.mockResolvedValue({ id: 'r1', _count: { ekler: 0 } }); list.mockResolvedValue([]); expect((await GET(req(), ctx)).status).toBe(200) })
  it('invalid payloadı DB öncesi reddeder', async () => { guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: [] } } }); expect((await POST(req({ baslik: '' }), ctx)).status).toBe(400); expect(recordFind).not.toHaveBeenCalled() })
  it('ana sorumlu edit ile atomik ekleme/audit yapar', async () => { guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: ['yilliktakvim.edit'] } } }); recordFind.mockResolvedValue({ id: 'r1', iptalMi: false, arsivMi: false, katilimcilar: [{ userId: 'u1' }] }); expect((await POST(req({ baslik: 'Madde' }), ctx)).status).toBe(201); expect(create).toHaveBeenCalled(); expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'CHECKLIST_EKLE' }) }) })
  it('ana sorumlu olmayan edit kullanıcısını engeller', async () => { guard.mockResolvedValue({ error: null, userId: 'u2', session: { user: { permissions: ['yilliktakvim.edit'] } } }); recordFind.mockResolvedValue({ id: 'r1', iptalMi: false, arsivMi: false, katilimcilar: [{ userId: 'u1' }] }); expect((await POST(req({ baslik: 'Madde' }), ctx)).status).toBe(403); expect(transaction).not.toHaveBeenCalled() })
  it('audit hatasında transaction hatası olarak 500 döner', async () => { guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: ['yilliktakvim.edit'] } } }); recordFind.mockResolvedValue({ id: 'r1', iptalMi: false, arsivMi: false, katilimcilar: [{ userId: 'u1' }] }); audit.mockRejectedValue(new Error('audit failed')); expect((await POST(req({ baslik: 'Madde' }), ctx)).status).toBe(500); expect(transaction).toHaveBeenCalledOnce() })
})
