import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const guard = vi.fn(), recordFind = vi.fn(), stepsFind = vi.fn(), configFind = vi.fn(), participantFind = vi.fn(), createMany = vi.fn()
const claim = vi.fn(), recordUpdate = vi.fn(), auditCreate = vi.fn(), transaction = vi.fn()
const lock = vi.fn()
const hierarchyResolve = vi.fn()
vi.mock('@/lib/auth/require-permission', () => ({ requirePermission: (...args: unknown[]) => guard(...args) }))
vi.mock('@/lib/yillik-calisma-takvimi/hiyerarsi-cozumle', () => ({ ycktOnaylayanZinciriCoz: (...args: unknown[]) => hierarchyResolve(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  yillikTakvimKaydi: { findUnique: (...args: unknown[]) => recordFind(...args) },
  yillikTakvimOnayAdimi: { findMany: (...args: unknown[]) => stepsFind(...args) },
  yillikTakvimOnayKademesi: { findMany: (...args: unknown[]) => configFind(...args) },
  yillikTakvimKatilimci: { findFirst: (...args: unknown[]) => participantFind(...args) },
  $transaction: (...args: unknown[]) => transaction(...args),
} }))
import { GET, POST } from './route'

const context = { params: Promise.resolve({ id: 'r1' }) }
const request = (body: unknown) => new NextRequest('http://local/onay', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const record = { id: 'r1', durum: 'TAMAMLANDI_ONAY_BEKLIYOR', iptalMi: false, arsivMi: false }
const step = (id: string, order: number, owner: string, karar: null | 'ONAYLANDI' | 'REVIZYON_ISTENDI' = null, tur = 1) => ({ id, kayitId: 'r1', tur, adimSira: order, unvan: `Kademe ${order}`, onaylayanId: owner, karar, yorum: null, kararTarihi: null })
const tx = {
  $queryRaw: lock,
  yillikTakvimKaydi: { findUnique: recordFind, update: recordUpdate },
  yillikTakvimOnayAdimi: { findMany: stepsFind, createMany, updateMany: claim },
  yillikTakvimOnayKademesi: { findMany: configFind },
  yillikTakvimKatilimci: { findFirst: participantFind },
  yillikTakvimIslemGecmisi: { create: auditCreate },
}
beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation(async callback => callback(tx))
  lock.mockResolvedValue([{ id: 'r1', durum: 'TAMAMLANDI_ONAY_BEKLIYOR', iptalMi: false, arsivMi: false, kaynakModul: null }])
  recordFind.mockResolvedValue(record); claim.mockResolvedValue({ count: 1 }); participantFind.mockResolvedValue(null); hierarchyResolve.mockResolvedValue([])
})

