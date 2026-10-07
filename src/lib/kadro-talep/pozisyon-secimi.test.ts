import { describe, it, expect } from 'vitest'
import { pozisyonUnvanlari, altAgacIdleri, type OrgBirim } from './pozisyon-secenekleri'
import {
  POZISYON_ELLE,
  POZISYON_SECIM_BOS,
  bolumDegistiPozisyon,
  elleModdaMi,
  pozisyonElleYazildi,
  pozisyonKaynagi,
  pozisyonKaynagiEtiketi,
  pozisyonKayitAlanlari,
  pozisyonSecenekListesi,
  pozisyonSecimDegisti,
  pozisyonSecimGecerliMi,
} from './pozisyon-secimi'

// Talaşlı İmalat benzeri küçük bir ağaç: kök + iki alt birim + aynı unvanda iki kutu
// + bir kurul kutusu (listelenmemeli) + başka bölümün ağacı (karışmamalı).
const BIRIMLER: OrgBirim[] = [
  { id: 'u-ti', code: 'ORG-TF-P0051', name: 'Talaşlı İmalat Müdürlüğü', parentId: null },
  { id: 'u-k07', code: 'ORG-TF-P0051-K07', name: 'CNC Torna Operatörü', parentId: 'u-ti' },
  { id: 'u-k02', code: 'ORG-TF-P0051-K02', name: 'CNC Torna Operatörü', parentId: 'u-ti' },
  { id: 'u-k09', code: 'ORG-TF-P0051-K09', name: 'Takım Lideri', parentId: 'u-ti' },
  { id: 'u-alt', code: 'ORG-TF-P0052', name: 'Taşlama', parentId: 'u-ti' },
  { id: 'u-alt1', code: 'ORG-TF-P0052-K01', name: 'Taşlama Operatörü', parentId: 'u-alt' },
  { id: 'u-kr', code: 'ORG-KR-0003', name: 'İSG Kurulu Üyesi', parentId: 'u-ti' },
  { id: 'u-kal', code: 'ORG-TF-P0078', name: 'Kalite Müdürlüğü', parentId: null },
  { id: 'u-kal1', code: 'ORG-TF-P0078-K01', name: 'Kalite Kontrol Elemanı', parentId: 'u-kal' },
]

describe('pozisyonUnvanlari — bölümün org ağacından unvan listesi', () => {
  it('alt ağacı kapsar, unvanları tekilleştirir, kurul kutusunu atar', () => {
    const liste = pozisyonUnvanlari(BIRIMLER, 'u-ti')
    expect(liste.map((s) => s.ad)).toEqual([
      'CNC Torna Operatörü',
      'Takım Lideri',
      'Talaşlı İmalat Müdürlüğü',
      'Taşlama',
      'Taşlama Operatörü',
    ])
    // Kurul/komite kutusu listede yok
    expect(liste.some((s) => s.ad === 'İSG Kurulu Üyesi')).toBe(false)
    // Başka bölümün kutusu sızmıyor
    expect(liste.some((s) => s.ad === 'Kalite Kontrol Elemanı')).toBe(false)
  })

  it('aynı unvandaki birden çok kutuda EN KÜÇÜK kodu temsilci alır', () => {
    const cnc = pozisyonUnvanlari(BIRIMLER, 'u-ti').find((s) => s.ad === 'CNC Torna Operatörü')
    expect(cnc?.kod).toBe('ORG-TF-P0051-K02')
  })

  it('parentId döngüsünde sonsuza gitmez', () => {
    const dongu: OrgBirim[] = [
      { id: 'a', code: 'A', name: 'A', parentId: 'b' },
      { id: 'b', code: 'B', name: 'B', parentId: 'a' },
    ]
    expect([...altAgacIdleri(dongu, 'a')].sort()).toEqual(['a', 'b'])
  })

  it('şema bağı olmayan/boş ağaçta boş liste döner', () => {
    expect(pozisyonUnvanlari([], 'u-ti')).toEqual([])
    expect(pozisyonUnvanlari(BIRIMLER, 'olmayan-id')).toEqual([])
  })
})

describe('şemadan seçim', () => {
  const secenekler = pozisyonUnvanlari(BIRIMLER, 'u-ti')

  it('listeden seçim unvanı ve kodu birlikte taşır', () => {
    const s = pozisyonSecimDegisti('ORG-TF-P0051-K09', secenekler, POZISYON_SECIM_BOS)
    expect(s).toEqual({ kod: 'ORG-TF-P0051-K09', unvan: 'Takım Lideri' })
    expect(elleModdaMi(s)).toBe(false)
    expect(pozisyonSecimGecerliMi(s)).toBe(true)
  })

  it('kaydedilen veride pozisyon kodu saklanır, "şemada yok" işareti durmaz', () => {
    const s = pozisyonSecimDegisti('ORG-TF-P0051-K09', secenekler, POZISYON_SECIM_BOS)
    expect(pozisyonKayitAlanlari(s)).toEqual({
      title: 'Takım Lideri',
      pozisyonOrgKodu: 'ORG-TF-P0051-K09',
      pozisyonSemadaYok: false,
    })
  })

  it('listede olmayan kod seçilemez — seçim temizlenir', () => {
    expect(pozisyonSecimDegisti('ORG-YOK-1', secenekler, POZISYON_SECIM_BOS)).toEqual(POZISYON_SECIM_BOS)
  })

  it('seçenek listesinde "Yeni pozisyon ekle" daima en sonda', () => {
    const liste = pozisyonSecenekListesi(secenekler)
    expect(liste).toHaveLength(secenekler.length + 1)
    expect(liste[liste.length - 1].id).toBe(POZISYON_ELLE)
  })
})

