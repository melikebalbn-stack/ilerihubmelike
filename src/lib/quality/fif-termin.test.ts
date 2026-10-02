import { describe, it, expect } from 'vitest'
import {
  istanbulGunu, gunFarki, istanbulBugunTarihi, ayEkle, faaliyetKapaliMi, faaliyetTerminEtiketleri,
  etkinlikKontrolAcikMi, faaliyetDurumu, fifKimdeBekliyor, ACIK_FAALIYET_WHERE, TAKIPTEKI_FAALIYET_WHERE, type SatirDurumGirdi,
} from './fif-termin'

/** Date input'tan DB'ye yazılan biçim: UTC gece yarısı. */
const tarih = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('fif-termin — İstanbul günü', () => {
  it('UTC 21:30 = ertesi gün İstanbul', () => {
    expect(istanbulGunu(new Date('2026-09-27T21:30:00.000Z'))).toBe('2026-09-28')
    expect(istanbulGunu(new Date('2026-09-27T20:30:00.000Z'))).toBe('2026-09-27')
  })
  it('gün farkı İstanbul gününe göre (gece yarısı sonrası 1 gün sayılır)', () => {
    expect(gunFarki(tarih('2026-09-27'), new Date('2026-09-27T21:30:00.000Z'))).toBe(1)
    expect(gunFarki(tarih('2026-09-27'), new Date('2026-09-27T20:30:00.000Z'))).toBe(0)
    expect(gunFarki(tarih('2026-09-30'), tarih('2026-09-27'))).toBe(-3)
  })
  it('bugün tarihi = İstanbul gününün UTC gece yarısı', () => {
    expect(istanbulBugunTarihi(new Date('2026-09-27T22:10:00.000Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z')
  })
})

describe('fif-termin — ayEkle (etkinlik +3 ay)', () => {
  it('normal', () => {
    expect(ayEkle(tarih('2026-09-28'), 3).toISOString().slice(0, 10)).toBe('2026-12-28')
  })
  it('ay sonu kırpılır: 30 Kasım + 3 ay = 28 Şubat (yıl geçişi)', () => {
    expect(ayEkle(tarih('2026-11-30'), 3).toISOString().slice(0, 10)).toBe('2027-02-28')
  })
  it('artık yıl: 30 Kasım 2027 + 3 ay = 29 Şubat 2028', () => {
    expect(ayEkle(tarih('2027-11-30'), 3).toISOString().slice(0, 10)).toBe('2028-02-29')
  })
})

describe('fif-termin — rozetler', () => {
  const simdi = new Date('2026-09-28T09:00:00.000Z')
  it('kapalı + zamanında', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: tarih('2026-09-30'), gerceklesenTarih: tarih('2026-09-28'), sonuc: 'K' }, simdi))
      .toEqual([{ metin: 'Zamanında', ton: 'basari' }])
  })
  it('kapalı + hedef günü kapatma zamanında sayılır', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: tarih('2026-09-28'), gerceklesenTarih: tarih('2026-09-28'), sonuc: 'K' }, simdi)[0].metin).toBe('Zamanında')
  })
  it('kapalı + geç', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: tarih('2026-09-20'), gerceklesenTarih: tarih('2026-09-28'), sonuc: 'K' }, simdi))
      .toEqual([{ metin: 'Hedeften 8 gün geç', ton: 'tehlike' }])
  })
  it('kapalı + ek termin: güncel hedefe göre zamanında, ilk hedefe göre geç', () => {
    expect(faaliyetTerminEtiketleri({
      ilkHedefTarih: tarih('2026-09-10'), hedefTarih: tarih('2026-09-30'), gerceklesenTarih: tarih('2026-09-28'), sonuc: 'K',
    }, simdi)).toEqual([{ metin: 'Zamanında', ton: 'basari' }, { metin: 'İlk hedeften 18 gün geç', ton: 'uyari' }])
  })
  it('ilk hedef = hedef ise ikinci rozet yok', () => {
    expect(faaliyetTerminEtiketleri({
      ilkHedefTarih: tarih('2026-09-20'), hedefTarih: tarih('2026-09-20'), gerceklesenTarih: tarih('2026-09-28'), sonuc: 'K',
    }, simdi)).toHaveLength(1)
  })
  it('açık + gecikmede', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: tarih('2026-09-25'), gerceklesenTarih: null, sonuc: null }, simdi))
      .toEqual([{ metin: '3 gün gecikmede', ton: 'tehlike' }])
  })
  it('açık + hedef bugün/ileride → rozet yok', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: tarih('2026-09-28'), gerceklesenTarih: null, sonuc: null }, simdi)).toEqual([])
  })
  it('hedef tarihi yok → rozet yok', () => {
    expect(faaliyetTerminEtiketleri({ hedefTarih: null, gerceklesenTarih: null, sonuc: null }, simdi)).toEqual([])
  })
  it('kapalı = sonuc K + gerçekleşen tarih', () => {
    expect(faaliyetKapaliMi({ sonuc: 'K', gerceklesenTarih: tarih('2026-09-28') })).toBe(true)
    expect(faaliyetKapaliMi({ sonuc: 'K', gerceklesenTarih: null })).toBe(false)
    expect(faaliyetKapaliMi({ sonuc: 'ES', gerceklesenTarih: tarih('2026-09-28') })).toBe(false)
    expect(faaliyetKapaliMi({ sonuc: 'YT', gerceklesenTarih: tarih('2026-09-28') })).toBe(false) // Paket 4: YT açık
  })
})

