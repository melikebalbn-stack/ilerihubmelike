import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  sikayetListesiGetir: vi.fn(),
  sikayetOlustur: vi.fn(),
  sikayetDetayGetir: vi.fn(),
  sikayetFirmaListesiGetir: vi.fn(),
  sikayetDurumDegistir: vi.fn(),
}))

// 🔴 require-permission MOCK'LANMIYOR — GERÇEK guard koşuyor. Guard
// mock'lansaydı "yalnız view ile POST" testi sahte güvence olurdu: yanlış
// anahtar yazılsa bile test geçerdi. Bir alt katman (oturum + kullanıcı
// izinleri) mock'lanıyor.
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: mocks.getUserPermissions }))

vi.mock('@/lib/servis-yonetimi/sikayet', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/servis-yonetimi/sikayet')>()
  return {
    ...actual,
    sikayetListesiGetir: mocks.sikayetListesiGetir,
    sikayetOlustur: mocks.sikayetOlustur,
    sikayetDetayGetir: mocks.sikayetDetayGetir,
    sikayetFirmaListesiGetir: mocks.sikayetFirmaListesiGetir,
  }
})
vi.mock('@/lib/servis-yonetimi/sikayet-durum-uygula', () => ({
  sikayetDurumDegistir: mocks.sikayetDurumDegistir,
}))

import { GET as LISTE_GET, POST } from './route'
import { GET as DETAY_GET } from './[id]/route'
import { PATCH } from './[id]/durum/route'
import { GET as FIRMA_GET } from './firma-gorunumu/route'
import { SikayetError } from '@/lib/servis-yonetimi/sikayet'

function oturumKur(izinler: string[] | null) {
  if (izinler === null) {
    mocks.getServerSession.mockResolvedValue(null)
    return
  }
  mocks.getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserPermissions.mockResolvedValue(new Set(izinler))
}

const VIEW = 'servis.sikayet.view'
const MANAGE = 'servis.sikayet.manage'

const GOVDE = {
  tarih: '2026-09-20',
  bildirimTarihi: '2026-09-22',
  kategori: 'GEC_GELME',
  aciklama: 'Servis geç geldi.',
  guzergahId: 'g1',
  kaynak: 'IV',
}

const istek = (url = 'http://localhost/api/servis-yonetimi/sikayet', body?: unknown) =>
  new NextRequest(url, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)

const params = { params: Promise.resolve({ id: 's1' }) }

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset())
  mocks.sikayetListesiGetir.mockResolvedValue([])
  mocks.sikayetOlustur.mockResolvedValue({ id: 's1', no: 1 })
  mocks.sikayetDetayGetir.mockResolvedValue({ id: 's1', no: 1 })
  mocks.sikayetFirmaListesiGetir.mockResolvedValue([])
  mocks.sikayetDurumDegistir.mockResolvedValue({ id: 's1', durum: 'AKSIYON_ALINDI' })
})

// ----------------------------------------------------------------------------
// GET liste — servis.sikayet.view
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/sikayet — yetki (Ders 55)', () => {
  it('view izniyle 200', async () => {
    oturumKur([VIEW])
    const res = await LISTE_GET(istek())
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('manage izni de tek başına YETMEZ mi? — view gerektiği için 403', async () => {
    oturumKur([MANAGE])
    const res = await LISTE_GET(istek())
    expect(res.status).toBe(403)
    expect(mocks.sikayetListesiGetir).not.toHaveBeenCalled()
  })

  it('ilgisiz izinle 403', async () => {
    oturumKur(['servis.view'])
    expect((await LISTE_GET(istek())).status).toBe(403)
    expect(mocks.sikayetListesiGetir).not.toHaveBeenCalled()
  })

  it('oturumsuz 401', async () => {
    oturumKur(null)
    expect((await LISTE_GET(istek())).status).toBe(401)
    expect(mocks.sikayetListesiGetir).not.toHaveBeenCalled()
  })
})

