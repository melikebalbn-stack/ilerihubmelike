import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma'

const guard = vi.fn(), transaction = vi.fn(), lock = vi.fn(), find = vi.fn(), create = vi.fn(), audit = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => guard(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (...args: unknown[]) => transaction(...args) } }))

import { POST } from './route'

const request = new NextRequest('http://local/sonraki-donem', { method: 'POST' })
const context = { params: Promise.resolve({ id: 'old-1' }) }
const record = {
  id: 'old-1', yil: 2026, anaKonu: 'İSG', surec: 'Periyodik kontrol', departmentId: 'd1',
  oncelik: 'YUKSEK', periyot: 'YILLIK', kayitTuru: 'KONTROL', durum: 'ONAYLANDI',
  iptalMi: false, arsivMi: false, createdById: 'owner', nihaiSonTarih: new Date('2026-12-15T00:00:00Z'),
  plananUygulamaTarihi: new Date('2026-12-01T00:00:00Z'), gecerlilikBaslangici: null,
  katilimcilar: [{ userId: 'owner', rol: 'ANA_SORUMLU' }],
  bildirimKurallari: [{ tetik: 'gun_kala:7', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'], aktif: true }],
  checklist: [{ baslik: 'Kontrol et', aciklama: null, sira: 1, sorumluId: 'owner', zorunlu: true, kanitGerekli: true }],
  sonrakiKayitlar: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  lock.mockResolvedValue([{ id: 'old-1', durum: 'ONAYLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }])
  guard.mockResolvedValue({ error: null, userId: 'owner', session: { user: { permissions: ['yilliktakvim.view'] } } })
  find.mockResolvedValue(record)
  create.mockResolvedValue({ id: 'new-1', yil: 2027, durum: 'PLANLANDI' })
  transaction.mockImplementation(async callback => callback({
    $queryRaw: lock,
    yillikTakvimKaydi: { findUnique: find, create },
    yillikTakvimIslemGecmisi: { create: audit },
  }))
})

describe('sonraki dönem oluşturma', () => {
  it('yetki guardı reddederse DB erişimi yapmaz', async () => {
    guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    expect((await POST(request, context)).status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('ana sorumlu için kaydı ve iki taraflı audit geçmişini atomik oluşturur', async () => {
    const response = await POST(request, context)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, id: 'new-1', yil: 2027, durum: 'PLANLANDI' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      oncekiKayitId: 'old-1', createdById: 'owner', durum: 'PLANLANDI',
      nihaiSonTarih: new Date('2027-12-15T00:00:00Z'),
      katilimcilar: { create: [{ userId: 'owner', rol: 'ANA_SORUMLU' }] },
      checklist: { create: [expect.objectContaining({ baslik: 'Kontrol et', tamamlandi: false })] },
    }) }))
    expect(audit).toHaveBeenCalledTimes(2)
    expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ kayitId: 'old-1', islemTuru: 'SONRAKI_DONEM_OLUSTURULDU' }) })
    expect(audit).toHaveBeenCalledWith({ data: expect.objectContaining({ kayitId: 'new-1', islemTuru: 'SONRAKI_DONEM_OLUSTURULDU' }) })
  })

  it('ana sorumlu veya oluşturan olmayan kullanıcıyı 403 ile reddeder', async () => {
    guard.mockResolvedValue({ error: null, userId: 'other', session: { user: { permissions: ['yilliktakvim.view'] } } })
    expect((await POST(request, context)).status).toBe(403)
    expect(create).not.toHaveBeenCalled()
  })

  it('ONAYLANDI olmayan kaydı 409 ile reddeder', async () => {
    find.mockResolvedValue({ ...record, durum: 'PLANLANDI' })
    expect((await POST(request, context)).status).toBe(409)
    expect(create).not.toHaveBeenCalled()
  })

  it('aktif sonraki kayıt varsa 409 ile reddeder', async () => {
    find.mockResolvedValue({ ...record, sonrakiKayitlar: [{ id: 'existing-next' }] })
    const response = await POST(request, context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Bu kayıt için zaten aktif bir sonraki dönem mevcut' })
    expect(create).not.toHaveBeenCalled()
  })

  it('admin sahibinden bağımsız oluşturabilir', async () => {
    guard.mockResolvedValue({ error: null, userId: 'admin', session: { user: { permissions: ['yilliktakvim.admin'] } } })
    expect((await POST(request, context)).status).toBe(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: 'admin' }) }))
  })

  it('serialization yarışını kontrollü 409 olarak döndürür', async () => {
    transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('serialization', { code: 'P2034', clientVersion: 'test' }))
    expect((await POST(request, context)).status).toBe(409)
  })
})
