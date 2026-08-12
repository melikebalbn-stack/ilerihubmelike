import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const guard = vi.fn(), recordFind = vi.fn(), stepsFind = vi.fn(), stepUpdate = vi.fn()
const recordUpdate = vi.fn(), auditCreate = vi.fn(), transaction = vi.fn(), lock = vi.fn()

vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => guard(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (...args: unknown[]) => transaction(...args) } }))

import { POST } from './route'

const context = { params: Promise.resolve({ id: 'r1' }) }
const request = (body: unknown) => new NextRequest('http://local/onay/geri-al', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
})
const record = (durum: string) => ({ id: 'r1', durum, iptalMi: false, arsivMi: false })
const step = (karar: 'ONAYLANDI' | 'REVIZYON_ISTENDI', owner = 'u1') => ({
  id: 's1', kayitId: 'r1', tur: 2, adimSira: 2, unvan: 'Müdür', onaylayanId: owner,
  karar, yorum: karar === 'REVIZYON_ISTENDI' ? 'Düzeltme gerekli' : null, kararTarihi: new Date(), createdAt: new Date(),
})
const tx = {
  $queryRaw: lock,
  yillikTakvimKaydi: { findUnique: recordFind, update: recordUpdate },
  yillikTakvimOnayAdimi: { findMany: stepsFind, updateMany: stepUpdate },
  yillikTakvimIslemGecmisi: { create: auditCreate },
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: ['yilliktakvim.approve'] } } })
  transaction.mockImplementation(async callback => callback(tx))
  lock.mockResolvedValue([{ id: 'r1', durum: 'ONAYLANDI', iptalMi: false, arsivMi: false, kaynakModul: null }])
  recordFind.mockResolvedValue(record('ONAYLANDI'))
  stepsFind.mockResolvedValue([step('ONAYLANDI')])
  stepUpdate.mockResolvedValue({ count: 1 })
})

describe('Yıllık Takvim onay kararı geri alma', () => {
  it('kararı veren kişi ONAYLANDI kaydı geri alır ve durumu onay bekliyora taşır', async () => {
    const response = await POST(request({ gerekce: 'Yanlışlıkla onaylandı' }), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, id: 'r1', durum: 'TAMAMLANDI_ONAY_BEKLIYOR' })
    expect(stepUpdate).toHaveBeenCalledWith({ where: { id: 's1', karar: { not: null } }, data: { karar: null, yorum: null, kararTarihi: null } })
    expect(recordUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { durum: 'TAMAMLANDI_ONAY_BEKLIYOR', updatedById: 'u1' } })
  })

  it('kararı veren kişi REVIZYON_ISTENDI kaydı geri alabilir', async () => {
    recordFind.mockResolvedValue(record('REVIZYON_ISTENDI'))
    stepsFind.mockResolvedValue([step('REVIZYON_ISTENDI')])
    expect((await POST(request({ gerekce: 'Revizyon kararı hatalı' }), context)).status).toBe(200)
  })

  it('kararı vermeyen ve admin olmayan kişiyi engeller', async () => {
    guard.mockResolvedValue({ error: null, userId: 'other', session: { user: { permissions: ['yilliktakvim.approve'] } } })
    expect((await POST(request({ gerekce: 'Kararı düzelt' }), context)).status).toBe(403)
    expect(stepUpdate).not.toHaveBeenCalled()
  })

  it('admin kararı veren kişi olmasa da geri alabilir', async () => {
    guard.mockResolvedValue({ error: null, userId: 'admin', session: { user: { permissions: ['yilliktakvim.admin'] } } })
    expect((await POST(request({ gerekce: 'Yönetici düzeltmesi' }), context)).status).toBe(200)
    expect(recordUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { durum: 'TAMAMLANDI_ONAY_BEKLIYOR', updatedById: 'admin' } })
  })

  it.each(['PLANLANDI', 'TASLAK'])('%s durumundaki kaydı 409 ile reddeder', async durum => {
    recordFind.mockResolvedValue(record(durum))
    expect((await POST(request({ gerekce: 'Durumu geri al' }), context)).status).toBe(409)
    expect(stepsFind).not.toHaveBeenCalled()
  })

  it.each([{}, { gerekce: '' }, { gerekce: 'ab' }])('eksik veya kısa gerekçeyi DB öncesi 400 ile reddeder', async body => {
    expect((await POST(request(body), context)).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('audit kaydını doğru aksiyon ve metadata ile aynı transactionda oluşturur', async () => {
    const reason = 'Onay bilgisi düzeltilmeli'
    await POST(request({ gerekce: reason }), context)
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      kayitId: 'r1', yapanId: 'u1', islemTuru: 'ONAY_GERI_ALINDI', alan: 'onay',
    }) })
    const metadata = JSON.parse(auditCreate.mock.calls[0][0].data.yeniDeger)
    expect(metadata).toEqual({
      onayAdimiId: 's1', tur: 2, sira: 2, eskiKarar: 'ONAYLANDI', eskiYorum: null,
      gerekce: reason, oncekiDurum: 'ONAYLANDI', yeniDurum: 'TAMAMLANDI_ONAY_BEKLIYOR',
    })
  })
})
