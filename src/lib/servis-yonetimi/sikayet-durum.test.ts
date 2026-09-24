import { describe, expect, it } from 'vitest'
import type { ServisSikayetDurumu } from '@/generated/prisma'
import {
  SIKAYET_GECISLERI,
  SIKAYET_DURUM_ETIKETLERI,
  gecisIzinli,
  izinliHedefler,
  terminalMi,
  durumAlanlariniDogrula,
  yenidenAcmaMi,
  yenidenAcmaYamasi,
  gecisiUygula,
  type SikayetDurumAlanlari,
} from './sikayet-durum'

const TARIH = new Date('2026-09-20T00:00:00.000Z')
const TARIH2 = new Date('2026-09-24T00:00:00.000Z')

// ----------------------------------------------------------------------------
// 🔴 16 durum çiftinin TAMAMI — tek tek, döngüyle "hepsi ok" denmiyor.
// Matriste olan 6 geçer, olmayan 10 (kendine geçişler dahil) reddedilir.
// ----------------------------------------------------------------------------
describe('gecisIzinli — 4x4 = 16 çiftin tamamı tek tek', () => {
  // --- ACIK'tan (4) ---
  it('ACIK → ACIK  REDDEDİLİR (kendine geçiş)', () => {
    expect(gecisIzinli('ACIK', 'ACIK')).toBe(false)
  })
  it('ACIK → AKSIYON_ALINDI  GEÇER', () => {
    expect(gecisIzinli('ACIK', 'AKSIYON_ALINDI')).toBe(true)
  })
  it('ACIK → KAPANDI  REDDEDİLİR', () => {
    expect(gecisIzinli('ACIK', 'KAPANDI')).toBe(false)
  })
  it('ACIK → REDDEDILDI  GEÇER', () => {
    expect(gecisIzinli('ACIK', 'REDDEDILDI')).toBe(true)
  })

  // --- AKSIYON_ALINDI'dan (4) ---
  it('AKSIYON_ALINDI → ACIK  REDDEDİLİR (geri alma yalnız kapalı durumlardan)', () => {
    expect(gecisIzinli('AKSIYON_ALINDI', 'ACIK')).toBe(false)
  })
  it('AKSIYON_ALINDI → AKSIYON_ALINDI  REDDEDİLİR (kendine geçiş)', () => {
    expect(gecisIzinli('AKSIYON_ALINDI', 'AKSIYON_ALINDI')).toBe(false)
  })
  it('AKSIYON_ALINDI → KAPANDI  GEÇER', () => {
    expect(gecisIzinli('AKSIYON_ALINDI', 'KAPANDI')).toBe(true)
  })
  it('AKSIYON_ALINDI → REDDEDILDI  GEÇER', () => {
    expect(gecisIzinli('AKSIYON_ALINDI', 'REDDEDILDI')).toBe(true)
  })

  // --- KAPANDI'dan (4) ---
  it('KAPANDI → ACIK  GEÇER (hatalı/erken kapanış geri alınır)', () => {
    expect(gecisIzinli('KAPANDI', 'ACIK')).toBe(true)
  })
  it('KAPANDI → AKSIYON_ALINDI  REDDEDİLİR', () => {
    expect(gecisIzinli('KAPANDI', 'AKSIYON_ALINDI')).toBe(false)
  })
  it('KAPANDI → KAPANDI  REDDEDİLİR (kendine geçiş)', () => {
    expect(gecisIzinli('KAPANDI', 'KAPANDI')).toBe(false)
  })
  it('KAPANDI → REDDEDILDI  REDDEDİLİR (kapanmış kayıt doğrudan redde çevrilemez)', () => {
    expect(gecisIzinli('KAPANDI', 'REDDEDILDI')).toBe(false)
  })

  // --- REDDEDILDI'den (4) ---
  it('REDDEDILDI → ACIK  GEÇER (hatalı ret geri alınır)', () => {
    expect(gecisIzinli('REDDEDILDI', 'ACIK')).toBe(true)
  })
  it('REDDEDILDI → AKSIYON_ALINDI  REDDEDİLİR', () => {
    expect(gecisIzinli('REDDEDILDI', 'AKSIYON_ALINDI')).toBe(false)
  })
  it('REDDEDILDI → KAPANDI  REDDEDİLİR', () => {
    expect(gecisIzinli('REDDEDILDI', 'KAPANDI')).toBe(false)
  })
  it('REDDEDILDI → REDDEDILDI  REDDEDİLİR (kendine geçiş)', () => {
    expect(gecisIzinli('REDDEDILDI', 'REDDEDILDI')).toBe(false)
  })

  it('toplamda 16 çiftten TAM 6 tanesi izinli (sayı sabitlendi)', () => {
    const durumlar = Object.keys(SIKAYET_GECISLERI) as ServisSikayetDurumu[]
    const izinli = durumlar.flatMap(f => durumlar.filter(t => gecisIzinli(f, t)))
    expect(durumlar).toHaveLength(4)
    expect(izinli).toHaveLength(6)
  })
})

