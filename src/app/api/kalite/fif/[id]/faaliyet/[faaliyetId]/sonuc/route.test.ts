import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * POST /api/kalite/fif/[id]/faaliyet/[faaliyetId]/sonuc — Paket 4: KSS "Sonuç Gir".
 *  · Yalnız KSS koltuğu (manage / satır sorumlusu GİREMEZ), FİF FAALIYET'te, satır açık.
 *  · K: satır kapanır (gerçekleşen = İstanbul bugünü, paraf = KSS, sonuc K), bekleyen
 *    ek termin IPTAL + EK_TERMIN_IPTAL; FifGecmis FAALIYET_KAPATILDI (faaliyetId).
 *  · YT: satır açık kalır (yalnız sonuc YT), açıklama zorunlu; ek termine dokunulmaz.
 *  · İkisinde de satır sorumlusuna bildirim.
 */

const fifFindUnique = vi.fn()
const faaliyetFindFirst = vi.fn()
const transaction = vi.fn()
const faaliyetUpdateMany = vi.fn()
const fifUpdate = vi.fn()
const gecmisCreate = vi.fn()
const ekTerminFindMany = vi.fn()
const ekTerminUpdateMany = vi.fn()
const bildir = vi.fn()
let kss = true

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: async () => ({ session: { user: { id: 'uKss' } }, userId: 'uKss', error: null }),
}))
vi.mock('@/lib/quality/fif-access', () => ({
  fifKapsamindaMi: async () => true,
  isFifKss: async () => kss,
}))
vi.mock('@/lib/quality/fif-bildirim', () => ({
  fifKullaniciyaBildir: (...a: unknown[]) => bildir(...a),
  fifBildirimKonusu: (_f: unknown, olay: string) => `[FİF X] ${olay}`,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findUnique: (...a: unknown[]) => fifFindUnique(...a) },
    fifFaaliyet: { findFirst: (...a: unknown[]) => faaliyetFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}))
import { POST } from './route'

const tx = {
  fifFaaliyet: { updateMany: faaliyetUpdateMany },
  fif: { update: fifUpdate },
  fifGecmis: { create: gecmisCreate },
  fifEkTermin: { findMany: ekTerminFindMany, updateMany: ekTerminUpdateMany },
}

const ctx = { params: Promise.resolve({ id: 'fif1', faaliyetId: 'f1' }) }
const istek = (body: unknown) =>
  new NextRequest('http://local/api/kalite/fif/fif1/faaliyet/f1/sonuc', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  kss = true
  fifFindUnique.mockResolvedValue({
    id: 'fif1', kayitNo: 'FIF-2026-001', durum: 'FAALIYET', createdById: 'u1', hazirlayanUserId: 'u1',
    sorumluBolumId: 'd1', yayinlayanBolumId: 'd2',
  })
  faaliyetFindFirst.mockResolvedValue({
    id: 'f1', sira: 2, aciklama: 'Kalibrasyon planı', hedefTarih: new Date('2026-10-15'),
    sorumluUserId: 'uSatir', sonuc: null, gerceklesenTarih: null,
  })
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  faaliyetUpdateMany.mockResolvedValue({ count: 1 })
  ekTerminFindMany.mockResolvedValue([])
  bildir.mockResolvedValue({ inApp: true, push: 0, mail: 'gitti' })
})

