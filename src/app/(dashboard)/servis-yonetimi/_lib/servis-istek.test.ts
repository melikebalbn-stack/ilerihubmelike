import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AG_HATASI_MESAJI,
  OTURUM_YOK_MESAJI,
  YETKI_YOK_MESAJI,
  apiHataMesaji,
  jsonIstek,
  servisIstek,
} from './servis-istek'

afterEach(() => vi.unstubAllGlobals())

function fetchStub(yanit: { ok: boolean; status: number; json: () => Promise<unknown> } | Error) {
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (yanit instanceof Error) throw yanit
    return yanit
  }))
}

describe('apiHataMesaji', () => {
  it('403 → "Bu işlem için yetkiniz yok." (gövde message taşımasa da)', () => {
    expect(apiHataMesaji(403, { error: 'Yetersiz yetki' } as never, 'Kaydedilemedi.')).toBe(YETKI_YOK_MESAJI)
    expect(YETKI_YOK_MESAJI).toBe('Bu işlem için yetkiniz yok.')
  })

  it('403, gövde message içerse bile yetki mesajı kazanır', () => {
    expect(apiHataMesaji(403, { message: 'Forbidden' }, 'x')).toBe(YETKI_YOK_MESAJI)
  })

  it('401 → oturum mesajı', () => {
    expect(apiHataMesaji(401, null, 'x')).toBe(OTURUM_YOK_MESAJI)
  })

  it('diğer hatalarda sunucunun Türkçe mesajı olduğu gibi gösterilir', () => {
    expect(apiHataMesaji(400, { message: 'Kod zaten kullanımda.' }, 'x')).toBe('Kod zaten kullanımda.')
    expect(apiHataMesaji(409, { message: 'Çakışma var.' }, 'x')).toBe('Çakışma var.')
  })

  it('mesaj yoksa ya da boşsa varsayılan', () => {
    expect(apiHataMesaji(500, null, 'Kaydedilemedi.')).toBe('Kaydedilemedi.')
    expect(apiHataMesaji(500, { message: '   ' }, 'Kaydedilemedi.')).toBe('Kaydedilemedi.')
    expect(apiHataMesaji(500, { message: 42 }, 'Kaydedilemedi.')).toBe('Kaydedilemedi.')
  })
})

describe('servisIstek', () => {
  it('başarılı yanıt → ok:true', async () => {
    fetchStub({ ok: true, status: 200, json: async () => ({ ok: true, data: 1 }) })
    const s = await servisIstek('/x')
    expect(s.ok).toBe(true)
  })

  it('403 → ok:false + yetki mesajı', async () => {
    fetchStub({ ok: false, status: 403, json: async () => ({ error: 'Yetersiz yetki', required: ['servis.passive'] }) })
    const s = await servisIstek('/x', { method: 'POST' }, 'Pasifleştirilemedi.')
    expect(s).toMatchObject({ ok: false, status: 403, mesaj: 'Bu işlem için yetkiniz yok.' })
  })

  it('HTTP 200 ama gövdede ok:false → hata sayılır', async () => {
    fetchStub({ ok: true, status: 200, json: async () => ({ ok: false, message: 'Reddedildi.' }) })
    expect(await servisIstek('/x')).toMatchObject({ ok: false, mesaj: 'Reddedildi.' })
  })

  it('ağ hatası throw etmez, anlaşılır mesaj döner', async () => {
    fetchStub(new Error('Failed to fetch'))
    expect(await servisIstek('/x')).toMatchObject({ ok: false, status: 0, mesaj: AG_HATASI_MESAJI })
  })

  it('JSON olmayan 500 yanıtı throw etmez, varsayılan mesaj döner', async () => {
    fetchStub({ ok: false, status: 500, json: async () => { throw new SyntaxError('Unexpected token <') } })
    expect(await servisIstek('/x', undefined, 'Kaydedilemedi.')).toMatchObject({ ok: false, mesaj: 'Kaydedilemedi.' })
  })
})

describe('jsonIstek', () => {
  it('method, Content-Type ve gövdeyi kurar', () => {
    expect(jsonIstek('PATCH', { a: 1 })).toEqual({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    })
  })
})
