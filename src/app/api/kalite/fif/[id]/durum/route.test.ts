import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * POST /api/kalite/fif/[id]/durum — Paket 4 adımları.
 *  · KSS "Kayda Al ve Yönlendir": KSS_KAYIT_BEKLIYOR → SORUMLU_ATAMA_BEKLIYOR; numara
 *    AYNI transaction'da verilir; doğrudan FAALIYET'e geçiş 400. Müdür (snapshot) yoksa 400.
 *  · "Sorumlu Bölüm Onayı": SORUMLU_ATAMA_BEKLIYOR → FAALIYET; müdür / manage; izleme
 *    sorumlusu istekle seçilir (aktif kullanıcı), kayda yazılır; bildirim ona gider.
 */

let oturum = 'uKss'
let kss = true
let manage = false

const fifFindUnique = vi.fn()
const transaction = vi.fn()
const fifUpdate = vi.fn()
const gecmisCreate = vi.fn()
const faaliyetUpdateMany = vi.fn()
const numara = vi.fn()
const bildir = vi.fn()
const userFindFirst = vi.fn()

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: async () => ({ session: { user: { id: oturum } }, userId: oturum, error: null }),
}))
vi.mock('@/lib/quality/fif-access', () => ({
  canManageFif: () => manage,
  isFifKss: async () => kss,
}))
vi.mock('@/lib/quality/fif-zincir', () => ({ fifZinciriCoz: vi.fn() }))
vi.mock('@/lib/quality/fif-bildirim', () => ({ fifDurumBildir: (...a: unknown[]) => bildir(...a) }))
vi.mock('@/lib/quality/fif-no', () => ({
  generateNextFifNo: (...a: unknown[]) => numara(...a),
  fifNoYili: () => 2026,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    fif: { findUnique: (...a: unknown[]) => fifFindUnique(...a) },
    departmentDefinition: { findUnique: async () => null },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}))
import { POST } from './route'

const tx = { fif: { update: fifUpdate }, fifGecmis: { create: gecmisCreate }, fifFaaliyet: { updateMany: faaliyetUpdateMany } }

const ctx = { params: Promise.resolve({ id: 'fif1' }) }
const istek = (hedef: string, ek: Record<string, unknown> = {}) =>
  new NextRequest('http://local/api/kalite/fif/fif1/durum', {
    method: 'POST', body: JSON.stringify({ hedef, ...ek }), headers: { 'content-type': 'application/json' },
  })

const satir = (o: Record<string, unknown> = {}) => ({
  id: 'f1', hedefTarih: new Date('2026-11-01'), etkinlikPlanTarihi: null, etkinlikUygun: null,
  sorumluUserId: 'uSatir', sonuc: null, gerceklesenTarih: null, parafUserId: null, ...o,
})
const fifKaydi = (over: Record<string, unknown> = {}) => ({
  id: 'fif1', kayitNo: null, durum: 'KSS_KAYIT_BEKLIYOR', createdById: 'uAcan', hazirlayanUserId: 'uAcan',
  yayinlayanOnaylayanUserId: 'uYayin', sorumluOnaylayanUserId: 'uMudur', izlemeSorumlusuUserId: null,
  sorumluBolumId: 'd1', yayinlayanBolumId: 'd2', uygunsuzlukTanimi: 'Tespit', tur: 'DUZELTICI',
  yayilimVarMi: false, yayilimAciklama: null, kokNedenAnalizi: null,
  faaliyetler: [], etkinlikler: [], kokNedenler: [], besNedenler: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  oturum = 'uKss'; kss = true; manage = false
  transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  numara.mockResolvedValue('FIF-2026-007')
  bildir.mockResolvedValue({ hedefSayisi: 1 })
  // Sorumlu bölüm müdürü çözümü (departmentDefinition null) bu yola girmez; yalnız izleme seçimi.
  userFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) =>
    where.id === 'uIzleme' ? { id: 'uIzleme', name: 'İzleme Kişi', email: null, personnel: null } : null)
})