describe('Yıllık Takvim onay akışı', () => {
  it('yetkisiz istekte 403 döner ve DB erişmez', async () => {
    guard.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('revizyon gerekçesini DB öncesi zorunlu tutar', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' })
    expect((await POST(request({ karar: 'REVIZYON_ISTENDI', yorum: null }), context)).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('aktif konfigürasyondan sıralı ve tek snapshot oluşturur', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' })
    const current = [step('s1', 1, 'u1'), step('s2', 2, 'u2')]
    stepsFind.mockResolvedValueOnce([]).mockResolvedValueOnce(current)
    configFind.mockResolvedValue([{ sira: 1, unvan: 'Müdür', userId: 'u1' }, { sira: 2, unvan: 'Direktör', userId: 'u2' }])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(createMany).toHaveBeenCalledWith({ data: [
      { kayitId: 'r1', tur: 1, adimSira: 1, unvan: 'Müdür', onaylayanId: 'u1' },
      { kayitId: 'r1', tur: 1, adimSira: 2, unvan: 'Direktör', onaylayanId: 'u2' },
    ] })
    expect(recordUpdate).not.toHaveBeenCalled()
  })

  it('tam hiyerarşi bulunduğunda onaylayanları hiyerarşiden alır', async () => {
    guard.mockResolvedValue({ error: null, userId: 'amir-1' })
    stepsFind.mockResolvedValueOnce([]).mockResolvedValueOnce([step('s1', 1, 'amir-1'), step('s2', 2, 'amir-2')])
    configFind.mockResolvedValue([{ sira: 1, unvan: 'Müdür', userId: 'yedek-1' }, { sira: 2, unvan: 'Direktör', userId: 'yedek-2' }])
    participantFind.mockResolvedValue({ userId: 'ana-sorumlu' })
    hierarchyResolve.mockResolvedValue([{ adimSira: 1, userId: 'amir-1' }, { adimSira: 2, userId: 'amir-2' }])

    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(hierarchyResolve).toHaveBeenCalledWith('ana-sorumlu', 2)
    expect(createMany).toHaveBeenCalledWith({ data: [
      { kayitId: 'r1', tur: 1, adimSira: 1, unvan: 'Müdür', onaylayanId: 'amir-1' },
      { kayitId: 'r1', tur: 1, adimSira: 2, unvan: 'Direktör', onaylayanId: 'amir-2' },
    ] })
  })

  it('kısmi hiyerarşide eksik adımı aktif konfigürasyondan tamamlar', async () => {
    guard.mockResolvedValue({ error: null, userId: 'amir-1' })
    stepsFind.mockResolvedValueOnce([]).mockResolvedValueOnce([step('s1', 1, 'amir-1'), step('s2', 2, 'yedek-2')])
    configFind.mockResolvedValue([{ sira: 1, unvan: 'Müdür', userId: 'yedek-1' }, { sira: 2, unvan: 'Direktör', userId: 'yedek-2' }])
    participantFind.mockResolvedValue({ userId: 'ana-sorumlu' })
    hierarchyResolve.mockResolvedValue([{ adimSira: 1, userId: 'amir-1' }])

    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(createMany).toHaveBeenCalledWith({ data: [
      { kayitId: 'r1', tur: 1, adimSira: 1, unvan: 'Müdür', onaylayanId: 'amir-1' },
      { kayitId: 'r1', tur: 1, adimSira: 2, unvan: 'Direktör', onaylayanId: 'yedek-2' },
    ] })
  })

  it('hiyerarşi hiç çözülemezse tüm adımları bugünkü gibi aktif konfigürasyondan alır', async () => {
    guard.mockResolvedValue({ error: null, userId: 'yedek-1' })
    stepsFind.mockResolvedValueOnce([]).mockResolvedValueOnce([step('s1', 1, 'yedek-1'), step('s2', 2, 'yedek-2')])
    configFind.mockResolvedValue([{ sira: 1, unvan: 'Müdür', userId: 'yedek-1' }, { sira: 2, unvan: 'Direktör', userId: 'yedek-2' }])
    participantFind.mockResolvedValue({ userId: 'ana-sorumlu' })
    hierarchyResolve.mockResolvedValue([])

    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(createMany).toHaveBeenCalledWith({ data: [
      { kayitId: 'r1', tur: 1, adimSira: 1, unvan: 'Müdür', onaylayanId: 'yedek-1' },
      { kayitId: 'r1', tur: 1, adimSira: 2, unvan: 'Direktör', onaylayanId: 'yedek-2' },
    ] })
  })

  it('mevcut snapshot varken mükerrer oluşturmaz', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1'), step('s2', 2, 'u2')])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(createMany).not.toHaveBeenCalled(); expect(configFind).not.toHaveBeenCalled()
  })

  it('konfigürasyon yoksa güvenli hata verir', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' }); stepsFind.mockResolvedValue([]); configFind.mockResolvedValue([])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(400)
    expect(claim).not.toHaveBeenCalled()
  })

  it('approve/admin olsa da aktif adım sahibi olmayanı engeller', async () => {
    guard.mockResolvedValue({ error: null, userId: 'other' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1'), step('s2', 2, 'u2')])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(403)
    expect(claim).not.toHaveBeenCalled()
  })

  it('yanlış sıra yerine ilk kararsız adımı aktif kabul eder', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u2' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1'), step('s2', 2, 'u2')])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(403)
  })

  it('race ile önceden karar verilmiş adımı 409 ile engeller', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1')]); claim.mockResolvedValue({ count: 0 })
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(409)
  })

  it('son kademe onayında kaydı ONAYLANDI yapar ve audit yazar', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u2' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1', 'ONAYLANDI'), step('s2', 2, 'u2')])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(recordUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { durum: 'ONAYLANDI', updatedById: 'u2' } })
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'ONAY' }) })
  })

  it('revizyonda gerekçeyi adımda tutar ve state geri döner', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1'), step('s2', 2, 'u2')])
    expect((await POST(request({ karar: 'REVIZYON_ISTENDI', yorum: 'Tarih düzeltilmeli' }), context)).status).toBe(200)
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ karar: 'REVIZYON_ISTENDI', yorum: 'Tarih düzeltilmeli' }) }))
    expect(recordUpdate).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { durum: 'REVIZYON_ISTENDI', updatedById: 'u1' } })
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'REVIZYON_ISTE' }) })
  })

  it('revizyon sonrası yeniden gönderimde yeni tur snapshot oluşturur ve geçmişi silmez', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' })
    stepsFind.mockResolvedValueOnce([step('old1', 1, 'u1', 'REVIZYON_ISTENDI', 1)]).mockResolvedValueOnce([step('new1', 1, 'u1', null, 2)])
    configFind.mockResolvedValue([{ sira: 1, unvan: 'Müdür', userId: 'u1' }])
    expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(200)
    expect(createMany).toHaveBeenCalledWith({ data: [{ kayitId: 'r1', tur: 2, adimSira: 1, unvan: 'Müdür', onaylayanId: 'u1' }] })
    expect(tx.yillikTakvimOnayAdimi).not.toHaveProperty('deleteMany')
  })

  it('iptal/arşiv/yanlış status ve olmayan kaydı engeller', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1' }); stepsFind.mockResolvedValue([step('s1', 1, 'u1')])
    recordFind.mockResolvedValueOnce(null); expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(404)
    recordFind.mockResolvedValueOnce({ ...record, arsivMi: true }); expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(409)
    recordFind.mockResolvedValueOnce({ ...record, durum: 'DEVAM_EDIYOR' }); expect((await POST(request({ karar: 'ONAYLANDI' }), context)).status).toBe(409)
  })

  it('GET mevcut kullanıcı için aktif adım ve geçmişi minimum veriyle döndürür', async () => {
    guard.mockResolvedValue({ error: null, userId: 'u1', session: { user: { permissions: ['yilliktakvim.approve'] } } })
    const current = [{ ...step('s1', 1, 'u1'), onaylayan: { id: 'u1', name: 'Onaycı' } }]
    stepsFind.mockResolvedValue(current)
    const response = await GET(new NextRequest('http://local/onay'), context)
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ activeStepId: 's1', canAct: true, canRevert: false })
  })

  it('GET son karar sahibi veya admin için canRevert döndürür', async () => {
    recordFind.mockResolvedValue({ ...record, durum: 'ONAYLANDI' })
    stepsFind.mockResolvedValue([{ ...step('s1', 1, 'u1', 'ONAYLANDI'), onaylayan: { id: 'u1', name: 'Onaycı' } }])
    guard.mockResolvedValueOnce({ error: null, userId: 'u1', session: { user: { permissions: ['yilliktakvim.approve'] } } })
    expect(await (await GET(new NextRequest('http://local/onay'), context)).json()).toMatchObject({ canRevert: true })

    guard.mockResolvedValueOnce({ error: null, userId: 'admin', session: { user: { permissions: ['yilliktakvim.admin'] } } })
    expect(await (await GET(new NextRequest('http://local/onay'), context)).json()).toMatchObject({ canRevert: true })
  })
})
