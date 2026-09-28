import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * PUT /api/kalite/fif/[id] — Kaydet veri kaybı düzeltmesi (fix/fif-veri-kaybi).
 *  · Payload'da gelmeyen alan yazılmaz; sistem alanları payload'dan hiç yazılmaz.
 *  · Faaliyetler id bazında senkron: id'li satır güncellenir (paraf/sonuç/gerçekleşen
 *    tarihe dokunulmaz), id'siz oluşturulur, eksik satır paraflı değilse silinir,
 *    paraflıysa 400; başka FİF'e ait / tekrarlanan id 400.
 */

type Satir = { id: string; fifId: string; parafUserId: string | null }

const fifFindUnique = vi.fn()
const transaction = vi.fn()
const fifUpdate = vi.fn()
const fifFindUniqueTx = vi.fn()
const faaliyetFindMany = vi.fn()
const faaliyetDeleteMany = vi.fn()
const faaliyetUpdate = vi.fn()
const faaliyetCreate = vi.fn()

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: async () => ({ session: { user: { id: 'u1' } }, userId: 'u1', error: null }),
}))
vi.mock('@/lib/quality/fif-access', () => ({
  fifKapsamindaMi: async () => true,
  canManageFif: () => false,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findUnique: (...a: unknown[]) => fifFindUnique(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}))
import { PUT } from './route'

const tx = {
  fif: { update: fifUpdate, findUnique: fifFindUniqueTx },
  fifFaaliyet: { findMany: faaliyetFindMany, deleteMany: faaliyetDeleteMany, update: faaliyetUpdate, create: faaliyetCreate },
  fifKokNeden: { deleteMany: vi.fn(), createMany: vi.fn() },
  fifBesNeden: { deleteMany: vi.fn(), createMany: vi.fn() },
  fifEtkinlik: { deleteMany: vi.fn(), createMany: vi.fn() },
}

const ctx = { params: Promise.resolve({ id: 'fif1' }) }
const istek = (body: unknown) =>
  new NextRequest('http://local/api/kalite/fif/fif1', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })

let satirlar: Satir[]
beforeEach(() => {
  vi.clearAllMocks()
  satirlar = [
    { id: 'f1', fifId: 'fif1', parafUserId: 'uParaf' }, // paraflı
    { id: 'f2', fifId: 'fif1', parafUserId: null },
    { id: 'f3', fifId: 'fif1', parafUserId: null },
  ]
  fifFindUnique.mockResolvedValue({
    id: 'fif1', durum: 'FAALIYET', createdById: 'u1', hazirlayanUserId: 'u1',
    sorumluBolumId: 'd1', yayinlayanBolumId: null, yayilimVarMi: false, yayilimAciklama: null,
  })
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  faaliyetFindMany.mockImplementation(async () => satirlar.map(({ id, parafUserId }) => ({ id, parafUserId })))
  fifFindUniqueTx.mockResolvedValue({ id: 'fif1' })
})

describe('FİF PUT — kısmi başlık güncellemesi', () => {
  it('payload\'da gelmeyen alan YAZILMAZ (tur dahil — varsayılana dönmez)', async () => {
    const r = await PUT(istek({ uygunsuzlukTanimi: 'Yeni tespit' }), ctx)
    expect(r.status).toBe(200)
    expect(fifUpdate).toHaveBeenCalledTimes(1)
    expect(fifUpdate.mock.calls[0][0].data).toEqual({ uygunsuzlukTanimi: 'Yeni tespit' })
  })

  it('sistem alanları payload\'dan hiç yazılmaz (durum, kayitNo, kssUserId, hazirlayanUserId, kapatmaTarihi)', async () => {
    const r = await PUT(istek({
      durum: 'KAPANDI', kayitNo: 'FIF-2026-999', kssUserId: 'x', hazirlayanUserId: 'x', kapatmaTarihi: '2026-09-01',
      standartMadde: '8.7',
    }), ctx)
    expect(r.status).toBe(200)
    expect(fifUpdate.mock.calls[0][0].data).toEqual({ standartMadde: '8.7' })
  })

  it('formun gönderdiği alanlar eskisi gibi yazılır (açık null dahil)', async () => {
    await PUT(istek({ tur: 'ONLEYICI', izlemeSorumlusuUserId: null, sorumluOnaylayanUserId: 'm1', kysDegisikligi: false }), ctx)
    expect(fifUpdate.mock.calls[0][0].data).toEqual({
      tur: 'ONLEYICI', izlemeSorumlusuUserId: null, sorumluOnaylayanUserId: 'm1', kysDegisikligi: false,
    })
  })

  it('faaliyetler gönderilmezse satırlara hiç dokunulmaz', async () => {
    await PUT(istek({ standartMadde: 'x' }), ctx)
    expect(faaliyetFindMany).not.toHaveBeenCalled()
    expect(faaliyetUpdate).not.toHaveBeenCalled()
    expect(faaliyetCreate).not.toHaveBeenCalled()
    expect(faaliyetDeleteMany).not.toHaveBeenCalled()
  })
})

