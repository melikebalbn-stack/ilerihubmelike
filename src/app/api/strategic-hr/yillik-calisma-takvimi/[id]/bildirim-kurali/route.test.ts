import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const guard = vi.fn(), recordFind = vi.fn(), rulesFind = vi.fn(), ruleCreate = vi.fn(), auditCreate = vi.fn(), transaction = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => guard(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  yillikTakvimKaydi: { findUnique: (...args: unknown[]) => recordFind(...args) },
  yillikTakvimBildirimKurali: { findMany: (...args: unknown[]) => rulesFind(...args) },
  $transaction: (...args: unknown[]) => transaction(...args),
} }))
import { GET, POST } from './route'
const ctx = { params: Promise.resolve({ id: 'record-1' }) }
const request = (body: unknown) => new NextRequest('http://local/rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const tx = { yillikTakvimBildirimKurali: { create: ruleCreate }, yillikTakvimIslemGecmisi: { create: auditCreate } }
beforeEach(() => { vi.clearAllMocks(); transaction.mockImplementation(callback => callback(tx)); recordFind.mockResolvedValue({ id: 'record-1', iptalMi: false, arsivMi: false }); ruleCreate.mockResolvedValue({ id: 'rule-1', tetik: 'gun_kala:15' }) })
describe('Bildirim kuralı collection route', () => {
  it('yetkisiz mutationda DB erişmez ve view permission create açmaz', async () => {
    guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    expect((await POST(request({ tetik: 'son_gun', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'] }), ctx)).status).toBe(403)
    expect(guard).toHaveBeenCalledWith(['yilliktakvim.notification.manage', 'yilliktakvim.admin']); expect(recordFind).not.toHaveBeenCalled()
  })
  it('geçersiz payloadı DB öncesi reddeder', async () => {
    guard.mockResolvedValue({ error: null, userId: 'actor' })
    expect((await POST(request({ tetik: 'yarin', aliciRoller: [], kanal: [] }), ctx)).status).toBe(400); expect(recordFind).not.toHaveBeenCalled()
  })
  it('manage izniyle transaction içinde oluşturur ve audit yazar', async () => {
    guard.mockResolvedValue({ error: null, userId: 'actor' })
    expect((await POST(request({ tetik: 'gun_kala:15', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'] }), ctx)).status).toBe(201)
    expect(ruleCreate).toHaveBeenCalled(); expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'BILDIRIM_KURALI_EKLE' }) })
  })
  it('iptal ve arşiv kaydında mutationı engeller', async () => {
    guard.mockResolvedValue({ error: null, userId: 'actor' }); recordFind.mockResolvedValue({ id: 'record-1', iptalMi: true, arsivMi: false })
    expect((await POST(request({ tetik: 'son_gun', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'] }), ctx)).status).toBe(400); expect(transaction).not.toHaveBeenCalled()
  })
  it('GET yalnız view/admin ile çalışır', async () => {
    guard.mockResolvedValue({ error: null }); rulesFind.mockResolvedValue([])
    expect((await GET(new NextRequest('http://local/rules'), ctx)).status).toBe(200); expect(guard).toHaveBeenCalledWith(['yilliktakvim.view', 'yilliktakvim.admin'])
  })
})
