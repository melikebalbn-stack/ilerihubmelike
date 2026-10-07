import { describe, it, expect } from 'vitest'
import {
  GECIS_YASAK_HATASI,
  adimSahibi,
  aksiyonUygunMu,
  hedefDurum,
  kapaliMi,
  sahitKarariSonrasiDurum,
  sahitRedVarMi,
  sahitlerTamamlandiMi,
  type TutanakAksiyon,
} from './tutanak-durum'
import { sonrakiTutanakNo } from './tutanak-no'
import {
  basamaklariKur,
  kademeBul,
  secilebilirBasamaklar,
  sonYoneticiSec,
} from './tutanak-yoneticiler'
import type { TutanakDurum, TutanakSahitDurum } from '@/generated/prisma'

const TUM_DURUMLAR: TutanakDurum[] = [
  'TASLAK',
  'SAHIT_BEKLIYOR',
  'YONETICI_BEKLIYOR',
  'IK_BEKLIYOR',
  'TAMAMLANDI',
  'REDDEDILDI',
]
const TUM_AKSIYONLAR: TutanakAksiyon[] = [
  'GONDER',
  'SAHIT_ONAY',
  'SAHIT_RET',
  'YONETICI_ONAY',
  'YONETICI_RET',
  'IV_KAPAT',
]

describe('akış geçişleri — mutlu yol', () => {
  it('TASLAK → SAHIT_BEKLIYOR → YONETICI_BEKLIYOR → IK_BEKLIYOR → TAMAMLANDI', () => {
    expect(aksiyonUygunMu('TASLAK', 'GONDER')).toBe(true)
    expect(hedefDurum('GONDER')).toBe('SAHIT_BEKLIYOR')
    // Tek şahit onaylayınca yöneticiye geçer
    expect(sahitKarariSonrasiDurum(['ONAYLADI'])).toBe('YONETICI_BEKLIYOR')
    expect(aksiyonUygunMu('YONETICI_BEKLIYOR', 'YONETICI_ONAY')).toBe(true)
    expect(hedefDurum('YONETICI_ONAY')).toBe('IK_BEKLIYOR')
    expect(aksiyonUygunMu('IK_BEKLIYOR', 'IV_KAPAT')).toBe(true)
    expect(hedefDurum('IV_KAPAT')).toBe('TAMAMLANDI')
  })

  it('kapanmış tutanakta HİÇBİR aksiyon çalışmaz', () => {
    for (const durum of ['TAMAMLANDI', 'REDDEDILDI'] as TutanakDurum[]) {
      expect(kapaliMi(durum)).toBe(true)
      for (const a of TUM_AKSIYONLAR) expect(aksiyonUygunMu(durum, a)).toBe(false)
    }
  })

  it('matris DENY-BY-DEFAULT: 36 çiftin yalnız 6 tanesi açık', () => {
    const acik = TUM_DURUMLAR.flatMap((d) => TUM_AKSIYONLAR.filter((a) => aksiyonUygunMu(d, a)).map((a) => `${d}:${a}`))
    expect(acik.sort()).toEqual(
      [
        'TASLAK:GONDER',
        'SAHIT_BEKLIYOR:SAHIT_ONAY',
        'SAHIT_BEKLIYOR:SAHIT_RET',
        'YONETICI_BEKLIYOR:YONETICI_ONAY',
        'YONETICI_BEKLIYOR:YONETICI_RET',
        'IK_BEKLIYOR:IV_KAPAT',
      ].sort(),
    )
    expect(GECIS_YASAK_HATASI).toContain('yapılamaz')
  })

  it('sıra atlanamaz: taslak doğrudan yönetici/İV adımına geçemez', () => {
    expect(aksiyonUygunMu('TASLAK', 'YONETICI_ONAY')).toBe(false)
    expect(aksiyonUygunMu('TASLAK', 'IV_KAPAT')).toBe(false)
    expect(aksiyonUygunMu('SAHIT_BEKLIYOR', 'YONETICI_ONAY')).toBe(false)
    expect(aksiyonUygunMu('YONETICI_BEKLIYOR', 'IV_KAPAT')).toBe(false)
  })
})

describe('çoklu şahit — paralel onay', () => {
  it('eksik onay varken durum SAHIT_BEKLIYOR kalır', () => {
    const d: TutanakSahitDurum[] = ['ONAYLADI', 'BEKLIYOR', 'BEKLIYOR']
    expect(sahitlerTamamlandiMi(d)).toBe(false)
    expect(sahitKarariSonrasiDurum(d)).toBe('SAHIT_BEKLIYOR')
  })

  it('üç şahidin TAMAMI onaylayınca yöneticiye geçer', () => {
    const d: TutanakSahitDurum[] = ['ONAYLADI', 'ONAYLADI', 'ONAYLADI']
    expect(sahitlerTamamlandiMi(d)).toBe(true)
    expect(sahitKarariSonrasiDurum(d)).toBe('YONETICI_BEKLIYOR')
  })

  it('bir şahit reddederse kalan şahitler BEKLENMEZ → REDDEDILDI', () => {
    const d: TutanakSahitDurum[] = ['ONAYLADI', 'REDDETTI', 'BEKLIYOR']
    expect(sahitRedVarMi(d)).toBe(true)
    expect(sahitKarariSonrasiDurum(d)).toBe('REDDEDILDI')
  })

  it('şahitsiz tutanak tamamlanmış sayılmaz (en az 1 şahit şartı)', () => {
    expect(sahitlerTamamlandiMi([])).toBe(false)
    expect(sahitKarariSonrasiDurum([])).toBe('SAHIT_BEKLIYOR')
  })
})