describe('fif-termin — Paket 3b-2: etkinlik kontrol penceresi (plan − 7 gün)', () => {
  const plan = tarih('2026-12-28')
  it('plan − 8 gün → kapalı, plan − 7 gün → açık (İstanbul günü)', () => {
    expect(etkinlikKontrolAcikMi(plan, new Date('2026-12-20T09:00:00.000Z'))).toBe(false)
    expect(etkinlikKontrolAcikMi(plan, new Date('2026-12-21T09:00:00.000Z'))).toBe(true)
    // 20 Aralık 22:00 UTC = 21 Aralık 01:00 İstanbul → açık
    expect(etkinlikKontrolAcikMi(plan, new Date('2026-12-20T22:00:00.000Z'))).toBe(true)
  })
  it('plan geçmişse de açık; plan yoksa kapalı', () => {
    expect(etkinlikKontrolAcikMi(plan, new Date('2027-01-15T09:00:00.000Z'))).toBe(true)
    expect(etkinlikKontrolAcikMi(null, new Date())).toBe(false)
  })
})

describe('fif-termin — satır durum rozeti ("kimde bekliyor")', () => {
  const temel: SatirDurumGirdi = {
    sonuc: null, gerceklesenTarih: null, etkinlikPlanTarihi: null, etkinlikUygun: null, bekleyenTalep: false, sorumluAd: 'Ayşe Yılmaz',
  }
  it('açık → "Açık — {sorumlu}"; sorumlu yoksa uyarı metni', () => {
    expect(faaliyetDurumu(temel).metin).toBe('Açık — Ayşe Yılmaz')
    expect(faaliyetDurumu({ ...temel, sorumluAd: null }).metin).toBe('Açık — sorumlu atanmamış')
  })
  it('açık + bekleyen talep → "Ek termin onayı bekliyor — KSS"', () => {
    expect(faaliyetDurumu({ ...temel, bekleyenTalep: true }).metin).toBe('Ek termin onayı bekliyor — KSS')
  })
  it('kapalı + plan → "Etkinlik kontrolü bekliyor — {plan}"', () => {
    const r = faaliyetDurumu({ ...temel, sonuc: 'K', gerceklesenTarih: tarih('2026-09-28'), etkinlikPlanTarihi: tarih('2026-12-28') })
    expect(r.metin).toBe('Etkinlik kontrolü bekliyor — 28.12.2026')
  })
  it('kapalı + etkin → "Etkin ✓"', () => {
    expect(faaliyetDurumu({ ...temel, sonuc: 'K', gerceklesenTarih: tarih('2026-09-28'), etkinlikPlanTarihi: tarih('2026-12-28'), etkinlikUygun: true }).metin).toBe('Etkin ✓')
  })
  it('ek termin ONAYLI satır (sonuc=ES) hâlâ açık sayılır', () => {
    expect(faaliyetDurumu({ ...temel, sonuc: 'ES' }).metin).toBe('Açık — Ayşe Yılmaz')
    // Paket 4: KSS "Sonuç Gir" → YT: satır açık, ayrı rozet.
    expect(faaliyetDurumu({ ...temel, sonuc: 'YT' })).toEqual({ metin: 'Yapılamadı (YT) — Ayşe Yılmaz', ton: 'tehlike' })
    expect(faaliyetDurumu({ ...temel, sonuc: 'YT', bekleyenTalep: true }).metin).toBe('Ek termin onayı bekliyor — KSS')
  })
})

