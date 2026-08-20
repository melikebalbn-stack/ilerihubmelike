import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
const findUniqueMock = vi.fn()
const departmentFindFirstMock = vi.fn()
const userFindFirstMock = vi.fn()
const userFindManyMock = vi.fn()
const recordUpdateMock = vi.fn()
const participantUpdateMock = vi.fn()
const participantCreateMock = vi.fn()
const participantDeleteMock = vi.fn()
const participantDeleteManyMock = vi.fn()
const participantCreateManyMock = vi.fn()
const auditCreateMock = vi.fn()
const transactionMock = vi.fn()
const lockMock = vi.fn()

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => requirePermissionMock(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  yillikTakvimKaydi: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  department: { findFirst: (...args: unknown[]) => departmentFindFirstMock(...args) },
  user: { findFirst: (...args: unknown[]) => userFindFirstMock(...args), findMany: (...args: unknown[]) => userFindManyMock(...args) },
  $transaction: (...args: unknown[]) => transactionMock(...args),
} }))

import { DELETE, GET, PATCH } from './route'

const context = { params: Promise.resolve({ id: 'kayit-1' }) }
const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi/kayit-1', {
  method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
})
const existing = {
  id: 'kayit-1', yil: 2026, anaKonu: 'İV', surec: 'Eski süreç', kisaBaslik: null,
  aciklama: null, departmentId: 'dept-1', periyot: 'YILLIK', oncelik: 'ORTA',
  nihaiSonTarih: new Date('2026-12-15T00:00:00.000Z'), plananUygulamaTarihi: null,
  disKurum: null, gerceklesmeDurumu: 'BEKLIYOR', gerceklesmeTarihi: null,
  gerceklesmemeNedeni: null, kaynakModul: null, iptalMi: false, arsivMi: false,
  katilimcilar: [{ id: 'kat-1', userId: 'user-old', rol: 'ANA_SORUMLU' }],
}

beforeEach(() => {
  for (const mock of [requirePermissionMock, findUniqueMock, departmentFindFirstMock, userFindFirstMock, userFindManyMock, recordUpdateMock, participantUpdateMock, participantCreateMock, participantDeleteMock, participantDeleteManyMock, participantCreateManyMock, auditCreateMock, transactionMock]) mock.mockReset()
  transactionMock.mockImplementation(async callback => callback({
    $queryRaw: lockMock,
    yillikTakvimKaydi: { update: recordUpdateMock },
    yillikTakvimKatilimci: { update: participantUpdateMock, create: participantCreateMock, delete: participantDeleteMock, deleteMany: participantDeleteManyMock, createMany: participantCreateManyMock },
    yillikTakvimIslemGecmisi: { create: auditCreateMock },
  }))
  lockMock.mockResolvedValue([{ id: 'kayit-1', durum: 'PLANLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }])
})

describe('tekil GET', () => {
  it('yetkisiz istekte 403 döner ve DB sorgulamaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    const response = await GET(request('GET'), context)
    expect(response.status).toBe(403)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('view/admin ile minimum detayı döndürür', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'viewer' })
    findUniqueMock.mockResolvedValue({ id: 'kayit-1', anaKonu: 'İV' })
    const response = await GET(request('GET'), context)
    expect(response.status).toBe(200)
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.view', 'yilliktakvim.admin'])
    const select = findUniqueMock.mock.calls[0][0].select
    expect(select.katilimcilar.select.user.select).toEqual({ id: true, name: true, email: true })
  })

  it('olmayan ID için 404 döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'viewer' })
    findUniqueMock.mockResolvedValue(null)
    expect((await GET(request('GET'), context)).status).toBe(404)
  })
})

