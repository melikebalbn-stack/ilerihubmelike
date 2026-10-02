import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * PUT /api/kalite/fif/[id] — Paket 4 kuralları (veri kaybı testleri route.test.ts'te, AYRI).
 *  · Faaliyet PLANLAMA (yeni satır, satıra uygulama sorumlusu, FAALIYET'te hedef tarih):
 *    yalnız FAALIYET'te; izleme sorumlusu, sorumlu bölüm müdürü (sorumluOnaylayanUserId)
 *    veya manage.
 *  · "Önce kök neden": özet / Ek-1 / 5 Neden üçü de boşken yeni satır 400; aynı
 *    kayıtta gelen kök neden sayılır.
 *  · Uygulama sorumlusu atanınca / değişince o kişiye bildirim (commit sonrası).
 *  · İzleme sorumlusunu formu açan SEÇMEZ: TASLAK…SORUMLU_ATAMA_BEKLIYOR'da payload değeri yazılmaz;
 *    FAALIYET ve sonrasında yalnız sorumlu bölüm müdürü / manage değiştirir veya boşaltır
 *    (diğerleri 403); değişiklik Geçmiş'e yazılır, yeni kişiye bildirim gider (boşaltmada yok).
 */

const MUDUR = 'uMudur'
const IZLEME = 'uIzleme'
let oturum = MUDUR
let manage = false

const fifFindUnique = vi.fn()
const transaction = vi.fn()
const fifUpdate = vi.fn()
const faaliyetFindMany = vi.fn()
const faaliyetCreate = vi.fn()
const faaliyetUpdate = vi.fn()
const faaliyetDeleteMany = vi.fn()
const atamaBildir = vi.fn()
const izlemeBildir = vi.fn()
const userFindFirst = vi.fn()
const gecmisCreate = vi.fn()

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: async () => ({ session: { user: { id: oturum } }, userId: oturum, error: null }),
}))
vi.mock('@/lib/quality/fif-access', () => ({
  fifKapsamindaMi: async () => true,
  fifDuzenleyebilirMi: async () => true,
  canManageFif: () => manage,
}))
vi.mock('@/lib/quality/fif-bildirim', () => ({
  fifFaaliyetAtamaBildir: (...a: unknown[]) => atamaBildir(...a),
  fifIzlemeSorumlusuBildir: (...a: unknown[]) => izlemeBildir(...a),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findUnique: (...a: unknown[]) => fifFindUnique(...a) },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}))
import { PUT } from './route'