// ----------------------------------------------------------------------------
// 🔴 ACIK → KAPANDI reddi, MESAJIYLA birlikte
// ----------------------------------------------------------------------------
describe('ACIK → KAPANDI reddi', () => {
  it('reddedilir ve mesaj ne yapılacağını söyler (aksiyon kaydet / reddet)', () => {
    const mevcut: SikayetDurumAlanlari = { durum: 'ACIK' }
    const r = gecisiUygula(mevcut, 'KAPANDI', { kapanisTarihi: TARIH })

    expect(r.gecerli).toBe(false)
    const m = r.hatalar.join(' ')
    expect(m).toContain('doğrudan')
    expect(m).toContain('Aksiyon alındı')
    expect(m).toContain('Reddedildi')
    // "geçersiz durum" gibi içi boş bir mesaj OLMAMALI
    expect(m.toLowerCase()).not.toContain('geçersiz durum')
    // Kayıt değişmemiş olmalı
    expect(r.sonuc.durum).toBe('ACIK')
  })

  it('izinli hedefler ACIK için tam olarak ikisi', () => {
    expect(izinliHedefler('ACIK')).toEqual(['AKSIYON_ALINDI', 'REDDEDILDI'])
  })
})

// ----------------------------------------------------------------------------
// Alan tutarlılığı
// ----------------------------------------------------------------------------
describe('durumAlanlariniDogrula — REDDEDILDI', () => {
  it('kapanisNotu YOKKEN reddedilir ve ret gerekçesi istenir', () => {
    const r = durumAlanlariniDogrula({ durum: 'REDDEDILDI', kapanisTarihi: TARIH })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('ret gerekçesi')
  })

  it('kapanisTarihi YOKKEN reddedilir', () => {
    const r = durumAlanlariniDogrula({ durum: 'REDDEDILDI', kapanisNotu: 'Yersiz bulundu.' })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('kapanış tarihini girin')
  })

  it('yalnız boşluktan ibaret kapanisNotu YETMEZ', () => {
    const r = durumAlanlariniDogrula({ durum: 'REDDEDILDI', kapanisTarihi: TARIH, kapanisNotu: '   ' })
    expect(r.gecerli).toBe(false)
  })

  it('ikisi de doluyken GEÇER', () => {
    const r = durumAlanlariniDogrula({ durum: 'REDDEDILDI', kapanisTarihi: TARIH, kapanisNotu: 'Yersiz bulundu.' })
    expect(r).toEqual({ gecerli: true, hatalar: [] })
  })
})

describe('durumAlanlariniDogrula — AKSIYON_ALINDI', () => {
  it('aksiyon EKSİKken reddedilir', () => {
    const r = durumAlanlariniDogrula({ durum: 'AKSIYON_ALINDI', aksiyonTarihi: TARIH })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('"Aksiyon" alanına yazın')
  })

  it('aksiyonTarihi EKSİKken reddedilir', () => {
    const r = durumAlanlariniDogrula({ durum: 'AKSIYON_ALINDI', aksiyon: 'Firmaya bildirildi' })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('tarihi girin')
  })

  it('ikisi de eksikse İKİ hata birden döner', () => {
    const r = durumAlanlariniDogrula({ durum: 'AKSIYON_ALINDI' })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar).toHaveLength(2)
  })

  it('kapanisTarihi DOLUYKEN reddedilir (henüz kapanmadı)', () => {
    const r = durumAlanlariniDogrula({
      durum: 'AKSIYON_ALINDI', aksiyon: 'Firmaya bildirildi', aksiyonTarihi: TARIH, kapanisTarihi: TARIH2,
    })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('kapanış tarihi taşıyamaz')
  })

  it('aksiyon + aksiyonTarihi doluyken GEÇER', () => {
    const r = durumAlanlariniDogrula({ durum: 'AKSIYON_ALINDI', aksiyon: 'Firmaya bildirildi', aksiyonTarihi: TARIH })
    expect(r.gecerli).toBe(true)
  })
})