describe('elle yazma (listede yok)', () => {
  it('"Yeni pozisyon ekle" seçimi elle moda geçirir, metin boş başlar', () => {
    const s = pozisyonSecimDegisti(POZISYON_ELLE, [], POZISYON_SECIM_BOS)
    expect(s).toEqual({ kod: POZISYON_ELLE, unvan: '' })
    expect(elleModdaMi(s)).toBe(true)
    // Metin yazılmadan geçerli sayılmaz (kaydet düğmesi kapalı)
    expect(pozisyonSecimGecerliMi(s)).toBe(false)
  })

  it('elle yazılan unvan "şemada yok" işaretiyle, kod OLMADAN kaydedilir', () => {
    const s = pozisyonElleYazildi('  Veri Mühendisi  ', { kod: POZISYON_ELLE, unvan: '' })
    expect(pozisyonSecimGecerliMi(s)).toBe(true)
    expect(pozisyonKayitAlanlari(s)).toEqual({
      title: 'Veri Mühendisi',
      pozisyonOrgKodu: null,
      pozisyonSemadaYok: true,
    })
  })

  it('elle modda değilken yazma yoksayılır (durum bozulmaz)', () => {
    const semadan = { kod: 'ORG-TF-P0051-K09', unvan: 'Takım Lideri' }
    expect(pozisyonElleYazildi('başka şey', semadan)).toEqual(semadan)
  })

  it('şemadan elle moda geçiş: önceki serbest metin korunur', () => {
    const elle = { kod: POZISYON_ELLE, unvan: 'Veri Mühendisi' }
    const semadan = pozisyonSecimDegisti('ORG-TF-P0051-K09', pozisyonUnvanlari(BIRIMLER, 'u-ti'), elle)
    const geri = pozisyonSecimDegisti(POZISYON_ELLE, [], semadan)
    // Şemadan seçime geçildiği için elle metin düşer; yeniden elleye dönüşte boş başlar
    expect(geri).toEqual({ kod: POZISYON_ELLE, unvan: '' })
    // Ama elle moddan elle moda (liste yenilenmesi) geçişte metin durur
    expect(pozisyonSecimDegisti(POZISYON_ELLE, [], elle)).toEqual(elle)
  })
})

describe('bölüm değişince', () => {
  const tiSecenekler = pozisyonUnvanlari(BIRIMLER, 'u-ti')
  const kaliteSecenekler = pozisyonUnvanlari(BIRIMLER, 'u-kal')

  it('yeni bölümde karşılığı olmayan seçim temizlenir', () => {
    const s = pozisyonSecimDegisti('ORG-TF-P0051-K09', tiSecenekler, POZISYON_SECIM_BOS)
    expect(bolumDegistiPozisyon(s, kaliteSecenekler)).toEqual(POZISYON_SECIM_BOS)
  })

  it('aynı bölüme dönülürse seçim korunur, unvan güncel kutudan alınır', () => {
    const s = { kod: 'ORG-TF-P0051-K09', unvan: 'Eski Unvan' }
    expect(bolumDegistiPozisyon(s, tiSecenekler)).toEqual({
      kod: 'ORG-TF-P0051-K09',
      unvan: 'Takım Lideri',
    })
  })

  it('elle yazılan unvan bölüme bağlı değil — korunur', () => {
    const elle = { kod: POZISYON_ELLE, unvan: 'Veri Mühendisi' }
    expect(bolumDegistiPozisyon(elle, kaliteSecenekler)).toEqual(elle)
  })

  it('seçim yoksa boş kalır', () => {
    expect(bolumDegistiPozisyon(POZISYON_SECIM_BOS, kaliteSecenekler)).toEqual(POZISYON_SECIM_BOS)
  })
})

describe('şema bağı olmayan bölüm', () => {
  it('liste boş gelse bile elle yazma yolu açık (seçenekte yalnız "Yeni pozisyon ekle")', () => {
    const liste = pozisyonSecenekListesi([])
    expect(liste).toHaveLength(1)
    expect(liste[0].id).toBe(POZISYON_ELLE)
    const s = pozisyonElleYazildi('Kalıp Teknikeri', pozisyonSecimDegisti(POZISYON_ELLE, [], POZISYON_SECIM_BOS))
    expect(pozisyonKayitAlanlari(s)).toEqual({
      title: 'Kalıp Teknikeri',
      pozisyonOrgKodu: null,
      pozisyonSemadaYok: true,
    })
  })
})

describe('İV karar ekranı işareti', () => {
  it('şemadan seçilen kayıtta kod gösterilir', () => {
    const k = pozisyonKaynagiEtiketi({ pozisyonOrgKodu: 'ORG-TF-P0051-K09', pozisyonSemadaYok: false })
    expect(pozisyonKaynagi({ pozisyonOrgKodu: 'ORG-TF-P0051-K09' })).toBe('SEMA')
    expect(k?.tur).toBe('SEMA')
    expect(k?.etiket).toContain('ORG-TF-P0051-K09')
  })

  it('elle yazılan kayıtta "Şemada yok" durur', () => {
    const k = pozisyonKaynagiEtiketi({ pozisyonOrgKodu: null, pozisyonSemadaYok: true })
    expect(pozisyonKaynagi({ pozisyonSemadaYok: true })).toBe('ELLE')
    expect(k?.etiket).toBe('Şemada yok')
  })

  it('07.10 öncesi kayıtta (iki alan boş) işaret çizilmez — backfill yok', () => {
    expect(pozisyonKaynagi({})).toBe('ESKI')
    expect(pozisyonKaynagiEtiketi({ pozisyonOrgKodu: null, pozisyonSemadaYok: false })).toBeNull()
  })
})