const tx = {
  fif: { update: fifUpdate, findUnique: vi.fn(async () => ({ id: 'fif1' })) },
  fifGecmis: { create: gecmisCreate },
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

const fifKaydi = (over: Record<string, unknown> = {}) => ({
  id: 'fif1', kayitNo: 'FIF-2026-007', durum: 'FAALIYET', createdById: 'uAcan', hazirlayanUserId: 'uAcan',
  sorumluBolumId: 'd1', yayinlayanBolumId: 'd2', izlemeSorumlusuUserId: IZLEME,
  yayilimVarMi: false, yayilimAciklama: null, kaynakId: null,
  sorumluOnaylayanUserId: MUDUR, kokNedenAnalizi: 'Kalibrasyon takibi yok', kokNedenler: [], besNedenler: [],
  ...over,
})
const yeniSatir = { sira: 1, aciklama: 'Kalibrasyon planı', hedefTarih: '2026-11-01', sorumluUserId: 'uSatir' }
const mevcutSatir = (over: Record<string, unknown> = {}) => ({
  id: 'f1', parafUserId: null, aciklama: 'a', aksiyonTuru: null, hedefTarih: null, ilkHedefTarih: null,
  sorumluUserId: 'uEski', sonuc: null, gerceklesenTarih: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  oturum = MUDUR
  manage = false
  fifFindUnique.mockResolvedValue(fifKaydi())
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  faaliyetFindMany.mockResolvedValue([])
  atamaBildir.mockResolvedValue(1)
  izlemeBildir.mockResolvedValue(true)
  // Ad = id (Geçmiş açıklaması okunur olsun); uPasif aktif değil.
  userFindFirst.mockImplementation(async ({ where }: { where: { id: string; isActive?: boolean } }) =>
    where.id === 'uPasif' && where.isActive ? null : { id: where.id, name: where.id, email: null, personnel: null })
})

describe('FİF PUT — Paket 4: faaliyet planlaması FAALIYET\'te izleme sorumlusu / müdürde', () => {
  it('müdür ve izleme sorumlusu, kök neden doluyken satır ekler', async () => {
    for (const u of [MUDUR, IZLEME]) {
      oturum = u
      expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(200)
    }
    expect(faaliyetCreate).toHaveBeenCalledTimes(2)
    expect(faaliyetCreate.mock.calls[0][0].data).toMatchObject({ sorumluUserId: 'uSatir', hedefTarih: new Date('2026-11-01') })
  })
  it('manage de ekler', async () => {
    oturum = 'uKalite'; manage = true
    expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(200)
  })
  it('açan kişi / satır sorumlusu → 403, hiçbir satır yazılmaz', async () => {
    for (const u of ['uAcan', 'uSatir']) {
      oturum = u
      const r = await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)
      expect(r.status).toBe(403)
      expect((await r.json()).error).toContain('izleme sorumlusu ve sorumlu bölüm müdürü')
    }
    expect(faaliyetCreate).not.toHaveBeenCalled()
  })
  it('SORUMLU_ATAMA_BEKLIYOR dahil FAALIYET dışında satır eklenemez → 400 (müdür ve manage dahil)', async () => {
    for (const durum of ['TASLAK', 'KSS_KAYIT_BEKLIYOR', 'SORUMLU_ATAMA_BEKLIYOR', 'KAPATMA_BEKLIYOR']) {
      fifFindUnique.mockResolvedValue(fifKaydi({ durum }))
      expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(400)
    }
    manage = true
    expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(400)
    expect(faaliyetCreate).not.toHaveBeenCalled()
  })
  it('FAALIYET\'te boş hedef tarihi girmek planlamadır: açan kişi 403, izleme sorumlusu 200', async () => {
    faaliyetFindMany.mockResolvedValue([mevcutSatir()])
    const body = { faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a', hedefTarih: '2026-12-01' }] }
    oturum = 'uAcan'
    expect((await PUT(istek(body), ctx)).status).toBe(403)
    oturum = IZLEME
    expect((await PUT(istek(body), ctx)).status).toBe(200)
  })
})

describe('FİF PUT — Paket 4: önce kök neden, sonra faaliyet', () => {
  const bos = { kokNedenAnalizi: null, kokNedenler: [], besNedenler: [] }
  it('kök neden üçü de boşken yeni satır → 400 "Önce kök neden…"', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi(bos))
    const r = await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Önce kök neden analizini doldurun')
    expect(faaliyetCreate).not.toHaveBeenCalled()
  })
  it('aynı kayıtta gelen kök neden özeti sayılır', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi(bos))
    expect((await PUT(istek({ kokNedenAnalizi: 'Eğitim eksik', faaliyetler: [yeniSatir] }), ctx)).status).toBe(200)
  })
  it('kayıtlı Ek-1 notu ya da 5 Neden satırı yeterli', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi({ ...bos, kokNedenler: [{ aciklama: 'Makine' }] }))
    expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(200)
    fifFindUnique.mockResolvedValue(fifKaydi({ ...bos, besNedenler: [{ id: 'b1' }] }))
    expect((await PUT(istek({ faaliyetler: [yeniSatir] }), ctx)).status).toBe(200)
  })
  it('kayıtta özet var ama payload özeti SİLİYORSA boş sayılır', async () => {
    expect((await PUT(istek({ kokNedenAnalizi: null, faaliyetler: [yeniSatir] }), ctx)).status).toBe(400)
  })
  it('kök neden boşken MEVCUT satır güncellemesi engellenmez (kural yalnız eklemede)', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi(bos))
    faaliyetFindMany.mockResolvedValue([mevcutSatir()])
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a2' }] }), ctx)).status).toBe(200)
  })
})