describe('GET liste — filtreler', () => {
  beforeEach(() => oturumKur([VIEW]))

  it('filtreler sorgu katmanına iletilir', async () => {
    await LISTE_GET(istek('http://localhost/x?guzergahId=g1&firmaId=f1&durakId=d1&durum=ACIK&kategori=TEMIZLIK&kaynak=PERSONEL'))
    const f = mocks.sikayetListesiGetir.mock.calls[0][0]
    expect(f).toMatchObject({ guzergahId: 'g1', firmaId: 'f1', durakId: 'd1', durum: 'ACIK', kategori: 'TEMIZLIK', kaynak: 'PERSONEL' })
  })

  it('🔴 tarih filtresi bildirimTarihi üzerinden iletilir', async () => {
    await LISTE_GET(istek('http://localhost/x?bildirimBaslangic=2026-09-01&bildirimBitis=2026-09-30'))
    const f = mocks.sikayetListesiGetir.mock.calls[0][0]
    expect(f.bildirimBaslangic).toEqual(new Date('2026-09-01'))
    expect(f.bildirimBitis).toEqual(new Date('2026-09-30'))
  })

  it('geçersiz tarih filtre uygulanmadan geçilir (500 değil)', async () => {
    const res = await LISTE_GET(istek('http://localhost/x?bildirimBaslangic=abc'))
    expect(res.status).toBe(200)
    expect(mocks.sikayetListesiGetir.mock.calls[0][0].bildirimBaslangic).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// POST — servis.sikayet.manage
// ----------------------------------------------------------------------------
describe('POST /api/servis-yonetimi/sikayet — yetki (Ders 55)', () => {
  it('manage izniyle 201', async () => {
    oturumKur([MANAGE])
    const res = await POST(istek(undefined, GOVDE))
    expect(res.status).toBe(201)
  })

  it('🔴 YALNIZ view ile 403 — okuma izni yazmaya yetmez', async () => {
    oturumKur([VIEW])
    const res = await POST(istek(undefined, GOVDE))
    expect(res.status).toBe(403)
    expect(mocks.sikayetOlustur).not.toHaveBeenCalled()
  })

  it('ilgisiz izinle 403', async () => {
    oturumKur(['servis.view'])
    expect((await POST(istek(undefined, GOVDE))).status).toBe(403)
    expect(mocks.sikayetOlustur).not.toHaveBeenCalled()
  })

  it('oturumsuz 401', async () => {
    oturumKur(null)
    expect((await POST(istek(undefined, GOVDE))).status).toBe(401)
    expect(mocks.sikayetOlustur).not.toHaveBeenCalled()
  })
})

describe('POST — gövde ve hata çevirisi', () => {
  beforeEach(() => oturumKur([MANAGE]))

  it('createdById oturumdan gelir, gövdeden DEĞİL', async () => {
    await POST(istek(undefined, { ...GOVDE, createdById: 'SAHTE' }))
    expect(mocks.sikayetOlustur.mock.calls[0][0].createdById).toBe('u1')
  })

  it('tarih alanları Date\'e çevrilir', async () => {
    await POST(istek(undefined, GOVDE))
    const g = mocks.sikayetOlustur.mock.calls[0][0]
    expect(g.tarih).toEqual(new Date('2026-09-20'))
    expect(g.bildirimTarihi).toEqual(new Date('2026-09-22'))
  })

  it('🔴 doğrulama hatası 400 döner ve YOL GÖSTEREN mesaj korunur', async () => {
    mocks.sikayetOlustur.mockRejectedValue(
      new SikayetError('Şikâyetin ne olduğunu "Açıklama" alanına yazın.'),
    )
    const res = await POST(istek(undefined, GOVDE))
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.message).toContain('"Açıklama" alanına yazın')
    expect(j.message).not.toContain('hata oluştu')
  })

  it('beklenmeyen hata 500 döner', async () => {
    mocks.sikayetOlustur.mockRejectedValue(new Error('db patladı'))
    expect((await POST(istek(undefined, GOVDE))).status).toBe(500)
  })
})

// ----------------------------------------------------------------------------
// GET detay
// ----------------------------------------------------------------------------
describe('GET /api/servis-yonetimi/sikayet/[id] — yetki (Ders 55)', () => {
  it('view izniyle 200', async () => {
    oturumKur([VIEW])
    expect((await DETAY_GET(istek(), params)).status).toBe(200)
  })

  it('manage tek başına 403 (view gerekli)', async () => {
    oturumKur([MANAGE])
    expect((await DETAY_GET(istek(), params)).status).toBe(403)
    expect(mocks.sikayetDetayGetir).not.toHaveBeenCalled()
  })

  it('ilgisiz izinle 403', async () => {
    oturumKur(['servis.view'])
    expect((await DETAY_GET(istek(), params)).status).toBe(403)
  })

  it('oturumsuz 401', async () => {
    oturumKur(null)
    expect((await DETAY_GET(istek(), params)).status).toBe(401)
    expect(mocks.sikayetDetayGetir).not.toHaveBeenCalled()
  })

  it('kayıt yoksa 404', async () => {
    oturumKur([VIEW])
    mocks.sikayetDetayGetir.mockResolvedValue(null)
    expect((await DETAY_GET(istek(), params)).status).toBe(404)
  })
})

// ----------------------------------------------------------------------------
// PATCH durum — servis.sikayet.manage
// ----------------------------------------------------------------------------
describe('PATCH /api/servis-yonetimi/sikayet/[id]/durum — yetki (Ders 55)', () => {
  const durumIstegi = (body: unknown = { durum: 'AKSIYON_ALINDI' }) =>
    new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) })

  it('manage izniyle 200', async () => {
    oturumKur([MANAGE])
    expect((await PATCH(durumIstegi(), params)).status).toBe(200)
  })

  it('🔴 YALNIZ view ile 403 — okuma izni durum değiştirmeye yetmez', async () => {
    oturumKur([VIEW])
    expect((await PATCH(durumIstegi(), params)).status).toBe(403)
    expect(mocks.sikayetDurumDegistir).not.toHaveBeenCalled()
  })

  it('ilgisiz izinle 403', async () => {
    oturumKur(['servis.view'])
    expect((await PATCH(durumIstegi(), params)).status).toBe(403)
    expect(mocks.sikayetDurumDegistir).not.toHaveBeenCalled()
  })

  it('oturumsuz 401', async () => {
    oturumKur(null)
    expect((await PATCH(durumIstegi(), params)).status).toBe(401)
    expect(mocks.sikayetDurumDegistir).not.toHaveBeenCalled()
  })
})

