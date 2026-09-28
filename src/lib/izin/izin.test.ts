import { describe, expect, it } from 'vitest'
import { IzinGirdiHatasi, izinGunleri } from './gun-sayimi'
import { hakEdisleri, toplulukGirisi, yasHesapla, yildonumu, yillikIzinSuresi } from './hak-edis'
import { acilisHareketi, ayrilisBakiyesi, bakiye, iptalIadeHareketi, kismiIadeGunu, kullanimHareketi, onizleme, type DefterSatiri } from './bakiye'

// Prod'daki IproTatil kayıtlarıyla aynı: 28 Ekim 2026 YARIM (arife), 29 Ekim 2026 TATIL.
const TATIL = new Map([['2026-10-28', 'YARIM'], ['2026-10-29', 'TATIL']])
const yok = new Map<string, string>()

describe('gün sayımı (PDKS takvimiyle aynı fonksiyon)', () => {
  it('§3.2 tatile denk gelen: 26–30 Ekim 2026 → 2 + 0,5 + 0 + 1 = 3,5', () => {
    const r = izinGunleri({ baslangic: '2026-10-26', bitis: '2026-10-30', gunSayimi: 'IS_GUNU', tatiller: TATIL })
    expect(r.toplam).toBe(3.5)
    expect(r.gunler.map((g) => [g.tarih.slice(8), g.pay, g.takvim])).toEqual([
      ['26', 1, 'CALISMA'], ['27', 1, 'CALISMA'], ['28', 0.5, 'YARIM'], ['29', 0, 'TATIL'], ['30', 1, 'CALISMA'],
    ])
  })
  it('§3.2 hafta sonunu aşan: Cuma 30.10 → Pazartesi 02.11 = 2', () => {
    expect(izinGunleri({ baslangic: '2026-10-30', bitis: '2026-11-02', gunSayimi: 'IS_GUNU', tatiller: TATIL }).toplam).toBe(2)
  })
  it('§3.2 yarım gün: 04.11.2026 öğleden sonra = 0,5; sabah = 0,5', () => {
    expect(izinGunleri({ baslangic: '2026-11-04', bitis: '2026-11-04', baslangicYarim: 'OGLEDEN_SONRA', gunSayimi: 'IS_GUNU', tatiller: yok }))
      .toMatchObject({ toplam: 0.5, gunler: [{ pay: 0.5, yarim: 'OGLEDEN_SONRA' }] })
    expect(izinGunleri({ baslangic: '2026-11-04', bitis: '2026-11-04', bitisYarim: 'SABAH', gunSayimi: 'IS_GUNU', tatiller: yok }).toplam).toBe(0.5)
  })
  it('yarım TATİL gününe: öğleden sonra izni 0, sabah izni 0,5, tam gün izin 0,5', () => {
    const g = (o: object) => izinGunleri({ baslangic: '2026-10-28', bitis: '2026-10-28', gunSayimi: 'IS_GUNU', tatiller: TATIL, ...o }).toplam
    expect(g({ baslangicYarim: 'OGLEDEN_SONRA' })).toBe(0)
    expect(g({ bitisYarim: 'SABAH' })).toBe(0.5)
    expect(g({})).toBe(0.5)
  })
  it('çok günlü: ilk gün öğleden sonra + son gün sabah → 0,5 + 1 + 0,5', () => {
    expect(izinGunleri({ baslangic: '2026-11-04', bitis: '2026-11-06', baslangicYarim: 'OGLEDEN_SONRA', bitisYarim: 'SABAH', gunSayimi: 'IS_GUNU', tatiller: yok }).toplam).toBe(2)
  })
  it('TAKVIM_GUNU (analık): hafta sonu ve tatil DÜŞÜLMEZ', () => {
    expect(izinGunleri({ baslangic: '2026-10-26', bitis: '2026-11-01', gunSayimi: 'TAKVIM_GUNU', tatiller: TATIL }).toplam).toBe(7)
  })
  it('geçersiz girdiler reddedilir', () => {
    const e = (o: object) => () => izinGunleri({ baslangic: '2026-11-04', bitis: '2026-11-04', gunSayimi: 'IS_GUNU', tatiller: yok, ...o })
    expect(e({ bitis: '2026-11-03' })).toThrow(IzinGirdiHatasi)
    expect(e({ baslangicYarim: 'SABAH' })).toThrow(IzinGirdiHatasi) // ilk gün yalnız öğleden sonra
    expect(e({ bitisYarim: 'OGLEDEN_SONRA' })).toThrow(IzinGirdiHatasi) // son gün yalnız sabah
    expect(e({ baslangicYarim: 'OGLEDEN_SONRA', bitisYarim: 'SABAH' })).toThrow(IzinGirdiHatasi) // tek günde ikisi
    expect(e({ bitis: '2028-01-01' })).toThrow(IzinGirdiHatasi) // 366 gün sınırı
  })
})

