import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ozet: vi.fn() }))
vi.mock('./kapasite', () => ({ servisKapasiteOzetiGetir: mocks.ozet }))

import {
  AtamaDilimHatasi, asimOnayiKontrol, atamaGunuKapsar, etkiSatiriOlustur, kapasiteEtkisiHesapla,
} from './kapasite-asim'

const GUN = '2026-10-03'
beforeEach(() => vi.resetAllMocks())

describe('C0 ortak kapasite aşımı yardımcısı', () => {
  it('atamaGunuKapsar: yalnız bugünün kapasitesine girenler (ileri tarihli ve bitmiş HARİÇ)', () => {
    const a = { baslangicTarihi: new Date('2026-09-27'), bitisTarihi: null }
    expect(atamaGunuKapsar(a, GUN)).toBe(true)
    expect(atamaGunuKapsar({ ...a, baslangicTarihi: new Date('2026-10-04') }, GUN)).toBe(false)
    expect(atamaGunuKapsar({ ...a, bitisTarihi: new Date('2026-10-02') }, GUN)).toBe(false)
  })

  it('etkiSatiriOlustur: tam dolu + 1 → aşım +1; araç yok → aşım yok; kimse eklenmiyorsa aşım yok', () => {
    const d = { id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'Sabah' }
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 10, kapasite: 10, durum: 'UYGUN' }, 1)).toMatchObject({ once: 10, sonra: 11, asim: true, fazla: 1 })
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 4, kapasite: 0, durum: 'ARAC_YOK' }, 3)).toMatchObject({ asim: false, koltuk: null, aracYok: true })
    expect(etkiSatiriOlustur(d, { atananPersonelSayisi: 12, kapasite: 10, durum: 'ASIM' }, 0).asim).toBe(false)
  })

  it('kapasiteEtkisiHesapla: motoru dilim başına çağırır, güzergâh bilgisini satıra ekler', async () => {
    mocks.ozet.mockResolvedValue({ atananPersonelSayisi: 9, kapasite: 10, durum: 'UYGUN' })
    const s = await kapasiteEtkisiHesapla(
      { id: 'g1', kod: 'ÜSKÜDAR' },
      [{ id: 'd1', kod: 'SABAH_GIDIŞ', ad: 'S' }, { id: 'd2', kod: 'AKŞAM_DÖNÜŞ', ad: 'A' }],
      new Map([['d1', 2], ['d2', 0]]), GUN,
    )
    expect(mocks.ozet).toHaveBeenCalledTimes(2)
    expect(mocks.ozet.mock.calls[0][0]).toBe('g1')
    expect(s[0]).toMatchObject({ guzergahKod: 'ÜSKÜDAR', dilimKod: 'SABAH_GIDIŞ', once: 9, sonra: 11, asim: true, fazla: 1 })
    expect(s[1]).toMatchObject({ dilimKod: 'AKŞAM_DÖNÜŞ', sonra: 9, asim: false })
  })

  it('🔴 asimOnayiKontrol: aşım + onay yok → 409 hatası (kod + yalnız aşan satırlar); onay varsa ya da aşım yoksa geçer', () => {
    const asim = { ...etkiSatiriOlustur({ id: 'd1', kod: 'S', ad: 'S' }, { atananPersonelSayisi: 10, kapasite: 10, durum: 'UYGUN' }, 1) }
    const temiz = etkiSatiriOlustur({ id: 'd2', kod: 'A', ad: 'A' }, { atananPersonelSayisi: 1, kapasite: 10, durum: 'UYGUN' }, 1)
    let e: unknown
    try { asimOnayiKontrol([asim, temiz], false) } catch (x) { e = x }
    expect(e).toBeInstanceOf(AtamaDilimHatasi)
    expect((e as AtamaDilimHatasi).kod).toBe('ASIM_ONAYI_GEREKLI')
    expect(((e as AtamaDilimHatasi).ayrinti as { etki: unknown[] }).etki).toHaveLength(1)
    expect(() => asimOnayiKontrol([asim, temiz], undefined, 'özel mesaj')).toThrow('özel mesaj')
    expect(() => asimOnayiKontrol([asim, temiz], true)).not.toThrow()
    expect(() => asimOnayiKontrol([temiz], false)).not.toThrow()
  })
})