describe('fif-termin — FİF başlığı "kimde bekliyor"', () => {
  const simdi = new Date('2026-09-28T09:00:00.000Z')
  const satir = (o: Partial<SatirDurumGirdi>): SatirDurumGirdi => ({
    sonuc: null, gerceklesenTarih: null, etkinlikPlanTarihi: null, etkinlikUygun: null, bekleyenTalep: false, sorumluAd: null, ...o,
  })
  const kapali = (o: Partial<SatirDurumGirdi> = {}) => satir({ sonuc: 'K', gerceklesenTarih: tarih('2026-09-20'), etkinlikPlanTarihi: tarih('2026-12-20'), ...o })
  it('FAALIYET: açık satır sorumluları (tekil) + ek termin bekleyenler KSS', () => {
    const r = fifKimdeBekliyor({
      durum: 'FAALIYET', yeniAkis: false, hazirlayanAd: null, yayinlayanOnaylayanAd: null,
      satirlar: [satir({ sorumluAd: 'Ali' }), satir({ sorumluAd: 'Ali' }), satir({ sorumluAd: 'Veli', bekleyenTalep: true }), kapali()],
    }, simdi)
    expect(r).toBe('Satır sorumluları — Ali (sonucu KSS girer) · KSS — 1 ek termin onayı')
  })
  it('Paket 4 FAALIYET: sorumlusuz açık satır (ör. kapanış reddinden sonra eklenen) planlayanda', () => {
    expect(fifKimdeBekliyor({
      durum: 'FAALIYET', yeniAkis: false, hazirlayanAd: null, yayinlayanOnaylayanAd: null, izlemeAd: 'İz',
      satirlar: [satir({ sorumluAd: null }), satir({ sorumluAd: 'Ali', sonuc: 'YT' }), kapali()],
    }, simdi)).toBe('İzleme sorumlusu (İz) / sorumlu bölüm müdürü — 1 satıra sorumlu ataması · Satır sorumluları — Ali (sonucu KSS girer)')
  })
  it('Paket 4 FAALIYET: kök neden boşsa önce kök neden; doluysa ve satır yoksa faaliyet planı', () => {
    const b = { durum: 'FAALIYET', yeniAkis: false, hazirlayanAd: null, yayinlayanOnaylayanAd: null, izlemeAd: 'İz', satirlar: [] }
    expect(fifKimdeBekliyor({ ...b, kokNedenDolu: false }, simdi)).toBe('İzleme sorumlusu (İz) / sorumlu bölüm müdürü — kök neden analizi')
    expect(fifKimdeBekliyor({ ...b, kokNedenDolu: true }, simdi)).toBe('İzleme sorumlusu (İz) / sorumlu bölüm müdürü — faaliyet planı')
    // Kök neden verilmemiş (eski çağıran) → eski metin
    expect(fifKimdeBekliyor({ ...b, izlemeAd: null }, simdi)).toBe('Faaliyet satırı bekleniyor')
  })
  it('Paket 4 SORUMLU_ATAMA_BEKLIYOR: sorumlu bölüm müdürü (izleme seçimi + onay)', () => {
    const b = { yeniAkis: false, hazirlayanAd: 'H', yayinlayanOnaylayanAd: 'Y', satirlar: [] }
    expect(fifKimdeBekliyor({ ...b, durum: 'SORUMLU_ATAMA_BEKLIYOR', sorumluOnaylayanAd: 'Müdür M' }, simdi))
      .toBe('Sorumlu bölüm müdürü — Müdür M (izleme sorumlusu seçimi + Sorumlu Bölüm Onayı)')
    expect(fifKimdeBekliyor({ ...b, durum: 'SORUMLU_ATAMA_BEKLIYOR' }, simdi))
      .toBe('Sorumlu bölüm müdürü — tanımsız (izleme sorumlusu seçimi + Sorumlu Bölüm Onayı)')
  })
  it('FAALIYET: tüm satırlar kapalı → sıradaki adım "Kapatmaya Gönder" (izleme / bölüm müdürü)', () => {
    expect(fifKimdeBekliyor({
      durum: 'FAALIYET', yeniAkis: true, hazirlayanAd: null, yayinlayanOnaylayanAd: null, satirlar: [kapali(), kapali()],
    }, simdi)).toBe('Sorumlu bölüm müdürü — Kapatmaya Gönder')
  })
  it('Paket 4: izleme sorumlusu boşken planlama sorumlu bölüm müdüründe görünür', () => {
    const b = { durum: 'FAALIYET', yeniAkis: false, hazirlayanAd: null, yayinlayanOnaylayanAd: null, sorumluOnaylayanAd: 'Müdür M', izlemeAd: null }
    expect(fifKimdeBekliyor({ ...b, kokNedenDolu: false, satirlar: [] }, simdi)).toBe('Sorumlu bölüm müdürü (Müdür M) — kök neden analizi')
    expect(fifKimdeBekliyor({ ...b, satirlar: [satir({ sorumluAd: null })] }, simdi)).toBe('Sorumlu bölüm müdürü (Müdür M) — 1 satıra sorumlu ataması')
  })
  it('ETKINLIK yeni akış: kontrol bekleyen sayısı + en yakın plan; hepsi etkinse "Tamamen Kapat"', () => {
    expect(fifKimdeBekliyor({
      durum: 'ETKINLIK', yeniAkis: true, hazirlayanAd: null, yayinlayanOnaylayanAd: null,
      satirlar: [kapali({ etkinlikPlanTarihi: tarih('2026-12-30') }), kapali({ etkinlikPlanTarihi: tarih('2026-12-20') }), kapali({ etkinlikUygun: true })],
    }, simdi)).toBe('KSS — 2 etkinlik kontrolü (en yakın: 20.12.2026)')
    expect(fifKimdeBekliyor({
      durum: 'ETKINLIK', yeniAkis: true, hazirlayanAd: null, yayinlayanOnaylayanAd: null, satirlar: [kapali({ etkinlikUygun: true })],
    }, simdi)).toBe('KSS — Tamamen Kapat')
  })
  it('KSS_KAYIT / eski ETKINLIK / KAPANDI', () => {
    const b = { yeniAkis: false, hazirlayanAd: 'H', yayinlayanOnaylayanAd: 'Y', satirlar: [] }
    expect(fifKimdeBekliyor({ ...b, durum: 'KSS_KAYIT_BEKLIYOR' }, simdi)).toBe('KSS — kayda alma')
    expect(fifKimdeBekliyor({ ...b, durum: 'ETKINLIK' }, simdi)).toBe('KSS — etkinlik değerlendirmesi (FİF geneli)')
    expect(fifKimdeBekliyor({ ...b, durum: 'KAPANDI' }, simdi)).toBe('—')
    expect(fifKimdeBekliyor({ ...b, durum: 'KAPATMA_BEKLIYOR' }, simdi)).toBe('Yayınlayan bölüm müdürü — Y')
  })
})

describe('fif-termin — ACIK_FAALIYET_WHERE (faaliyetKapaliMi\'nin tersi, NULL açık)', () => {
  it('üç kol: sonuc NULL, sonuc ≠ K, gerçekleşen NULL', () => {
    expect(ACIK_FAALIYET_WHERE).toEqual({ OR: [{ sonuc: null }, { sonuc: { not: 'K' } }, { gerceklesenTarih: null }] })
  })
})

describe('fif-termin — TAKIPTEKI_FAALIYET_WHERE (bekleyen talepte hatırlatma/eskalasyon durur)', () => {
  it('açık satır koşulu + bekleyen ek termin talebi YOK', () => {
    expect(TAKIPTEKI_FAALIYET_WHERE).toEqual({
      OR: [{ sonuc: null }, { sonuc: { not: 'K' } }, { gerceklesenTarih: null }],
      ekTerminler: { none: { durum: 'BEKLIYOR' } },
    })
  })
})
