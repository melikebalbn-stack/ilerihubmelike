import { describe, it, expect } from 'vitest'
import {
  denemeSirala,
  sonrakiSiralama,
  type SiralanabilirSatir,
  type DenemeSiralama,
} from './deneme-liste-siralama'

const DURUM_ETIKET: Record<string, string> = {
  DEGERLENDIRICI1_BEKLIYOR: '1. Değerlendirici',
  MUDUR_YRD_BEKLIYOR: 'Müdür Yardımcısı',
  MUDUR_BEKLIYOR: 'Müdür',
  ONAY_BEKLIYOR: 'Onay',
  IK_BEKLIYOR: 'İnsan Varlıkları',
}

function satir(o: Partial<SiralanabilirSatir> & { ad: string }): SiralanabilirSatir {
  return {
    tur: o.tur ?? 'ALTI_AY',
    durum: o.durum ?? 'MUDUR_BEKLIYOR',
    hedefTarih: o.hedefTarih ?? '2026-10-01',
    yakaRengi: o.yakaRengi ?? 'MAVI',
    puan1: o.puan1 ?? null,
    puan2: o.puan2 ?? null,
    ortalama: o.ortalama ?? null,
    basarili: o.basarili ?? null,
    adimSahibi: o.adimSahibi ?? null,
    personnel: { adSoyad: o.ad, bolum: o.personnel?.bolum ?? 'Kaynakhane' },
  }
}

const adlar = (l: SiralanabilirSatir[]) => l.map((s) => s.personnel.adSoyad)

describe('sonrakiSiralama · üç durumlu başlık', () => {
  it('kapalı → artan → azalan → kapalı', () => {
    let s: DenemeSiralama = null
    s = sonrakiSiralama(s, 'personel')
    expect(s).toEqual({ alan: 'personel', yon: 'asc' })
    s = sonrakiSiralama(s, 'personel')
    expect(s).toEqual({ alan: 'personel', yon: 'desc' })
    s = sonrakiSiralama(s, 'personel')
    expect(s).toBeNull()
  })

  it('başka alana tıklanınca o alan ARTAN başlar', () => {
    expect(sonrakiSiralama({ alan: 'personel', yon: 'desc' }, 'bolum')).toEqual({ alan: 'bolum', yon: 'asc' })
  })
})

describe('denemeSirala · varsayılan', () => {
  it('sıralama KAPALI iken dizi AYNEN döner (sunucu sırası korunur)', () => {
    const l = [satir({ ad: 'Zeki' }), satir({ ad: 'Ahmet' })]
    expect(denemeSirala(l, null, DURUM_ETIKET)).toBe(l) // aynı referans
  })

  it('girdi dizisi DEĞİŞTİRİLMEZ', () => {
    const l = [satir({ ad: 'Zeki' }), satir({ ad: 'Ahmet' })]
    const kopya = [...l]
    denemeSirala(l, { alan: 'personel', yon: 'asc' }, DURUM_ETIKET)
    expect(adlar(l)).toEqual(adlar(kopya))
  })
})

describe('denemeSirala · Türkçe metin (tr-TR)', () => {
  it('İ/ı/ş/ç/ö/ü doğru yerleşir', () => {
    const l = [
      satir({ ad: 'Zeynep' }),
      satir({ ad: 'İlhan' }),
      satir({ ad: 'Irmak' }),
      satir({ ad: 'Çetin' }),
      satir({ ad: 'Şahin' }),
      satir({ ad: 'Ömer' }),
      satir({ ad: 'Ufuk' }),
      satir({ ad: 'Ümit' }),
    ]
    expect(adlar(denemeSirala(l, { alan: 'personel', yon: 'asc' }, DURUM_ETIKET))).toEqual([
      'Çetin', 'Irmak', 'İlhan', 'Ömer', 'Şahin', 'Ufuk', 'Ümit', 'Zeynep',
    ])
  })

  it('azalan, artanın tam tersi', () => {
    const l = [satir({ ad: 'Çetin' }), satir({ ad: 'İlhan' }), satir({ ad: 'Ahmet' })]
    expect(adlar(denemeSirala(l, { alan: 'personel', yon: 'desc' }, DURUM_ETIKET))).toEqual([
      'İlhan', 'Çetin', 'Ahmet',
    ])
  })

  it('bölüm de tr-TR sıralanır', () => {
    const l = [
      satir({ ad: 'a', personnel: { adSoyad: 'a', bolum: 'İdari İşler' } }),
      satir({ ad: 'b', personnel: { adSoyad: 'b', bolum: 'Isıl İşlem' } }),
      satir({ ad: 'c', personnel: { adSoyad: 'c', bolum: 'Çelik' } }),
    ]
    const s = denemeSirala(l, { alan: 'bolum', yon: 'asc' }, DURUM_ETIKET)
    expect(s.map((x) => x.personnel.bolum)).toEqual(['Çelik', 'Isıl İşlem', 'İdari İşler'])
  })
})

