import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const guard = vi.fn(), find = vi.fn(), transaction = vi.fn(), dbDelete = vi.fn(), audit = vi.fn()
const read = vi.fn(), remove = vi.fn(), restore = vi.fn()
const lock = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...a: unknown[]) => guard(...a) }))
vi.mock('@/lib/prisma', () => ({ prisma: { yillikTakvimEk: { findUnique: (...a: unknown[]) => find(...a) }, $transaction: (...a: unknown[]) => transaction(...a) } }))
vi.mock('@/lib/yillik-calisma-takvimi/storage', () => ({ readStoredFile: (...a: unknown[]) => read(...a), removeStoredFile: (...a: unknown[]) => remove(...a), restoreStoredFile: (...a: unknown[]) => restore(...a) }))
import { DELETE } from './route'
const ctx = { params: Promise.resolve({ ekId: 'e1' }) }
const attachment = { id: 'e1', kayitId: 'r1', dosyaTuru: 'application/pdf', boyut: 100, saklamaYolu: 'r1/u.pdf', yukleyenId: 'uploader', kayit: { iptalMi: false, arsivMi: false, katilimcilar: [{ userId: 'owner' }] } }
beforeEach(() => { vi.clearAllMocks(); lock.mockResolvedValue([{ id: 'r1', durum: 'PLANLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }]); read.mockReset().mockResolvedValue(Buffer.from('data')); remove.mockReset().mockResolvedValue(undefined); restore.mockReset().mockResolvedValue(undefined); transaction.mockReset().mockImplementation(async cb => cb({ $queryRaw: lock, yillikTakvimEk: { findUnique: find, delete: dbDelete }, yillikTakvimIslemGecmisi: { create: audit } })) })
describe('ek delete', () => {
  it('yetkisizde 403 ve storage/DB yok', async () => { guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) }); expect((await DELETE({} as never, ctx)).status).toBe(403); expect(find).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled() })
  it('yükleyen/ana sorumlu/admin dışındaki kullanıcıyı engeller', async () => { guard.mockResolvedValue({ error: null, userId: 'other', session: { user: { permissions: [] } } }); find.mockResolvedValue(attachment); expect((await DELETE({} as never, ctx)).status).toBe(403); expect(remove).not.toHaveBeenCalled() })
  it('başarılı silmede önce fiziksel dosyayı, sonra DB/auditi işler', async () => { guard.mockResolvedValue({ error: null, userId: 'owner', session: { user: { permissions: [] } } }); find.mockResolvedValue(attachment); expect((await DELETE({} as never, ctx)).status).toBe(200); expect(remove).toHaveBeenCalledWith('r1/u.pdf'); expect(dbDelete).toHaveBeenCalledWith({ where: { id: 'e1' } }); expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'EK_SIL' }) }) })
  it('filesystem silme hatasında DB metadata tutar', async () => { guard.mockResolvedValue({ error: null, userId: 'owner', session: { user: { permissions: [] } } }); find.mockResolvedValue(attachment); remove.mockRejectedValue(new Error('disk')); expect((await DELETE({} as never, ctx)).status).toBe(500); expect(dbDelete).not.toHaveBeenCalled() })
  it('DB/audit hatasında fiziksel dosyayı geri yükler', async () => { guard.mockResolvedValue({ error: null, userId: 'owner', session: { user: { permissions: [] } } }); find.mockResolvedValue(attachment); audit.mockRejectedValue(new Error('db')); expect((await DELETE({} as never, ctx)).status).toBe(500); expect(restore).toHaveBeenCalledWith('r1/u.pdf', expect.any(Buffer)) })
  it('lock sonrası terminal state fiziksel dosyayı ve metadatayı korur', async () => { guard.mockResolvedValue({ error: null, userId: 'owner', session: { user: { permissions: [] } } }); find.mockResolvedValue(attachment); lock.mockResolvedValue([{ id: 'r1', durum: 'ONAYLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }]); expect((await DELETE({} as never, ctx)).status).toBe(409); expect(remove).not.toHaveBeenCalled(); expect(dbDelete).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled() })
})
