import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePasifGeriAl } from './usePasifGeriAl'

afterEach(() => vi.unstubAllGlobals())

function kur(yanit: { ok: boolean; status: number; body: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (yanit instanceof Error) throw yanit
    return { ok: yanit.ok, status: yanit.status, json: async () => yanit.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  const yukle = vi.fn()
  const setHata = vi.fn()
  const { result } = renderHook(() => usePasifGeriAl({ yol: 'firma', yukle, setHata }))
  return { result, fetchMock, yukle, setHata }
}

describe('usePasifGeriAl', () => {
  it('başarılı pasifleştirme doğru URL\'ye POST eder ve listeyi yeniler', async () => {
    const t = kur({ ok: true, status: 200, body: { ok: true } })
    await act(async () => { await t.result.current.pasiflestir('f1') })
    expect(t.fetchMock).toHaveBeenCalledWith('/api/servis-yonetimi/firma/f1/pasiflestir', { method: 'POST' })
    expect(t.yukle).toHaveBeenCalledTimes(1)
    expect(t.setHata).toHaveBeenLastCalledWith(null)
  })

  it('başarılı geri alma doğru URL\'ye POST eder', async () => {
    const t = kur({ ok: true, status: 200, body: { ok: true } })
    await act(async () => { await t.result.current.geriAl('f1') })
    expect(t.fetchMock).toHaveBeenCalledWith('/api/servis-yonetimi/firma/f1/geri-al', { method: 'POST' })
    expect(t.yukle).toHaveBeenCalledTimes(1)
  })

  it('🔴 403: hata mesajı gösterilir, liste YENİLENMEZ (sessiz başarısızlık yok)', async () => {
    const t = kur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    await act(async () => { await t.result.current.pasiflestir('f1') })
    expect(t.setHata).toHaveBeenLastCalledWith('Bu işlem için yetkiniz yok.')
    expect(t.yukle).not.toHaveBeenCalled()
  })

  it('geri alma 403: aynı mesaj', async () => {
    const t = kur({ ok: false, status: 403, body: { error: 'Yetersiz yetki' } })
    await act(async () => { await t.result.current.geriAl('f1') })
    expect(t.setHata).toHaveBeenLastCalledWith('Bu işlem için yetkiniz yok.')
    expect(t.yukle).not.toHaveBeenCalled()
  })

  it('sunucu mesajı (400/409) olduğu gibi gösterilir', async () => {
    const t = kur({ ok: false, status: 409, body: { ok: false, message: 'Bağlı kayıt var.' } })
    await act(async () => { await t.result.current.pasiflestir('f1') })
    expect(t.setHata).toHaveBeenLastCalledWith('Bağlı kayıt var.')
  })

  it('ağ hatası: anlaşılır mesaj, yükleme yok', async () => {
    const t = kur(new Error('Failed to fetch'))
    await act(async () => { await t.result.current.pasiflestir('f1') })
    expect(t.setHata).toHaveBeenLastCalledWith(expect.stringContaining('Sunucuya ulaşılamadı'))
    expect(t.yukle).not.toHaveBeenCalled()
  })

  describe('A4 — bağlı aktif kayıt onayı', () => {
    const BAG = [
      { tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145', '41P0327'] },
      { tur: 'SOFOR', etiket: 'Aktif şoför', sayi: 1, ornekler: [] },
    ]
    const GOVDE409 = { ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Bağlı aktif kayıtlar var (2 aktif araç).', bagimliliklar: BAG }

    function kurSirali(yanitlar: { ok: boolean; status: number; body: unknown }[]) {
      const sira = [...yanitlar]
      const fetchMock = vi.fn(async () => {
        const y = sira.shift()!
        return { ok: y.ok, status: y.status, json: async () => y.body }
      })
      vi.stubGlobal('fetch', fetchMock)
      const yukle = vi.fn()
      const setHata = vi.fn()
      const { result } = renderHook(() => usePasifGeriAl({ yol: 'firma', yukle, setHata }))
      return { result, fetchMock, yukle, setHata }
    }

    it('🔴 409 BAGLI_KAYIT_VAR: onay diyaloğu verisi kurulur; hata YOK, liste yenilenmez, ikinci istek YOK', async () => {
      const t = kurSirali([{ ok: false, status: 409, body: GOVDE409 }])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      expect(t.result.current.bagimlilikOnay.bekleyen).toEqual({
        id: 'f1', mesaj: GOVDE409.message, bagimliliklar: BAG, zincirleme: false, notlar: [],
      })
      expect(t.fetchMock).toHaveBeenCalledTimes(1)
      expect(t.yukle).not.toHaveBeenCalled()
      expect(t.setHata).toHaveBeenLastCalledWith(null)
    })

    it('onayla: { onay: true } ile yeniden POST eder, başarıda diyaloğu kapatır ve listeyi yeniler', async () => {
      const t = kurSirali([
        { ok: false, status: 409, body: GOVDE409 },
        { ok: true, status: 200, body: { ok: true } },
      ])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      await act(async () => { await t.result.current.bagimlilikOnay.onayla() })
      const [url, init] = t.fetchMock.mock.calls[1] as unknown as [string, RequestInit]
      expect(url).toBe('/api/servis-yonetimi/firma/f1/pasiflestir')
      expect(JSON.parse(init.body as string)).toEqual({ onay: true })
      expect(t.result.current.bagimlilikOnay.bekleyen).toBeNull()
      expect(t.yukle).toHaveBeenCalledTimes(1)
    })

    it('vazgeç: ikinci istek atılmaz, diyalog kapanır', async () => {
      const t = kurSirali([{ ok: false, status: 409, body: GOVDE409 }])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      act(() => t.result.current.bagimlilikOnay.vazgec())
      expect(t.result.current.bagimlilikOnay.bekleyen).toBeNull()
      expect(t.fetchMock).toHaveBeenCalledTimes(1)
      expect(t.yukle).not.toHaveBeenCalled()
    })

    it('onaylı istek 403 alırsa yetki mesajı gösterilir ve liste yenilenmez', async () => {
      const t = kurSirali([
        { ok: false, status: 409, body: GOVDE409 },
        { ok: false, status: 403, body: { error: 'Yetersiz yetki' } },
      ])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      await act(async () => { await t.result.current.bagimlilikOnay.onayla() })
      expect(t.setHata).toHaveBeenLastCalledWith('Bu işlem için yetkiniz yok.')
      expect(t.yukle).not.toHaveBeenCalled()
    })

    it('409 ama farklı bir hata (BAGLI_KAYIT_VAR değil): normal hata mesajı, diyalog açılmaz', async () => {
      const t = kurSirali([{ ok: false, status: 409, body: { ok: false, message: 'Başka çakışma.' } }])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      expect(t.result.current.bagimlilikOnay.bekleyen).toBeNull()
      expect(t.setHata).toHaveBeenLastCalledWith('Başka çakışma.')
    })

    it('onay bekleyen yokken onayla çağrısı bir şey yapmaz', async () => {
      const t = kurSirali([])
      await act(async () => { await t.result.current.bagimlilikOnay.onayla() })
      expect(t.fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('A5 — firma zinciri: onay diyaloğu bilgisi + seçici geri alma', () => {
    const NOT = 'Araçlar yeni firmaya geçiyorsa önce araçların firmasını değiştirin.'
    const ZINCIR409 = {
      ok: false, kod: 'BAGLI_KAYIT_VAR', message: 'Firma pasifleştirilirse bağlı aktif kayıtlar birlikte pasifleşir/kapanır.',
      bagimliliklar: [{ tur: 'ARAC', etiket: 'Aktif araç', sayi: 2, ornekler: ['41P0145'] }], zincirleme: true, notlar: [NOT],
    }
    const ONIZLEME = { zincirIslemId: 'z1', geriAlinabilirArac: 2, geriAlinabilirSofor: 1, kapananAtama: 3 }

    function kurSirali(yanitlar: { ok: boolean; status: number; body: unknown }[], zincirGeriAl = true) {
      const sira = [...yanitlar]
      const fetchMock = vi.fn(async () => {
        const y = sira.shift()!
        return { ok: y.ok, status: y.status, json: async () => y.body }
      })
      vi.stubGlobal('fetch', fetchMock)
      const yukle = vi.fn()
      const setHata = vi.fn()
      const { result } = renderHook(() => usePasifGeriAl({ yol: 'firma', yukle, setHata, zincirGeriAl }))
      return { result, fetchMock, yukle, setHata }
    }
    const cagri = (t: ReturnType<typeof kurSirali>, i: number) =>
      t.fetchMock.mock.calls[i] as unknown as [string, RequestInit | undefined]

    it('409 zincirleme=true ve notlar diyalog verisine taşınır', async () => {
      const t = kurSirali([{ ok: false, status: 409, body: ZINCIR409 }])
      await act(async () => { await t.result.current.pasiflestir('f1') })
      expect(t.result.current.bagimlilikOnay.bekleyen).toMatchObject({ zincirleme: true, notlar: [NOT] })
    })

    it('🔴 geri al: önce ÖNİZLEME (GET) istenir; birlikte geri alınabilen kayıt varsa seçim diyaloğu açılır, POST YOK', async () => {
      const t = kurSirali([{ ok: true, status: 200, body: { ok: true, data: ONIZLEME } }])
      await act(async () => { await t.result.current.geriAl('f1') })
      expect(cagri(t, 0)[0]).toBe('/api/servis-yonetimi/firma/f1/geri-al-onizleme')
      expect(cagri(t, 0)[1]).toBeUndefined() // GET
      expect(t.result.current.zincirGeriAlSecimi.secim).toEqual({ id: 'f1', onizleme: ONIZLEME })
      expect(t.fetchMock).toHaveBeenCalledTimes(1)
      expect(t.yukle).not.toHaveBeenCalled()
    })

    it('"Birlikte geri al": { zincirGeriAl: true } ile POST', async () => {
      const t = kurSirali([
        { ok: true, status: 200, body: { ok: true, data: ONIZLEME } },
        { ok: true, status: 200, body: { ok: true } },
      ])
      await act(async () => { await t.result.current.geriAl('f1') })
      await act(async () => { await t.result.current.zincirGeriAlSecimi.birlikte() })
      expect(cagri(t, 1)[0]).toBe('/api/servis-yonetimi/firma/f1/geri-al')
      expect(JSON.parse(cagri(t, 1)[1]!.body as string)).toEqual({ zincirGeriAl: true })
      expect(t.result.current.zincirGeriAlSecimi.secim).toBeNull()
      expect(t.yukle).toHaveBeenCalledTimes(1)
    })

    it('"Yalnız firmayı geri al": gövdesiz POST (zincir YOK)', async () => {
      const t = kurSirali([
        { ok: true, status: 200, body: { ok: true, data: ONIZLEME } },
        { ok: true, status: 200, body: { ok: true } },
      ])
      await act(async () => { await t.result.current.geriAl('f1') })
      await act(async () => { await t.result.current.zincirGeriAlSecimi.yalnizFirma() })
      expect(cagri(t, 1)[1]).toEqual({ method: 'POST' })
    })

    it('vazgeç: POST atılmaz', async () => {
      const t = kurSirali([{ ok: true, status: 200, body: { ok: true, data: ONIZLEME } }])
      await act(async () => { await t.result.current.geriAl('f1') })
      act(() => t.result.current.zincirGeriAlSecimi.vazgec())
      expect(t.result.current.zincirGeriAlSecimi.secim).toBeNull()
      expect(t.fetchMock).toHaveBeenCalledTimes(1)
    })

    it('birlikte geri alınabilecek kayıt YOKSA diyalog açılmaz, doğrudan geri alınır', async () => {
      const t = kurSirali([
        { ok: true, status: 200, body: { ok: true, data: { ...ONIZLEME, geriAlinabilirArac: 0, geriAlinabilirSofor: 0 } } },
        { ok: true, status: 200, body: { ok: true } },
      ])
      await act(async () => { await t.result.current.geriAl('f1') })
      expect(t.result.current.zincirGeriAlSecimi.secim).toBeNull()
      expect(cagri(t, 1)[0]).toBe('/api/servis-yonetimi/firma/f1/geri-al')
      expect(t.yukle).toHaveBeenCalledTimes(1)
    })

    it('önizleme 403: yetki mesajı, geri alma yapılmaz', async () => {
      const t = kurSirali([{ ok: false, status: 403, body: { error: 'Yetersiz yetki' } }])
      await act(async () => { await t.result.current.geriAl('f1') })
      expect(t.setHata).toHaveBeenLastCalledWith('Bu işlem için yetkiniz yok.')
      expect(t.fetchMock).toHaveBeenCalledTimes(1)
    })

    it('zincirGeriAl seçeneği KAPALIYSA (diğer paneller) önizleme istenmez', async () => {
      const t = kurSirali([{ ok: true, status: 200, body: { ok: true } }], false)
      await act(async () => { await t.result.current.geriAl('f1') })
      expect(cagri(t, 0)[0]).toBe('/api/servis-yonetimi/firma/f1/geri-al')
    })
  })
})