describe('PATCH', () => {
  it('yetkisiz/view-only istekte 403 döner ve write yapmaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    const response = await PATCH(request('PATCH', { aciklama: 'Yeni' }), context)
    expect(response.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.edit', 'yilliktakvim.admin'])
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('geçersiz/whitelist dışı payloadı write öncesi reddeder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    const response = await PATCH(request('PATCH', { durum: 'ONAYLANDI' }), context)
    expect(response.status).toBe(400)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('edit/admin ile geçerli PATCH ve PII içermeyen audit oluşturur', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue(existing)
    const response = await PATCH(request('PATCH', { aciklama: 'Yeni açıklama', oncelik: 'YUKSEK' }), context)
    expect(response.status).toBe(200)
    expect(recordUpdateMock).toHaveBeenCalledOnce()
    expect(auditCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({
      kayitId: 'kayit-1', yapanId: 'editor', islemTuru: 'GUNCELLE',
      yeniDeger: JSON.stringify({ degisenAlanlar: ['aciklama', 'oncelik'] }),
    }) })
  })

  it('dış kaynaklı kaydın kaynak alanını değiştirmez', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue({ ...existing, kaynakModul: 'EGITIM' })
    const response = await PATCH(request('PATCH', { anaKonu: 'Değiştirildi' }), context)
    expect(response.status).toBe(400)
    expect((await response.json()).lockedFields).toEqual(['anaKonu'])
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('ana sorumlu değişimini aynı transaction içinde relation ile günceller', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue(existing)
    userFindFirstMock.mockResolvedValue({ id: 'user-new' })
    const response = await PATCH(request('PATCH', { anaSorumluEmail: 'yeni@ilerigroup.com' }), context)
    expect(response.status).toBe(200)
    expect(participantUpdateMock).toHaveBeenCalledWith({ where: { id: 'kat-1' }, data: { userId: 'user-new' } })
    expect(auditCreateMock).toHaveBeenCalled()
  })

  it('yedek sorumlu ekler ve değişikliği PII olmadan audit eder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue(existing)
    userFindFirstMock.mockResolvedValue({ id: 'user-backup' })

    const response = await PATCH(request('PATCH', { yedekSorumluEmail: 'yedek@ilerigroup.com' }), context)

    expect(response.status).toBe(200)
    expect(participantCreateMock).toHaveBeenCalledWith({ data: { kayitId: 'kayit-1', userId: 'user-backup', rol: 'YEDEK_SORUMLU' } })
    expect(auditCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({
      yeniDeger: JSON.stringify({ degisenAlanlar: ['yedekSorumlu'] }),
    }) })
  })

  it('bilgilendirilecek listesindeki ekleme ve çıkarmayı diff ile uygular', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue({ ...existing, katilimcilar: [
      ...existing.katilimcilar,
      { id: 'info-old', userId: 'user-old-info', rol: 'BILGILENDIRILECEK' },
      { id: 'info-same', userId: 'user-same', rol: 'BILGILENDIRILECEK' },
    ] })
    userFindManyMock.mockResolvedValue([
      { id: 'user-same', email: 'same@ilerigroup.com' },
      { id: 'user-new-info', email: 'new@ilerigroup.com' },
    ])

    const response = await PATCH(request('PATCH', { bilgilendirilecekEmailler: ['same@ilerigroup.com', 'new@ilerigroup.com'] }), context)

    expect(response.status).toBe(200)
    expect(participantDeleteManyMock).toHaveBeenCalledWith({ where: { id: { in: ['info-old'] } } })
    expect(participantCreateManyMock).toHaveBeenCalledWith({ data: [{ kayitId: 'kayit-1', userId: 'user-new-info', rol: 'BILGILENDIRILECEK' }] })
    expect(participantUpdateMock).not.toHaveBeenCalled()
    expect(auditCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({
      yeniDeger: JSON.stringify({ degisenAlanlar: ['bilgilendirilecekler'] }),
    }) })
  })

  it('audit başarısızsa transaction hatası olarak 500 döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue(existing)
    auditCreateMock.mockRejectedValue(new Error('audit failed'))
    const response = await PATCH(request('PATCH', { aciklama: 'Yeni' }), context)
    expect(response.status).toBe(500)
    expect(transactionMock).toHaveBeenCalledOnce()
  })

  it('lock sonrası onaya geçen kayıtta stale edit 409 döner ve audit yazmaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'editor' })
    findUniqueMock.mockResolvedValue(existing)
    lockMock.mockResolvedValue([{ id: 'kayit-1', durum: 'ONAYLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }])
    expect((await PATCH(request('PATCH', { aciklama: 'Stale' }), context)).status).toBe(409)
    expect(recordUpdateMock).not.toHaveBeenCalled()
    expect(auditCreateMock).not.toHaveBeenCalled()
  })
})

describe('DELETE soft-cancel', () => {
  it('yetkisiz veya view/edit/create-only istekte 403 döner ve DB erişimi yapmaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    const response = await DELETE(request('DELETE'), context)
    expect(response.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.cancel', 'yilliktakvim.admin'])
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('cancel/admin ile fiziksel silmeden soft-delete ve audit yapar', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValue({ id: 'kayit-1', iptalMi: false, arsivMi: false, kaynakModul: null })
    const response = await DELETE(request('DELETE'), context)
    expect(response.status).toBe(200)
    expect(recordUpdateMock).toHaveBeenCalledWith({
      where: { id: 'kayit-1' },
      data: { iptalMi: true, durum: 'IPTAL_EDILDI', updatedById: 'canceller' },
    })
    expect(auditCreateMock).toHaveBeenCalledWith({ data: {
      kayitId: 'kayit-1', yapanId: 'canceller', islemTuru: 'IPTAL', alan: 'iptalMi', yeniDeger: 'true',
    } })
  })

  it('olmayan kayıt için 404 döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValue(null)
    expect((await DELETE(request('DELETE'), context)).status).toBe(404)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('zaten iptal edilmiş kayıtta writesiz idempotent başarı döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValue({ id: 'kayit-1', iptalMi: true, arsivMi: false, kaynakModul: null })
    const response = await DELETE(request('DELETE'), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, alreadyCancelled: true })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('arşivli veya dış kaynaklı kaydı iptal etmez', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValueOnce({ id: 'kayit-1', iptalMi: false, arsivMi: true, kaynakModul: null })
    expect((await DELETE(request('DELETE'), context)).status).toBe(400)
    findUniqueMock.mockResolvedValueOnce({ id: 'kayit-1', iptalMi: false, arsivMi: false, kaynakModul: 'EGITIM' })
    expect((await DELETE(request('DELETE'), context)).status).toBe(400)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('audit başarısızsa transaction hatası olarak 500 döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValue({ id: 'kayit-1', iptalMi: false, arsivMi: false, kaynakModul: null })
    auditCreateMock.mockRejectedValue(new Error('audit failed'))
    expect((await DELETE(request('DELETE'), context)).status).toBe(500)
    expect(transactionMock).toHaveBeenCalledOnce()
  })

  it('eşzamanlı iptalde lock sonrası ikinci isteği 409 ile reddeder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'canceller' })
    findUniqueMock.mockResolvedValue({ id: 'kayit-1', iptalMi: false, arsivMi: false, kaynakModul: null })
    lockMock.mockResolvedValue([{ id: 'kayit-1', durum: 'IPTAL_EDILDI', iptalMi: true, arsivMi: false, kaynakModul: null }])
    expect((await DELETE(request('DELETE'), context)).status).toBe(409)
    expect(recordUpdateMock).not.toHaveBeenCalled()
    expect(auditCreateMock).not.toHaveBeenCalled()
  })
})