describe('FİF PUT — Paket 4: uygulama sorumlusu ataması + bildirim', () => {
  beforeEach(() => faaliyetFindMany.mockResolvedValue([mevcutSatir()]))
  it('izleme sorumlusu sorumluyu değiştirir → yeni kişiye bildirim', async () => {
    oturum = IZLEME
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a', sorumluUserId: 'uYeni' }] }), ctx)).status).toBe(200)
    expect(faaliyetUpdate.mock.calls[0][0].data.sorumluUserId).toBe('uYeni')
    expect(atamaBildir).toHaveBeenCalledTimes(1)
    const [fif, satirlar] = atamaBildir.mock.calls[0]
    expect(fif).toMatchObject({ id: 'fif1', kayitNo: 'FIF-2026-007' })
    expect(satirlar).toEqual([{ sira: 1, aciklama: 'a', hedefTarih: null, sorumluUserId: 'uYeni' }])
  })
  it('yeni satır sorumlusuyla eklenince bildirim; sorumlusuz satırda bildirim YOK', async () => {
    faaliyetFindMany.mockResolvedValue([])
    await PUT(istek({ faaliyetler: [yeniSatir, { sira: 2, aciklama: 'Sorumlusuz' }] }), ctx)
    expect(atamaBildir).toHaveBeenCalledTimes(1)
    expect(atamaBildir.mock.calls[0][1]).toEqual([
      { sira: 1, aciklama: 'Kalibrasyon planı', hedefTarih: new Date('2026-11-01'), sorumluUserId: 'uSatir' },
    ])
  })
  it('sorumlu değişmiyorsa (form aynı değeri geri yollar) bildirim YOK ve müdür dışı kaydedebilir', async () => {
    oturum = 'uAcan'
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a2', sorumluUserId: 'uEski' }] }), ctx)).status).toBe(200)
    expect(atamaBildir).not.toHaveBeenCalled()
  })
  it('müdür dışı sorumluyu değiştiremez / temizleyemez → 403, bildirim yok', async () => {
    oturum = 'uAcan'
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a', sorumluUserId: 'uYeni' }] }), ctx)).status).toBe(403)
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a', sorumluUserId: null }] }), ctx)).status).toBe(403)
    expect(faaliyetUpdate).not.toHaveBeenCalled()
    expect(atamaBildir).not.toHaveBeenCalled()
  })
  it('bildirim hatası kaydı bozmaz (200)', async () => {
    oturum = IZLEME
    atamaBildir.mockRejectedValueOnce(new Error('smtp'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a', sorumluUserId: 'uYeni' }] }), ctx)).status).toBe(200)
  })
})

describe('FİF PUT — Paket 4: izleme sorumlusunu formu açan seçmez', () => {
  it('TASLAK / KSS kaydı / SORUMLU_ATAMA_BEKLIYOR\'da payload\'daki izleme YAZILMAZ', async () => {
    for (const durum of ['TASLAK', 'KSS_KAYIT_BEKLIYOR', 'SORUMLU_ATAMA_BEKLIYOR']) {
      fifUpdate.mockClear()
      fifFindUnique.mockResolvedValue(fifKaydi({ durum }))
      oturum = 'uAcan'
      expect((await PUT(istek({ izlemeSorumlusuUserId: 'uKendisi', standartMadde: '8.7' }), ctx)).status).toBe(200)
      expect(fifUpdate.mock.calls[0][0].data).toEqual({ standartMadde: '8.7', updatedAt: expect.any(Date) })
    }
  })
})

describe('FİF PUT — Paket 4: onay sonrası izleme sorumlusu değişikliği müdürde', () => {
  it('müdür olmayan düzenleyici (açan kişi / izleme sorumlusunun kendisi) değiştiremez → 403, yazım yok', async () => {
    for (const u of ['uAcan', IZLEME]) {
      oturum = u
      const r = await PUT(istek({ izlemeSorumlusuUserId: 'uYeniIzleme' }), ctx)
      expect(r.status).toBe(403)
      expect((await r.json()).error).toContain('yalnız sorumlu bölüm müdürü')
    }
    expect((await PUT(istek({ izlemeSorumlusuUserId: null }), ctx)).status).toBe(403)
    expect(fifUpdate).not.toHaveBeenCalled()
    expect(izlemeBildir).not.toHaveBeenCalled()
  })
  it('müdür değiştirir → yazılır ve yeni kişiye bildirim gider', async () => {
    const r = await PUT(istek({ izlemeSorumlusuUserId: 'uYeniIzleme' }), ctx)
    expect(r.status).toBe(200)
    expect(fifUpdate.mock.calls[0][0].data).toMatchObject({ izlemeSorumlusuUserId: 'uYeniIzleme' })
    expect(izlemeBildir).toHaveBeenCalledTimes(1)
    expect(izlemeBildir.mock.calls[0][0]).toMatchObject({ id: 'fif1', kayitNo: 'FIF-2026-007' })
    expect(izlemeBildir.mock.calls[0][1]).toBe('uYeniIzleme')
  })
  it('manage de değiştirir; kapanış zincirinde de (KAPATMA_BEKLIYOR) aynı kural', async () => {
    oturum = 'uKalite'; manage = true
    expect((await PUT(istek({ izlemeSorumlusuUserId: 'uYeniIzleme' }), ctx)).status).toBe(200)
    manage = false; oturum = 'uAcan'
    fifFindUnique.mockResolvedValue(fifKaydi({ durum: 'KAPATMA_BEKLIYOR' }))
    expect((await PUT(istek({ izlemeSorumlusuUserId: 'uYeniIzleme' }), ctx)).status).toBe(403)
  })
  it('aynı değeri geri göndermek değişiklik sayılmaz (müdür dışı 200, bildirim yok)', async () => {
    oturum = 'uAcan'
    expect((await PUT(istek({ izlemeSorumlusuUserId: IZLEME, standartMadde: '8.7' }), ctx)).status).toBe(200)
    expect(izlemeBildir).not.toHaveBeenCalled()
  })
  it('aktif olmayan kullanıcı seçilirse 400, yazım yok', async () => {
    expect((await PUT(istek({ izlemeSorumlusuUserId: 'uPasif' }), ctx)).status).toBe(400)
    expect(fifUpdate).not.toHaveBeenCalled()
  })
  it('müdür boşaltır → 200, null yazılır, Geçmiş\'e kayıt düşer, bildirim YOK', async () => {
    const r = await PUT(istek({ izlemeSorumlusuUserId: null }), ctx)
    expect(r.status).toBe(200)
    expect(fifUpdate.mock.calls[0][0].data).toMatchObject({ izlemeSorumlusuUserId: null })
    expect(gecmisCreate).toHaveBeenCalledTimes(1)
    expect(gecmisCreate.mock.calls[0][0].data).toEqual({
      fifId: 'fif1', eskiDurum: 'FAALIYET', yeniDurum: 'FAALIYET', userId: MUDUR,
      olay: 'IZLEME_SORUMLUSU_DEGISTI', aciklama: `Faaliyet izleme sorumlusu boşaltıldı (önceki: ${IZLEME})`,
    })
    expect(izlemeBildir).not.toHaveBeenCalled()
  })
  it('değişiklik de Geçmiş\'e yazılır (eski → yeni); değişmeyen kayıtta Geçmiş yok', async () => {
    await PUT(istek({ izlemeSorumlusuUserId: 'uYeniIzleme' }), ctx)
    expect(gecmisCreate.mock.calls[0][0].data).toMatchObject({
      olay: 'IZLEME_SORUMLUSU_DEGISTI', aciklama: `Faaliyet izleme sorumlusu değişti: ${IZLEME} → uYeniIzleme`,
    })
    gecmisCreate.mockClear()
    await PUT(istek({ izlemeSorumlusuUserId: IZLEME }), ctx)
    expect(gecmisCreate).not.toHaveBeenCalled()
  })
})

describe('FİF PUT — Paket 4: ek termin geçmişi olan satır silinemez (FK RESTRICT)', () => {
  it('silme FK RESTRICT ile reddedilirse (P2003) → 400 "Ek termin geçmişi olan faaliyet silinemez."', async () => {
    faaliyetFindMany.mockResolvedValue([mevcutSatir(), mevcutSatir({ id: 'f2' })])
    faaliyetDeleteMany.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'P2003' }))
    const r = await PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a' }] }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Ek termin geçmişi olan faaliyet silinemez.')
    expect(faaliyetDeleteMany.mock.calls[0][0]).toEqual({ where: { fifId: 'fif1', id: { in: ['f2'] } } })
  })
  it('başka bir DB hatası yutulmaz (yeniden fırlatılır)', async () => {
    faaliyetFindMany.mockResolvedValue([mevcutSatir(), mevcutSatir({ id: 'f2' })])
    faaliyetDeleteMany.mockRejectedValueOnce(Object.assign(new Error('baglanti'), { code: 'P1001' }))
    await expect(PUT(istek({ faaliyetler: [{ id: 'f1', sira: 1, aciklama: 'a' }] }), ctx)).rejects.toThrow('baglanti')
  })
})