describe('PATCH durum — gövde ve hata çevirisi', () => {
  beforeEach(() => oturumKur([MANAGE]))

  const durumIstegi = (body: unknown) =>
    new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) })

  it('userId oturumdan gelir, alanlar iletilir', async () => {
    await PATCH(durumIstegi({ durum: 'AKSIYON_ALINDI', aksiyon: 'Bildirildi', aksiyonTarihi: '2026-09-22' }), params)
    const g = mocks.sikayetDurumDegistir.mock.calls[0][0]
    expect(g.sikayetId).toBe('s1')
    expect(g.yeniDurum).toBe('AKSIYON_ALINDI')
    expect(g.userId).toBe('u1')
    expect(g.alanlar.aksiyon).toBe('Bildirildi')
    expect(g.alanlar.aksiyonTarihi).toEqual(new Date('2026-09-22'))
  })

  it('gönderilmeyen alan `alanlar`a HİÇ eklenmez (kısmi güncelleme)', async () => {
    await PATCH(durumIstegi({ durum: 'KAPANDI', kapanisTarihi: '2026-09-24' }), params)
    const alanlar = mocks.sikayetDurumDegistir.mock.calls[0][0].alanlar
    expect(Object.prototype.hasOwnProperty.call(alanlar, 'aksiyon')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(alanlar, 'kapanisNotu')).toBe(false)
    expect(alanlar.kapanisTarihi).toEqual(new Date('2026-09-24'))
  })

  it('null gönderilen alan null olarak iletilir (temizleme niyeti korunur)', async () => {
    await PATCH(durumIstegi({ durum: 'ACIK', kapanisTarihi: null }), params)
    const alanlar = mocks.sikayetDurumDegistir.mock.calls[0][0].alanlar
    expect(Object.prototype.hasOwnProperty.call(alanlar, 'kapanisTarihi')).toBe(true)
    expect(alanlar.kapanisTarihi).toBeNull()
  })

  it('🔴 geçersiz geçiş 400 döner ve YOL GÖSTEREN mesaj korunur (500 değil)', async () => {
    mocks.sikayetDurumDegistir.mockRejectedValue(
      new SikayetError('"Açık" durumundaki bir şikâyet doğrudan "Kapandı" yapılamaz. Kapatmadan önce ne yapıldığını "Aksiyon alındı" adımında kaydedin; işlem gerektirmiyorsa "Reddedildi" kullanın.'),
    )
    const res = await PATCH(durumIstegi({ durum: 'KAPANDI' }), params)

    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.message).toContain('Aksiyon alındı')
    expect(j.message).toContain('Reddedildi')
    expect(j.message.toLowerCase()).not.toContain('geçersiz durum')
  })

  it('kayıt bulunamadı 404 döner (400 değil)', async () => {
    mocks.sikayetDurumDegistir.mockRejectedValue(new SikayetError('Şikâyet kaydı bulunamadı.'))
    expect((await PATCH(durumIstegi({ durum: 'ACIK' }), params)).status).toBe(404)
  })

  it('beklenmeyen hata 500 döner', async () => {
    mocks.sikayetDurumDegistir.mockRejectedValue(new Error('db patladı'))
    expect((await PATCH(durumIstegi({ durum: 'ACIK' }), params)).status).toBe(500)
  })
})