describe('durumAlanlariniDogrula — KAPANDI ve ACIK', () => {
  it('KAPANDI kapanisTarihi olmadan reddedilir', () => {
    const r = durumAlanlariniDogrula({ durum: 'KAPANDI' })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('kapanış tarihini girin')
  })

  it('KAPANDI kapanisTarihi ile GEÇER (kapanisNotu zorunlu DEĞİL)', () => {
    expect(durumAlanlariniDogrula({ durum: 'KAPANDI', kapanisTarihi: TARIH }).gecerli).toBe(true)
  })

  it('ACIK kapanisTarihi TAŞIYORSA reddedilir', () => {
    const r = durumAlanlariniDogrula({ durum: 'ACIK', kapanisTarihi: TARIH })
    expect(r.gecerli).toBe(false)
    expect(r.hatalar.join(' ')).toContain('kapanış tarihini temizleyin')
  })

  it('🔴 POZİTİF: "ACIK + aksiyonTarihi DOLU" doğrulayıcıdan GEÇER (yeniden açılmış kayıt)', () => {
    const r = durumAlanlariniDogrula({
      durum: 'ACIK',
      aksiyon: 'Firmaya bildirildi',
      aksiyonTarihi: TARIH,
      kapanisTarihi: null,
    })
    expect(r).toEqual({ gecerli: true, hatalar: [] })
  })
})

// ----------------------------------------------------------------------------
// 🔴 YENİDEN AÇILMA — Ders 76: temizlenen VE korunan, AYNI testte
// ----------------------------------------------------------------------------
describe('yeniden açılma', () => {
  it('🔴 KAPANDI → ACIK: kapanisTarihi NULL OLDU **VE** aksiyonTarihi/aksiyon DEĞİŞMEDİ', () => {
    const mevcut: SikayetDurumAlanlari = {
      durum: 'KAPANDI',
      aksiyon: 'Firmaya bildirildi, sürücü uyarıldı',
      aksiyonTarihi: TARIH,
      kapanisTarihi: TARIH2,
      kapanisNotu: 'Sorun giderildi.',
    }

    const r = gecisiUygula(mevcut, 'ACIK')

    expect(r.gecerli).toBe(true)
    // (1) temizlendi
    expect(r.sonuc.kapanisTarihi).toBeNull()
    expect(r.sonuc.kapanisNotu).toBeNull()
    // (2) VE korundu — ikisi aynı testte
    expect(r.sonuc.aksiyonTarihi).toBe(TARIH)
    expect(r.sonuc.aksiyon).toBe('Firmaya bildirildi, sürücü uyarıldı')
    expect(r.sonuc.durum).toBe('ACIK')
  })

  it('🔴 REDDEDILDI → ACIK: aynı kural (ret gerekçesi temizlenir, aksiyon izi kalır)', () => {
    const mevcut: SikayetDurumAlanlari = {
      durum: 'REDDEDILDI',
      aksiyon: 'İnceleme yapıldı',
      aksiyonTarihi: TARIH,
      kapanisTarihi: TARIH2,
      kapanisNotu: 'Yersiz bulundu.',
    }

    const r = gecisiUygula(mevcut, 'ACIK')

    expect(r.gecerli).toBe(true)
    expect(r.sonuc.kapanisTarihi).toBeNull()
    expect(r.sonuc.kapanisNotu).toBeNull()
    expect(r.sonuc.aksiyonTarihi).toBe(TARIH)
    expect(r.sonuc.aksiyon).toBe('İnceleme yapıldı')
  })

  it('yeniden açılmış kayıt SONRAKİ reddi için gerekçe İSTER (eski not sızmıyor)', () => {
    const acilan = gecisiUygula(
      { durum: 'REDDEDILDI', kapanisTarihi: TARIH2, kapanisNotu: 'Eski gerekçe' },
      'ACIK',
    ).sonuc

    // Gerekçe yazılmadan tekrar reddedilemez — eski metin yeni gerekçe sanılmıyor.
    const tekrarRet = gecisiUygula(acilan, 'REDDEDILDI', { kapanisTarihi: TARIH2 })
    expect(tekrarRet.gecerli).toBe(false)
    expect(tekrarRet.hatalar.join(' ')).toContain('ret gerekçesi')
  })

  it('yenidenAcmaMi yalnız kapalı durumlardan ACIK dönüşünde true', () => {
    expect(yenidenAcmaMi('KAPANDI', 'ACIK')).toBe(true)
    expect(yenidenAcmaMi('REDDEDILDI', 'ACIK')).toBe(true)
    expect(yenidenAcmaMi('AKSIYON_ALINDI', 'ACIK')).toBe(false)
    expect(yenidenAcmaMi('ACIK', 'AKSIYON_ALINDI')).toBe(false)
  })

  it('yama YALNIZ iki alanı taşır — aksiyon alanlarına hiç dokunmuyor', () => {
    expect(yenidenAcmaYamasi()).toEqual({ kapanisTarihi: null, kapanisNotu: null })
    expect(Object.keys(yenidenAcmaYamasi())).toHaveLength(2)
  })
})