describe('FİF durum — Paket 4: Kayda Al → SORUMLU_ATAMA_BEKLIYOR', () => {
  it('KSS kayda alır: durum SORUMLU_ATAMA_BEKLIYOR, numara + kayıt tarihi aynı transaction\'da', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi())
    const r = await POST(istek('SORUMLU_ATAMA_BEKLIYOR'), ctx)
    expect(r.status).toBe(200)
    expect((await r.json()).kayitNo).toBe('FIF-2026-007')
    expect(numara).toHaveBeenCalledWith(2026, tx)
    expect(fifUpdate.mock.calls[0][0].data).toMatchObject({
      durum: 'SORUMLU_ATAMA_BEKLIYOR', kayitNo: 'FIF-2026-007', kayitTarihi: expect.any(Date), kssUserId: 'uKss',
    })
    expect(gecmisCreate.mock.calls[0][0].data).toMatchObject({ eskiDurum: 'KSS_KAYIT_BEKLIYOR', yeniDurum: 'SORUMLU_ATAMA_BEKLIYOR' })
    expect(bildir.mock.calls[0][1]).toBe('SORUMLU_ATAMA_BEKLIYOR')
  })
  it('kayıttan doğrudan FAALIYET\'e geçiş 400 (müdür adımı atlanamaz)', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi())
    expect((await POST(istek('FAALIYET'), ctx)).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })
  it('FAIL-CLOSED: sorumlu bölüm müdürü (snapshot) yoksa 400, numara verilmez', async () => {
    fifFindUnique.mockResolvedValue(fifKaydi({ sorumluOnaylayanUserId: null }))
    const r = await POST(istek('SORUMLU_ATAMA_BEKLIYOR'), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toContain('müdürü bulunamadı')
    expect(numara).not.toHaveBeenCalled()
  })
})

describe('FİF durum — Paket 4: Sorumlu Bölüm Onayı (SORUMLU_ATAMA_BEKLIYOR → FAALIYET)', () => {
  const bekleyen = (over: Record<string, unknown> = {}) =>
    fifKaydi({ durum: 'SORUMLU_ATAMA_BEKLIYOR', kayitNo: 'FIF-2026-007', ...over })
  beforeEach(() => { oturum = 'uMudur'; kss = false })

  it('müdür izleme sorumlusunu seçip onaylar: FAALIYET + izleme yazılır; kök neden / satır şartı YOK', async () => {
    fifFindUnique.mockResolvedValue(bekleyen())
    const r = await POST(istek('FAALIYET', { izlemeSorumlusuUserId: 'uIzleme' }), ctx)
    expect(r.status).toBe(200)
    expect(numara).not.toHaveBeenCalled()
    expect(fifUpdate.mock.calls[0][0].data).toMatchObject({ durum: 'FAALIYET', izlemeSorumlusuUserId: 'uIzleme' })
    expect(gecmisCreate.mock.calls[0][0].data.aciklama).toBe('Sorumlu bölüm onayı — faaliyet izleme sorumlusu: İzleme Kişi')
    const [girdi, hedef] = bildir.mock.calls[0]
    expect(hedef).toBe('FAALIYET')
    expect(girdi.durum).toBe('SORUMLU_ATAMA_BEKLIYOR')
    expect(girdi.izlemeSorumlusuUserId).toBe('uIzleme')
  })
  it('izleme sorumlusu seçilmeden 400; kayıttaki eski değer yetmez (seçim zorunlu)', async () => {
    fifFindUnique.mockResolvedValue(bekleyen({ izlemeSorumlusuUserId: 'uEski' }))
    const r = await POST(istek('FAALIYET'), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('Faaliyet izleme sorumlusu seçilmeli')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('aktif olmayan / bilinmeyen kullanıcı seçilirse 400', async () => {
    fifFindUnique.mockResolvedValue(bekleyen())
    const r = await POST(istek('FAALIYET', { izlemeSorumlusuUserId: 'uYok' }), ctx)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toContain('aktif')
  })
  it('müdür dışı (KSS dahil) → 403; manage → 200', async () => {
    fifFindUnique.mockResolvedValue(bekleyen())
    oturum = 'uKss'; kss = true
    expect((await POST(istek('FAALIYET', { izlemeSorumlusuUserId: 'uIzleme' }), ctx)).status).toBe(403)
    oturum = 'uKalite'; kss = false; manage = true
    expect((await POST(istek('FAALIYET', { izlemeSorumlusuUserId: 'uIzleme' }), ctx)).status).toBe(200)
  })
  it('başka geçişlerde gönderilen izleme alanı YAZILMAZ (ör. Kayda Al)', async () => {
    oturum = 'uKss'; kss = true
    fifFindUnique.mockResolvedValue(fifKaydi())
    expect((await POST(istek('SORUMLU_ATAMA_BEKLIYOR', { izlemeSorumlusuUserId: 'uIzleme' }), ctx)).status).toBe(200)
    expect('izlemeSorumlusuUserId' in fifUpdate.mock.calls[0][0].data).toBe(false)
  })
})
