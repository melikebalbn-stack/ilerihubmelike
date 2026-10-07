import { describe, it, expect, vi } from 'vitest'
import { oluAbonelikMi, pushDongusu, sendPushToUser, type PushGonderimSonucu } from './push-notifications'

// 07.10.2026: elle hatırlatma gönderiminde bir abonelik 410 ("push subscription
// has unsubscribed or expired") verdi ve her gönderimde tekrar denenip log
// kirletiyordu. Ölü abonelikler artık gönderim anında silinir.

describe('oluAbonelikMi · hangi hata kaydı siler', () => {
  it('410 Gone → ölü', () => {
    expect(oluAbonelikMi({ statusCode: 410 })).toBe(true)
  })

  it('404 Not Found → ölü (RFC 8030: endpoint yok)', () => {
    expect(oluAbonelikMi({ statusCode: 404 })).toBe(true)
  })

  it('GEÇİCİ hatalar kaydı SİLMEZ — 429 kota, 5xx servis, 400', () => {
    for (const kod of [400, 401, 403, 429, 500, 502, 503]) {
      expect(oluAbonelikMi({ statusCode: kod })).toBe(false)
    }
  })

  it('ağ hatası / statusCode taşımayan hata → silmez', () => {
    expect(oluAbonelikMi(new Error('ECONNRESET'))).toBe(false)
    expect(oluAbonelikMi(null)).toBe(false)
    expect(oluAbonelikMi(undefined)).toBe(false)
    expect(oluAbonelikMi('410')).toBe(false) // metin, kod değil
  })
})

const abonelik = (endpoint: string) => ({ id: endpoint, endpoint, p256dh: 'p', auth: 'a' })

describe('pushDongusu · gönderim + temizlik', () => {
  it('hepsi başarılı → silme YOK', async () => {
    const sil = vi.fn()
    const s = await pushDongusu([abonelik('e1'), abonelik('e2')], async () => ({ ok: true, olu: false }), sil)
    expect(s).toEqual({ basarili: 2, silinen: 0, basarisiz: 0 })
    expect(sil).not.toHaveBeenCalled()
  })

  it('410 alan abonelik SİLİNİR, çalışanlara dokunulmaz', async () => {
    const silinen: string[] = []
    const gonder = async (a: { endpoint: string }): Promise<PushGonderimSonucu> =>
      a.endpoint === 'olu' ? { ok: false, olu: true } : { ok: true, olu: false }
    const s = await pushDongusu(
      [abonelik('canli1'), abonelik('olu'), abonelik('canli2')],
      gonder,
      async (a) => void silinen.push(a.endpoint),
    )
    expect(s).toEqual({ basarili: 2, silinen: 1, basarisiz: 1 })
    expect(silinen).toEqual(['olu'])
  })

  it('GEÇİCİ hata → kayıt KORUNUR (başarısız sayılır ama silinmez)', async () => {
    const sil = vi.fn()
    const s = await pushDongusu([abonelik('e1')], async () => ({ ok: false, olu: false }), sil)
    expect(s).toEqual({ basarili: 0, silinen: 0, basarisiz: 1 })
    expect(sil).not.toHaveBeenCalled()
  })

  it('silme fonksiyonu YOKSA gönderim davranışı değişmez', async () => {
    const s = await pushDongusu([abonelik('olu')], async () => ({ ok: false, olu: true }))
    expect(s).toEqual({ basarili: 0, silinen: 0, basarisiz: 1 })
  })

  it('silme patlarsa gönderim sonucu BOZULMAZ', async () => {
    const s = await pushDongusu(
      [abonelik('olu'), abonelik('canli')],
      async (a) => (a.endpoint === 'olu' ? { ok: false, olu: true } : { ok: true, olu: false }),
      async () => {
        throw new Error('db down')
      },
    )
    expect(s.basarili).toBe(1)
    expect(s.silinen).toBe(0) // sayılmadı, ama akış sürdü
    expect(s.basarisiz).toBe(1)
  })

  it('abonelik yoksa sıfır döner', async () => {
    expect(await pushDongusu([], async () => ({ ok: true, olu: false }))).toEqual({
      basarili: 0, silinen: 0, basarisiz: 0,
    })
  })
})

describe('sendPushToUser · test modu ve dar mock', () => {
  it('NOTIFY_TEST_MODE=true → abonelik SORGULANMAZ, silme olmaz', async () => {
    const eski = process.env.NOTIFY_TEST_MODE
    process.env.NOTIFY_TEST_MODE = 'true'
    const findMany = vi.fn()
    const deleteMany = vi.fn()
    const n = await sendPushToUser(
      { pushSubscription: { findMany, deleteMany } },
      'u1',
      { title: 't', body: 'b' },
    )
    expect(n).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
    process.env.NOTIFY_TEST_MODE = eski
  })

  it('abonelik yoksa 0 döner, deleteMany çağrılmaz', async () => {
    const deleteMany = vi.fn()
    const n = await sendPushToUser(
      { pushSubscription: { findMany: async () => [], deleteMany } },
      'u1',
      { title: 't', body: 'b' },
    )
    expect(n).toBe(0)
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
