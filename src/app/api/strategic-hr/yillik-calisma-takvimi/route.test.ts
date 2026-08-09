import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
const findManyMock = vi.fn()
const departmentFindFirstMock = vi.fn()
const userFindFirstMock = vi.fn()
const kayitCreateMock = vi.fn()
const auditCreateMock = vi.fn()
const transactionMock = vi.fn()

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    yillikTakvimKaydi: { findMany: (...args: unknown[]) => findManyMock(...args) },
    department: { findFirst: (...args: unknown[]) => departmentFindFirstMock(...args) },
    user: { findFirst: (...args: unknown[]) => userFindFirstMock(...args) },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}))

import { GET, POST } from './route'

const validPayload = {
  yil: 2026,
  anaKonu: 'İnsan Varlıkları',
  surec: 'Yıllık değerlendirme',
  aciklama: 'Plan açıklaması',
  departmentId: 'dept-1',
  anaSorumluEmail: 'sorumlu@ilerigroup.com',
  nihaiSonTarih: '2026-12-15',
  plananUygulamaTarihi: '2026-12-01',
  periyot: 'YILLIK',
  oncelik: 'ORTA',
  kayitTuru: 'SON_TARIH',
  kisaBaslik: 'Değerlendirme',
  disKurum: null,
}

const postRequest = (payload: unknown) => new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
})

beforeEach(() => {
  requirePermissionMock.mockReset()
  findManyMock.mockReset()
  departmentFindFirstMock.mockReset()
  userFindFirstMock.mockReset()
  kayitCreateMock.mockReset()
  auditCreateMock.mockReset()
  transactionMock.mockReset()
  transactionMock.mockImplementation(async callback => callback({
    yillikTakvimKaydi: { create: kayitCreateMock },
    yillikTakvimIslemGecmisi: { create: auditCreateMock },
  }))
})

describe('Yıllık Çalışma Takvimi POST', () => {
  it('oturumsuz/yetkisiz istekte 403 döner ve DB write yapmaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) })
    const response = await POST(postRequest(validPayload))
    expect(response.status).toBe(403)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('yalnız view yetkisi create açmaz; create/admin ister', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) })
    await POST(postRequest(validPayload))
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.create', 'yilliktakvim.admin'])
    expect(requirePermissionMock).not.toHaveBeenCalledWith(expect.arrayContaining(['yilliktakvim.view']))
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('create yetkisiyle geçerli kayıt, ana sorumlu ve minimum audit oluşturur', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'actor-1' })
    departmentFindFirstMock.mockResolvedValue({ id: 'dept-1' })
    userFindFirstMock.mockResolvedValue({ id: 'user-1' })
    kayitCreateMock.mockResolvedValue({ id: 'kayit-1' })
    auditCreateMock.mockResolvedValue({ id: 'audit-1' })
    const response = await POST(postRequest(validPayload))
    expect(response.status).toBe(201)
    expect(kayitCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      createdById: 'actor-1',
      katilimcilar: { create: { userId: 'user-1', rol: 'ANA_SORUMLU' } },
    }) }))
    expect(auditCreateMock).toHaveBeenCalledWith({ data: expect.objectContaining({
      kayitId: 'kayit-1', yapanId: 'actor-1', islemTuru: 'OLUSTUR',
    }) })
  })

  it('geçersiz payloadı referans sorgusu ve write öncesi reddeder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'actor-1' })
    const response = await POST(postRequest({ ...validPayload, nihaiSonTarih: '2026-02-31' }))
    expect(response.status).toBe(400)
    expect(departmentFindFirstMock).not.toHaveBeenCalled()
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('audit yazılamazsa transaction hatası olarak 500 döner', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'actor-1' })
    departmentFindFirstMock.mockResolvedValue({ id: 'dept-1' })
    userFindFirstMock.mockResolvedValue({ id: 'user-1' })
    kayitCreateMock.mockResolvedValue({ id: 'kayit-1' })
    auditCreateMock.mockRejectedValue(new Error('audit failed'))
    const response = await POST(postRequest(validPayload))
    expect(response.status).toBe(500)
    expect(transactionMock).toHaveBeenCalledOnce()
  })
})

describe('Yıllık Çalışma Takvimi GET', () => {
  it('view/admin yoksa 403 döner ve DB sorgulamaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) })
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=2026'))
    expect(response.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.view', 'yilliktakvim.admin'])
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('view/admin kontrolünden sonra yalnız seçili alanları okur', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'u1' })
    findManyMock.mockResolvedValue([])
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=2026'))
    expect(response.status).toBe(200)
    expect(findManyMock).toHaveBeenCalledOnce()
    expect(findManyMock.mock.calls[0][0].where).toEqual({ yil: 2026, arsivMi: false })
    expect(findManyMock.mock.calls[0][0].select.katilimcilar.select.user.select).toEqual({ name: true })
  })

  it('geçersiz yılı DB sorgusundan önce reddeder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'u1' })
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=1999'))
    expect(response.status).toBe(400)
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
