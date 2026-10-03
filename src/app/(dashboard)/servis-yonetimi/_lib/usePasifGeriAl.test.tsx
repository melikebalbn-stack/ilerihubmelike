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
})