// ----------------------------------------------------------------------------
// gecisiUygula — mutlu yol + bütünlük
// ----------------------------------------------------------------------------
describe('gecisiUygula — akış', () => {
  it('ACIK → AKSIYON_ALINDI: alanlar verilince geçer', () => {
    const r = gecisiUygula({ durum: 'ACIK' }, 'AKSIYON_ALINDI', {
      aksiyon: 'Firmaya bildirildi', aksiyonTarihi: TARIH,
    })
    expect(r.gecerli).toBe(true)
    expect(r.sonuc.durum).toBe('AKSIYON_ALINDI')
  })

  it('ACIK → AKSIYON_ALINDI: alanlar verilmezse izin var ama DOĞRULAMA düşer', () => {
    const r = gecisiUygula({ durum: 'ACIK' }, 'AKSIYON_ALINDI')
    expect(r.gecerli).toBe(false)
    expect(r.hatalar).toHaveLength(2)
  })

  it('AKSIYON_ALINDI → KAPANDI: kapanış tarihiyle geçer, aksiyon izi korunur', () => {
    const r = gecisiUygula(
      { durum: 'AKSIYON_ALINDI', aksiyon: 'Bildirildi', aksiyonTarihi: TARIH },
      'KAPANDI',
      { kapanisTarihi: TARIH2 },
    )
    expect(r.gecerli).toBe(true)
    expect(r.sonuc.kapanisTarihi).toBe(TARIH2)
    expect(r.sonuc.aksiyonTarihi).toBe(TARIH)
  })

  it('mutasyon yok — girdi nesnesi değişmiyor', () => {
    const mevcut: SikayetDurumAlanlari = { durum: 'KAPANDI', kapanisTarihi: TARIH2, kapanisNotu: 'not' }
    gecisiUygula(mevcut, 'ACIK')
    expect(mevcut.kapanisTarihi).toBe(TARIH2)
    expect(mevcut.kapanisNotu).toBe('not')
    expect(mevcut.durum).toBe('KAPANDI')
  })
})

// ----------------------------------------------------------------------------
// Matris bütünlüğü
// ----------------------------------------------------------------------------
describe('matris bütünlüğü', () => {
  it('her durum için anahtar var ve hedefler geçerli durum değeri', () => {
    const durumlar = Object.keys(SIKAYET_GECISLERI) as ServisSikayetDurumu[]
    expect(durumlar.sort()).toEqual(['ACIK', 'AKSIYON_ALINDI', 'KAPANDI', 'REDDEDILDI'])
    for (const d of durumlar) {
      for (const h of SIKAYET_GECISLERI[d]) expect(durumlar).toContain(h)
      // hiçbir durum kendine geçemez
      expect(SIKAYET_GECISLERI[d]).not.toContain(d)
    }
  })

  it('bu makinede terminal durum YOK (her kapanış geri alınabilir)', () => {
    for (const d of Object.keys(SIKAYET_GECISLERI) as ServisSikayetDurumu[]) {
      expect(terminalMi(d)).toBe(false)
    }
  })

  it('her durumun Türkçe etiketi var', () => {
    for (const d of Object.keys(SIKAYET_GECISLERI) as ServisSikayetDurumu[]) {
      expect(SIKAYET_DURUM_ETIKETLERI[d]).toBeTruthy()
    }
  })

  it('izinliHedefler kopya döndürür — matris dışarıdan bozulamaz', () => {
    const h = izinliHedefler('ACIK')
    h.push('KAPANDI')
    expect(izinliHedefler('ACIK')).toEqual(['AKSIYON_ALINDI', 'REDDEDILDI'])
  })
})