describe('denemeSirala · boş değerler DAİMA sonda', () => {
  it('artan sıralamada puanı olmayanlar sonda', () => {
    const l = [satir({ ad: 'bos', puan1: null }), satir({ ad: 'yuksek', puan1: 90 }), satir({ ad: 'dusuk', puan1: 40 })]
    expect(adlar(denemeSirala(l, { alan: 'puan1', yon: 'asc' }, DURUM_ETIKET))).toEqual(['dusuk', 'yuksek', 'bos'])
  })

  it('AZALAN sıralamada da boşlar sonda (başa çıkmaz)', () => {
    const l = [satir({ ad: 'bos', puan1: null }), satir({ ad: 'yuksek', puan1: 90 }), satir({ ad: 'dusuk', puan1: 40 })]
    expect(adlar(denemeSirala(l, { alan: 'puan1', yon: 'desc' }, DURUM_ETIKET))).toEqual(['yuksek', 'dusuk', 'bos'])
  })

  it('adım sahibi boş olanlar sonda (İK aşaması)', () => {
    const l = [satir({ ad: 'ik', adimSahibi: null }), satir({ ad: 'bedri', adimSahibi: 'Bedri Güler' })]
    expect(adlar(denemeSirala(l, { alan: 'adimSahibi', yon: 'desc' }, DURUM_ETIKET))).toEqual(['bedri', 'ik'])
  })

  it('sonucu belli olmayanlar (basarili=null) sonda', () => {
    const l = [
      satir({ ad: 'yok', basarili: null }),
      satir({ ad: 'basarili', basarili: true }),
      satir({ ad: 'basarisiz', basarili: false }),
    ]
    expect(adlar(denemeSirala(l, { alan: 'sonuc', yon: 'asc' }, DURUM_ETIKET))).toEqual([
      'basarili', 'basarisiz', 'yok',
    ])
  })

  it('geçersiz tarih boş sayılır ve sonda kalır', () => {
    const l = [satir({ ad: 'bozuk', hedefTarih: 'gecersiz' }), satir({ ad: 'normal', hedefTarih: '2026-01-01' })]
    expect(adlar(denemeSirala(l, { alan: 'hedefTarih', yon: 'asc' }, DURUM_ETIKET))).toEqual(['normal', 'bozuk'])
  })
})

describe('denemeSirala · sayı ve tarih alanları', () => {
  it('ortalama SAYISAL sıralanır (metin değil: 9 > 80 olmaz)', () => {
    const l = [satir({ ad: 'a', ortalama: 80 }), satir({ ad: 'b', ortalama: 9 }), satir({ ad: 'c', ortalama: 100 })]
    expect(adlar(denemeSirala(l, { alan: 'ortalama', yon: 'asc' }, DURUM_ETIKET))).toEqual(['b', 'a', 'c'])
  })

  it('hedef tarih kronolojik sıralanır', () => {
    const l = [
      satir({ ad: 'kasim', hedefTarih: '2026-11-05' }),
      satir({ ad: 'ocak', hedefTarih: '2026-01-20' }),
      satir({ ad: 'mart', hedefTarih: '2026-03-02' }),
    ]
    expect(adlar(denemeSirala(l, { alan: 'hedefTarih', yon: 'asc' }, DURUM_ETIKET))).toEqual(['ocak', 'mart', 'kasim'])
  })
})

describe('denemeSirala · etiketle sıralanan alanlar', () => {
  it('tür, ekrandaki etiketle sıralanır (2 AY < 6 AY)', () => {
    const l = [satir({ ad: 'alti', tur: 'ALTI_AY' }), satir({ ad: 'iki', tur: 'DENEME_2AY' })]
    expect(adlar(denemeSirala(l, { alan: 'tur', yon: 'asc' }, DURUM_ETIKET))).toEqual(['iki', 'alti'])
  })

  it('durum, Türkçe etiketle sıralanır (ham enum değil)', () => {
    const l = [
      satir({ ad: 'mudur', durum: 'MUDUR_BEKLIYOR' }),
      satir({ ad: 'ik', durum: 'IK_BEKLIYOR' }),
      satir({ ad: 'onay', durum: 'ONAY_BEKLIYOR' }),
    ]
    // Etiketler: "Müdür", "İnsan Varlıkları", "Onay" → tr-TR: İnsan < Müdür < Onay
    expect(adlar(denemeSirala(l, { alan: 'durum', yon: 'asc' }, DURUM_ETIKET))).toEqual(['ik', 'mudur', 'onay'])
  })
})

describe('denemeSirala · kararlılık', () => {
  it('eşit değerlerde özgün sıra korunur', () => {
    const l = [satir({ ad: 'birinci', puan1: 70 }), satir({ ad: 'ikinci', puan1: 70 }), satir({ ad: 'ucuncu', puan1: 70 })]
    expect(adlar(denemeSirala(l, { alan: 'puan1', yon: 'asc' }, DURUM_ETIKET))).toEqual(['birinci', 'ikinci', 'ucuncu'])
    expect(adlar(denemeSirala(l, { alan: 'puan1', yon: 'desc' }, DURUM_ETIKET))).toEqual(['birinci', 'ikinci', 'ucuncu'])
  })
})
