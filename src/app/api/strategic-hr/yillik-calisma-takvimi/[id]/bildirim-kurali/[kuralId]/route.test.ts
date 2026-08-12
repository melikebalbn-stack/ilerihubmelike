import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const guard = vi.fn(), find = vi.fn(), update = vi.fn(), remove = vi.fn(), audit = vi.fn(), transaction = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => guard(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: { yillikTakvimBildirimKurali: { findFirst: (...args: unknown[]) => find(...args) }, $transaction: (...args: unknown[]) => transaction(...args) } }))
import { DELETE, PATCH } from './route'
const ctx = { params: Promise.resolve({ id: 'record-1', kuralId: 'rule-1' }) }
const request = (body: unknown) => new NextRequest('http://local/rule', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const tx = { yillikTakvimBildirimKurali: { update, delete: remove }, yillikTakvimIslemGecmisi: { create: audit } }
beforeEach(() => { vi.clearAllMocks(); transaction.mockImplementation(callback => callback(tx)); find.mockResolvedValue({ id: 'rule-1', kayitId: 'record-1', tetik: 'son_gun', aktif: true, kayit: { iptalMi: false, arsivMi: false } }); update.mockResolvedValue({ id: 'rule-1', aktif: false }) })
describe('Bildirim kuralı item route', () => {
  it('yetkisizi DB öncesi reddeder', async () => { guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) }); expect((await PATCH(request({ aktif: false }), ctx)).status).toBe(403); expect(find).not.toHaveBeenCalled() })
  it('notification.manage ile günceller ve audit yazar', async () => { guard.mockResolvedValue({ error: null, userId: 'actor' }); expect((await PATCH(request({ aktif: false }), ctx)).status).toBe(200); expect(update).toHaveBeenCalled(); expect(audit).toHaveBeenCalled() })
  it('başka kayda ait kuralı 404 kabul eder', async () => { guard.mockResolvedValue({ error: null, userId: 'actor' }); find.mockResolvedValue(null); expect((await DELETE(new NextRequest('http://local/rule', { method: 'DELETE' }), ctx)).status).toBe(404); expect(remove).not.toHaveBeenCalled() })
  it('iptal kayıttan kural silmez', async () => { guard.mockResolvedValue({ error: null, userId: 'actor' }); find.mockResolvedValue({ id: 'rule-1', tetik: 'son_gun', kayit: { iptalMi: true, arsivMi: false } }); expect((await DELETE(new NextRequest('http://local/rule', { method: 'DELETE' }), ctx)).status).toBe(400); expect(transaction).not.toHaveBeenCalled() })
  it('silme ve audit aynı transaction içinde çalışır', async () => { guard.mockResolvedValue({ error: null, userId: 'actor' }); expect((await DELETE(new NextRequest('http://local/rule', { method: 'DELETE' }), ctx)).status).toBe(200); expect(remove).toHaveBeenCalled(); expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'BILDIRIM_KURALI_SIL' }) }) })
})