describe('FİF PUT — faaliyet senkronu (sil-yeniden-yaz YOK)', () => {
  it('id\'li güncellenir (paraf/sonuç/gerçekleşen YOK), id\'siz oluşturulur, eksik parafsız silinir', async () => {
    const r = await PUT(istek({
      faaliyetler: [
        { id: 'f1', sira: 1, aciklama: 'Paraflı satır', hedefTarih: '2026-10-01', aksiyonTuru: 'KALICI',
          // istemci paraf/sonuç göndermeye çalışsa da yazılmaz
          parafUserId: 'hacker', sonuc: 'K', gerceklesenTarih: '2026-09-01' },
        { id: 'f2', sira: 2, aciklama: 'İkinci' },
        { sira: 3, aciklama: 'Yeni satır', hedefTarih: '2026-11-01' },
      ],
    }), ctx)
    expect(r.status).toBe(200)

    expect(faaliyetDeleteMany).toHaveBeenCalledTimes(1)
    expect(faaliyetDeleteMany.mock.calls[0][0]).toEqual({ where: { fifId: 'fif1', id: { in: ['f3'] } } })

    expect(faaliyetUpdate).toHaveBeenCalledTimes(2)
    const f1 = faaliyetUpdate.mock.calls.find((c) => c[0].where.id === 'f1')![0].data
    expect(f1).toEqual({ sira: 1, aciklama: 'Paraflı satır', aksiyonTuru: 'KALICI', hedefTarih: new Date('2026-10-01') })
    for (const k of ['parafUserId', 'parafTarihi', 'sonuc', 'gerceklesenTarih']) expect(k in f1).toBe(false)
    const f2 = faaliyetUpdate.mock.calls.find((c) => c[0].where.id === 'f2')![0].data
    expect(f2).toEqual({ sira: 2, aciklama: 'İkinci' }) // hedef/tür gönderilmedi → dokunulmaz

    expect(faaliyetCreate).toHaveBeenCalledTimes(1)
    expect(faaliyetCreate.mock.calls[0][0].data).toEqual({ fifId: 'fif1', sira: 3, aciklama: 'Yeni satır', hedefTarih: new Date('2026-11-01') })
  })

  it('payload\'da olmayan satır PARAFLIYSA 400 ve hiçbir satır yazılmaz', async () => {
    const r = await PUT(istek({ faaliyetler: [{ id: 'f2', sira: 1, aciklama: 'x' }, { id: 'f3', sira: 2, aciklama: 'y' }] }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Paraflı faaliyet silinemez')
    expect(faaliyetDeleteMany).not.toHaveBeenCalled()
    expect(faaliyetUpdate).not.toHaveBeenCalled()
    expect(faaliyetCreate).not.toHaveBeenCalled()
  })

  it('başka FİF\'e ait (bilinmeyen) id → 400', async () => {
    const r = await PUT(istek({ faaliyetler: [
      { id: 'f1', sira: 1, aciklama: 'a' }, { id: 'f2', sira: 2, aciklama: 'b' }, { id: 'f3', sira: 3, aciklama: 'c' },
      { id: 'baskaFifSatiri', sira: 4, aciklama: 'd' },
    ] }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toContain('bu FİF\'e ait değil')
    expect(faaliyetUpdate).not.toHaveBeenCalled()
  })

  it('aynı id iki kez → 400', async () => {
    const r = await PUT(istek({ faaliyetler: [
      { id: 'f1', sira: 1, aciklama: 'a' }, { id: 'f1', sira: 2, aciklama: 'a2' },
      { id: 'f2', sira: 3, aciklama: 'b' }, { id: 'f3', sira: 4, aciklama: 'c' },
    ] }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toContain('birden fazla')
  })

  it('boş liste: parafsız satırlar silinir, paraflı varsa 400', async () => {
    satirlar = satirlar.filter((s) => !s.parafUserId)
    const r = await PUT(istek({ faaliyetler: [] }), ctx)
    expect(r.status).toBe(200)
    expect(faaliyetDeleteMany.mock.calls[0][0]).toEqual({ where: { fifId: 'fif1', id: { in: ['f2', 'f3'] } } })
  })
})