describe('FİF Sonuç Gir — yetki ve şartlar', () => {
  it('KSS değilse 403 (satır sorumlusu / manage sonucu GİREMEZ); hiçbir yazım yok', async () => {
    kss = false
    const r = await POST(istek({ sonuc: 'K' }), ctx)
    expect(r.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })
  it('FİF FAALIYET dışında 409 (ör. SORUMLU_ATAMA_BEKLIYOR)', async () => {
    fifFindUnique.mockResolvedValue({ id: 'fif1', kayitNo: 'FIF-2026-001', durum: 'SORUMLU_ATAMA_BEKLIYOR', createdById: 'u1', hazirlayanUserId: 'u1', sorumluBolumId: 'd1', yayinlayanBolumId: 'd2' })
    expect((await POST(istek({ sonuc: 'K' }), ctx)).status).toBe(409)
  })
  it('YT açıklamasız 400; geçersiz sonuç (ES) 400', async () => {
    const r = await POST(istek({ sonuc: 'YT', aciklama: '  ' }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toContain('açıklama zorunlu')
    expect((await POST(istek({ sonuc: 'ES' }), ctx)).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })
  it('zaten kapalı satır 409; eşzamanlı ikinci istek (count 0) 409', async () => {
    faaliyetFindFirst.mockResolvedValueOnce({
      id: 'f1', sira: 2, aciklama: 'x', hedefTarih: new Date('2026-10-15'), sorumluUserId: 'uSatir', sonuc: 'K', gerceklesenTarih: new Date('2026-10-01'),
    })
    expect((await POST(istek({ sonuc: 'K' }), ctx)).status).toBe(409)
    faaliyetUpdateMany.mockResolvedValueOnce({ count: 0 })
    expect((await POST(istek({ sonuc: 'K' }), ctx)).status).toBe(409)
    expect(gecmisCreate).not.toHaveBeenCalled()
  })
})

describe('FİF Sonuç Gir — K (Tamamlandı)', () => {
  it('satır kapanır: gerçekleşen = İstanbul bugünü, paraf = KSS, sonuc K (koşullu güncelleme)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-30T22:30:00.000Z')) // İstanbul: 1 Ekim 01:30
    try {
      const r = await POST(istek({ sonuc: 'K' }), ctx)
      expect(r.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
    const arg = faaliyetUpdateMany.mock.calls[0][0]
    expect(arg.where).toMatchObject({ id: 'f1', fifId: 'fif1' })
    expect(arg.where.OR).toBeDefined() // ACIK_FAALIYET_WHERE
    expect(arg.data).toEqual({
      gerceklesenTarih: new Date('2026-10-01T00:00:00.000Z'), parafUserId: 'uKss', parafTarihi: expect.any(Date), sonuc: 'K',
    })
    expect(fifUpdate).toHaveBeenCalledWith({ where: { id: 'fif1' }, data: { updatedAt: expect.any(Date) } })
    expect(gecmisCreate.mock.calls[0][0].data).toMatchObject({
      fifId: 'fif1', faaliyetId: 'f1', olay: 'FAALIYET_KAPATILDI', eskiDurum: 'FAALIYET', yeniDurum: 'FAALIYET', userId: 'uKss',
    })
  })
  it('bekleyen ek termin IPTAL edilir + EK_TERMIN_IPTAL kaydı', async () => {
    ekTerminFindMany.mockResolvedValue([{ id: 't1', istenenHedefTarih: new Date('2026-11-01') }])
    await POST(istek({ sonuc: 'K' }), ctx)
    expect(ekTerminUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['t1'] }, durum: 'BEKLIYOR' },
      data: { durum: 'IPTAL', kararNotu: 'Faaliyet kapatıldı', kararUserId: 'uKss' },
    })
    expect(gecmisCreate.mock.calls.map((c) => c[0].data.olay)).toEqual(['FAALIYET_KAPATILDI', 'EK_TERMIN_IPTAL'])
  })
  it('satır sorumlusuna bildirim gider', async () => {
    await POST(istek({ sonuc: 'K' }), ctx)
    expect(bildir).toHaveBeenCalledTimes(1)
    expect(bildir.mock.calls[0][0]).toBe('uSatir')
    expect(bildir.mock.calls[0][1]).toContain('kapatıldı')
    expect(bildir.mock.calls[0][3]).toBe('/kalite/fif/fif1')
  })
})

describe('FİF Sonuç Gir — YT (Yapılamadı)', () => {
  it('satır AÇIK kalır: yalnız sonuc YT yazılır; ek termine dokunulmaz', async () => {
    const r = await POST(istek({ sonuc: 'YT', aciklama: 'Tedarikçi parça göndermedi' }), ctx)
    expect(r.status).toBe(200)
    expect(faaliyetUpdateMany.mock.calls[0][0].data).toEqual({ sonuc: 'YT' })
    expect(ekTerminFindMany).not.toHaveBeenCalled()
    expect(ekTerminUpdateMany).not.toHaveBeenCalled()
  })
  it('FifGecmis faaliyetId ile; olay FAALIYET_YAPILAMADI + açıklama', async () => {
    await POST(istek({ sonuc: 'YT', aciklama: 'Tedarikçi parça göndermedi' }), ctx)
    expect(gecmisCreate).toHaveBeenCalledTimes(1)
    const d = gecmisCreate.mock.calls[0][0].data
    expect(d).toMatchObject({ fifId: 'fif1', faaliyetId: 'f1', olay: 'FAALIYET_YAPILAMADI' })
    expect(d.aciklama).toMatch(/^Sonuç YT \(yapılamadı\)/)
    expect(d.aciklama).toContain('Tedarikçi parça göndermedi')
  })
  it('önceki sonucu YT olan satıra tekrar sonuç girilebilir (satır açık)', async () => {
    faaliyetFindFirst.mockResolvedValueOnce({
      id: 'f1', sira: 2, aciklama: 'x', hedefTarih: new Date('2026-10-15'), sorumluUserId: 'uSatir', sonuc: 'YT', gerceklesenTarih: null,
    })
    expect((await POST(istek({ sonuc: 'K' }), ctx)).status).toBe(200)
  })
  it('satır sorumlusuna açıklamalı bildirim gider', async () => {
    await POST(istek({ sonuc: 'YT', aciklama: 'Tedarikçi parça göndermedi' }), ctx)
    expect(bildir.mock.calls[0][0]).toBe('uSatir')
    expect(bildir.mock.calls[0][2]).toContain('Tedarikçi parça göndermedi')
  })
})