// ----------------------------------------------------------------------------
// Adım 5D — firma görünümü ucu
// ----------------------------------------------------------------------------
describe('GET .../sikayet/firma-gorunumu', () => {
  it('view izniyle 200', async () => {
    oturumKur([VIEW])
    mocks.sikayetFirmaListesiGetir.mockResolvedValue([])
    const res = await FIRMA_GET(istek('http://localhost/x'))
    expect(res.status).toBe(200)
  })

  it('yetkisiz 403, oturumsuz 401 — sorgu hiç çalışmaz', async () => {
    oturumKur(['servis.view'])
    expect((await FIRMA_GET(istek('http://localhost/x'))).status).toBe(403)
    oturumKur(null)
    expect((await FIRMA_GET(istek('http://localhost/x'))).status).toBe(401)
    expect(mocks.sikayetFirmaListesiGetir).not.toHaveBeenCalled()
  })

  it('filtreler sorgu katmanına iletiliyor', async () => {
    oturumKur([VIEW])
    mocks.sikayetFirmaListesiGetir.mockResolvedValue([])
    await FIRMA_GET(istek('http://localhost/x?firmaId=f1&durakId=d1&bildirimBaslangic=2026-09-01'))

    const f = mocks.sikayetFirmaListesiGetir.mock.calls[0][0]
    expect(f.firmaId).toBe('f1')
    expect(f.durakId).toBe('d1')
    expect(f.bildirimBaslangic).toEqual(new Date('2026-09-01'))
  })

  it('🔴 REGRESYON: yanıtta şikâyetçi kimliği YOK — DESEN TARAMASI', async () => {
    oturumKur([VIEW])
    // Sorgu katmanı şikâyetçi alanlarını zaten seçmiyor; uç de eklememelı.
    mocks.sikayetFirmaListesiGetir.mockResolvedValue([
      { id: 's1', no: 1, durum: 'ACIK', firmaAd: 'Firma A', durak: { id: 'd1', kod: 'D1', ad: 'Durak 1' } },
    ])

    const res = await FIRMA_GET(istek('http://localhost/x'))
    const govde = JSON.stringify(await res.json())

    // Alan sayarak değil, DESENLE: şikâyetçiye dair hiçbir anahtar/veri yok
    expect(govde).not.toMatch(/sikayetci/i)
    expect(govde).not.toMatch(/sikayetciPersonnelId/i)
  })

  it('🔴 FAIL-CLOSED: sorgu katmanı şikâyetçi döndürürse uç 500 verir ve gövdeyi GÖNDERMEZ', async () => {
    oturumKur([VIEW])
    // Sorgu katmanı bir gün yanlışlıkla şikâyetçi seçerse ikinci hat devreye
    // girer. Ayıklama YOK — hata görünür olsun ki select düzeltilsin.
    mocks.sikayetFirmaListesiGetir.mockResolvedValue([
      { id: 's1', sikayetciPersonnelId: 'p1', sikayetci: { adSoyad: 'Ahmet' } },
    ])

    const res = await FIRMA_GET(istek('http://localhost/x'))
    expect(res.status).toBe(500)

    const govde = JSON.stringify(await res.json())
    // Sızan veri yanıtta YOK — ne alan adı ne değeri
    expect(govde).not.toMatch(/sikayetci/i)
    expect(govde).not.toContain('Ahmet')
    expect(govde).not.toContain('p1')
  })

  it('iç içe sızıntıda da 500 (desen derinlemesine taranıyor)', async () => {
    oturumKur([VIEW])
    mocks.sikayetFirmaListesiGetir.mockResolvedValue([
      { id: 's1', durak: { id: 'd1', sikayetciNotu: 'gizli' } },
    ])
    const res = await FIRMA_GET(istek('http://localhost/x'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('gizli')
  })
})