describe('adım sahibi', () => {
  const temel = {
    acanUserId: 'u-acan',
    yoneticiId: 'p-yonetici',
    sahitler: [
      { personnelId: 'p-s1', durum: 'ONAYLADI' as TutanakSahitDurum },
      { personnelId: 'p-s2', durum: 'BEKLIYOR' as TutanakSahitDurum },
    ],
  }

  it('TASLAK → oluşturan', () => {
    expect(adimSahibi({ ...temel, durum: 'TASLAK' })).toEqual({ tur: 'ACAN', userId: 'u-acan' })
  })

  it('SAHIT_BEKLIYOR → YALNIZ henüz karar vermemiş şahitler', () => {
    expect(adimSahibi({ ...temel, durum: 'SAHIT_BEKLIYOR' })).toEqual({
      tur: 'SAHIT',
      personnelIdler: ['p-s2'],
    })
  })

  it('YONETICI_BEKLIYOR → seçilen yönetici, IK_BEKLIYOR → İV', () => {
    expect(adimSahibi({ ...temel, durum: 'YONETICI_BEKLIYOR' })).toEqual({
      tur: 'YONETICI',
      personnelId: 'p-yonetici',
    })
    expect(adimSahibi({ ...temel, durum: 'IK_BEKLIYOR' })).toEqual({ tur: 'IV' })
  })

  it('kapanmış tutanakta adım sahibi YOK', () => {
    expect(adimSahibi({ ...temel, durum: 'TAMAMLANDI' })).toEqual({ tur: 'YOK' })
    expect(adimSahibi({ ...temel, durum: 'REDDEDILDI' })).toEqual({ tur: 'YOK' })
  })
})

describe('tutanak numarası', () => {
  it('yılın ilk tutanağı 001', () => {
    expect(sonrakiTutanakNo(2026, null)).toBe('TUT-2026-001')
    expect(sonrakiTutanakNo(2026, undefined)).toBe('TUT-2026-001')
  })

  it('aynı yıl içinde artar, üç hane korunur', () => {
    expect(sonrakiTutanakNo(2026, 'TUT-2026-001')).toBe('TUT-2026-002')
    expect(sonrakiTutanakNo(2026, 'TUT-2026-099')).toBe('TUT-2026-100')
  })

  it('yıl dönünce sayaç sıfırlanır (önceki yılın numarası sayılmaz)', () => {
    expect(sonrakiTutanakNo(2027, 'TUT-2026-042')).toBe('TUT-2027-001')
  })
})

describe('yönetici zinciri (saf kısım)', () => {
  const zincir = [
    { personnelId: 'p1', adSoyad: 'Birinci Amir', sicilNo: 'ILR-1', bolum: 'Talaşlı İmalat', gorev: 'Takım Lideri' },
    { personnelId: 'p2', adSoyad: 'İkinci Amir', sicilNo: 'ILR-2', bolum: 'Talaşlı İmalat', gorev: 'Müdür' },
    { personnelId: 'p3', adSoyad: 'Üçüncü Amir', sicilNo: 'ILR-3', bolum: 'Fabrika', gorev: 'Fabrika Müdürü' },
  ]
  const basamaklar = basamaklariKur(zincir)

  it('kademeler 1..n, yalnız en üst sonYonetici', () => {
    expect(basamaklar.map((b) => [b.kademe, b.sonYonetici])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ])
  })

  it('radio YALNIZ 1. ve 2. kademeyi sunar', () => {
    expect(secilebilirBasamaklar(basamaklar).map((b) => b.personnelId)).toEqual(['p1', 'p2'])
  })

  it('seçilen 1./2. kademeyse son yönetici zincirin en üstüdür', () => {
    expect(sonYoneticiSec(basamaklar, 'p1')?.personnelId).toBe('p3')
    expect(kademeBul(basamaklar, 'p2')).toBe(2)
  })

  it('seçilen kişi zincirin EN ÜSTÜYSE ayrı bilgilendirme yok (null)', () => {
    expect(sonYoneticiSec(basamaklar, 'p3')).toBeNull()
    // Tek basamaklı zincirde de aynı: seçilen = en üst
    const tek = basamaklariKur([zincir[0]])
    expect(sonYoneticiSec(tek, 'p1')).toBeNull()
  })

  it('boş zincirde seçenek de son yönetici de yok', () => {
    expect(secilebilirBasamaklar([])).toEqual([])
    expect(sonYoneticiSec([], 'p1')).toBeNull()
    expect(kademeBul([], 'p1')).toBeNull()
  })
})