describe('hak ediş (4857 m.53)', () => {
  it('süre sınırları: 1–5 (5 dahil) 14, 6–14 20, 15+ 26; ilk yıl 0', () => {
    expect([0, 1, 5, 6, 14, 15, 30].map((y) => yillikIzinSuresi(y, 35))).toEqual([0, 14, 14, 20, 20, 26, 26])
  })
  it('yaş: 18 ve altı / 50 ve üstü en az 20; 19–49 kıdem süresi', () => {
    expect([yillikIzinSuresi(2, 18), yillikIzinSuresi(2, 19), yillikIzinSuresi(2, 49), yillikIzinSuresi(2, 50), yillikIzinSuresi(16, 55)]).toEqual([20, 14, 14, 20, 26])
    expect(yasHesapla('1975-10-01', '2026-09-30')).toBe(50)
    expect(yasHesapla('1975-10-01', '2026-10-01')).toBe(51)
  })
  it('§3.2 yıldönümü (5 yıl sınırı): giriş 15.03.2021 → 2026-03-15 +14, 2027-03-15 +20', () => {
    const r = hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2021-03-15', donemler: [], dogumTarihi: '1990-01-01', bas: '2026-01-01', bit: '2027-12-31' })
    expect(r).toEqual([
      { tarih: '2026-03-15', kidemYil: 5, gun: 14, anahtar: 'HAK:p:2026' },
      { tarih: '2027-03-15', kidemYil: 6, gun: 20, anahtar: 'HAK:p:2027' },
    ])
  })
  it('§3.2 yaş kuralı: 51 yaşında, 2. yıldönümü → 20 (14 değil)', () => {
    expect(hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2024-06-01', donemler: [], dogumTarihi: '1975-01-01', bas: '2026-06-01', bit: '2026-06-01' })[0].gun).toBe(20)
  })
  it('kıdem (İV 28.09): hak ediş SON işe girişten — önceki dönemler birleştirilMEZ; gösterim ilk dönemden', () => {
    const d = [{ giris: '2018-01-01', cikis: '2019-12-31' }, { giris: '2022-01-01', cikis: null }]
    const r = hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2022-01-01', donemler: d, dogumTarihi: null, bas: '2026-01-01', bit: '2026-12-31' })
    expect(r).toEqual([{ tarih: '2026-01-01', kidemYil: 4, gun: 14, anahtar: 'HAK:p:2026' }]) // birleştirilseydi 2026-01-02 / 6. yıl / 20
    expect(toplulukGirisi(d, '2022-01-01')).toBe('2018-01-01')
    expect(toplulukGirisi([], '2022-01-01')).toBe('2022-01-01')
    // 2 hafta arayla yeniden işe alınan: yeni girişten 1 yıl dolmadan hak yok
    expect(hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2026-06-01', donemler: [{ giris: '2011-12-26', cikis: '2026-05-17' }], dogumTarihi: null, bas: '2026-01-01', bit: '2026-12-31' })).toEqual([])
  })
  it('29 Şubat başlangıç: artık olmayan yılda 28 Şubat', () => {
    expect(yildonumu('2024-02-29', 1)).toBe('2025-02-28')
    expect(yildonumu('2024-02-29', 4)).toBe('2028-02-29')
  })
  it('§3.2 açılış: açılış tarihine kadarki yıldönümleri yazılmaz, sonrakiler otomatik', () => {
    const r = hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2020-11-10', donemler: [], dogumTarihi: null, acilisTarihi: '2026-10-01', bas: '2025-01-01', bit: '2027-12-31' })
    expect(r.map((h) => h.tarih)).toEqual(['2026-11-10', '2027-11-10'])
  })
  it('§3.2 ayrılış: ayrılıştan sonraki yıldönümü yazılmaz', () => {
    const r = hakEdisleri({ personnelId: 'p', iseGirisTarihi: '2020-03-01', donemler: [], dogumTarihi: null, ayrilisTarihi: '2027-02-15', bas: '2026-01-01', bit: '2028-12-31' })
    expect(r.map((h) => h.tarih)).toEqual(['2026-03-01'])
  })
})

describe('bakiye (defter)', () => {
  const defter: DefterSatiri[] = [
    { hareket: 'ACILIS', gun: 12, tarih: '2026-10-01' },
    { hareket: 'KULLANIM', gun: -3.5, tarih: '2026-10-20' },
  ]
  it('bakiye = defter toplamı; tarihe kadar', () => {
    expect(bakiye(defter)).toBe(8.5)
    expect(bakiye(defter, '2026-10-19')).toBe(12)
  })
  it('§3.2 önizleme: bakiye 12, bekleyen 2, yeni 3,5 → kalan 10 → talep sonrası 6,5', () => {
    expect(onizleme({ bakiye: 12, bekleyen: [2], yeniTalep: 3.5 })).toEqual({ bakiye: 12, rezerve: 2, kalan: 10, sonrasi: 6.5, yeterli: true })
    expect(onizleme({ bakiye: 1, bekleyen: [0.5], yeniTalep: 1 })).toMatchObject({ kalan: 0.5, sonrasi: -0.5, yeterli: false })
  })
  it('§3.2 onaylı iznin iptali: 5 günlük kullanım + iade → bakiye eski haline döner (talep başına tek anahtar)', () => {
    const t = { id: 't5', gunSayisi: 5 }
    const k = kullanimHareketi(t, '2026-11-01')
    const i = iptalIadeHareketi(t, '2026-11-02')
    expect([k.gun, k.anahtar, i.gun, i.anahtar]).toEqual([-5, 'KULLANIM:t5', 5, 'IADE:t5'])
    expect(bakiye([...defter, k, i])).toBe(8.5)
  })
  it('§3.2 başlamış iznin erken bitirilmesi: 5 günün 2\'si kullanıldı → 3 iade', () => {
    const g = izinGunleri({ baslangic: '2026-11-02', bitis: '2026-11-06', gunSayimi: 'IS_GUNU', tatiller: yok }).gunler
    expect(kismiIadeGunu(g, '2026-11-03')).toBe(3)
  })
  it('§3.2 işten ayrılış: kalan 7,5 → ücrete çevrilecek 7,5 (ayrılış sonrası hareket sayılmaz)', () => {
    const d: DefterSatiri[] = [
      { hareket: 'ACILIS', gun: 10, tarih: '2026-01-01' },
      { hareket: 'KULLANIM', gun: -2.5, tarih: '2026-05-01' },
      { hareket: 'HAK_EDIS', gun: 14, tarih: '2027-03-01' }, // ayrılıştan sonra — sayılmaz
    ]
    expect(ayrilisBakiyesi(d, '2026-12-31')).toBe(7.5)
  })
  it('§3.2 açılış: +12, kişi başı tek anahtar; negatif / 0,5 katı olmayan reddedilir', () => {
    expect(acilisHareketi('p1', 12, '2026-10-01')).toMatchObject({ hareket: 'ACILIS', gun: 12, anahtar: 'ACILIS:p1' })
    expect(() => acilisHareketi('p1', -1, '2026-10-01')).toThrow(IzinGirdiHatasi)
    expect(() => acilisHareketi('p1', 1.3, '2026-10-01')).toThrow(IzinGirdiHatasi)
  })
  it('0,5 adımlarında kayan nokta hatası yok (0,1 + 0,2 tuzağı değil)', () => {
    expect(bakiye(Array.from({ length: 7 }, () => ({ hareket: 'KULLANIM' as const, gun: -0.5, tarih: '2026-01-01' })).concat({ hareket: 'ACILIS', gun: 10, tarih: '2026-01-01' }))).toBe(6.5)
  })
})
