import { describe, expect, it } from 'vitest'
import { aktarimOzetiHesapla, type AktarimGunSatir, type GunDurumKod } from './puantaj-aktarim-ozet'

const g = (
  gunNo: number,
  durum: GunDurumKod,
  calismaDakika: number | null = null,
  opts: { fazlaDakika?: number | null; izinPay?: number | null; gece?: boolean } = {},
): AktarimGunSatir => ({
  gun: new Date(Date.UTC(2026, 8, gunNo)),
  durum,
  calismaDakika,
  fazlaDakika: opts.fazlaDakika ?? null,
  izinPay: opts.izinPay ?? null,
  gece: opts.gece ?? false,
})

describe('aktarimOzetiHesapla — devam özeti (ücret yok)', () => {
  it('tam çalışma günleri net saat ve gün sayar', () => {
    const o = aktarimOzetiHesapla([g(1, 'TAM', 540), g(2, 'TAM_FORMLA', 540)])
    expect(o.normalGun).toBe(2)
    expect(o.calismaSaat).toBe(18) // 2 × 9 saat
    expect(o.fazlaMesaiSaat).toBe(0)
  })

  it('fazla mesai dakikası ayrı toplanır, çalışmaya karışmaz', () => {
    const o = aktarimOzetiHesapla([g(1, 'TAM', 540, { fazlaDakika: 60 })])
    expect(o.calismaSaat).toBe(9)
    expect(o.fazlaMesaiSaat).toBe(1)
  })

  it('MESAI günü tamamen fazla mesai sayılır', () => {
    const o = aktarimOzetiHesapla([g(7, 'MESAI', 300)])
    expect(o.mesaiGun).toBe(1)
    expect(o.calismaSaat).toBe(0)
    expect(o.fazlaMesaiSaat).toBe(5)
  })

  it('gece vardiyası net saati geceSaat olarak da sayılır', () => {
    const o = aktarimOzetiHesapla([g(1, 'TAM', 540, { gece: true }), g(2, 'TAM', 540)])
    expect(o.calismaSaat).toBe(18)
    expect(o.geceSaat).toBe(9)
  })

  it('izin/rapor payları (yarım gün dahil) toplanır', () => {
    const o = aktarimOzetiHesapla([g(1, 'IZINLI', null, { izinPay: 0.5 }), g(2, 'IZINLI', null, { izinPay: 1 }), g(3, 'RAPORLU', null, { izinPay: 1 })])
    expect(o.izinGun).toBe(1.5)
    expect(o.raporGun).toBe(1)
  })

  it('tatil/devamsızlık/eksik kayıt ayrı sayılır', () => {
    const o = aktarimOzetiHesapla([g(5, 'HAFTA_SONU'), g(6, 'TATIL'), g(7, 'GELMEDI'), g(8, 'EKSIK_GIRIS'), g(9, 'EKSIK_CIKIS')])
    expect(o.haftaTatiliGun).toBe(1)
    expect(o.resmiTatilGun).toBe(1)
    expect(o.eksikGun).toBe(1)
    expect(o.eksikKayitGun).toBe(2)
  })

  it('BEKLENMIYOR günü IFS satırına girmez', () => {
    const o = aktarimOzetiHesapla([g(1, 'BEKLENMIYOR'), g(2, 'TAM', 540)])
    expect(o.gunler).toHaveLength(1)
    expect(o.gunler[0]).toMatchObject({ gun: 2, tip: 'CALISMA', saat: 9 })
  })

  it('gün dökümü ayın gününe göre sıralı', () => {
    const o = aktarimOzetiHesapla([g(10, 'TAM', 540), g(2, 'TAM', 540)])
    expect(o.gunler.map((x) => x.gun)).toEqual([2, 10])
  })
})
