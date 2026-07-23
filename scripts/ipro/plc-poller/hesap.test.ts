/**
 * IPRO PLC Poller — saf hesap fonksiyonu testleri.
 *
 * SAF: PLC'ye, DB'ye, ağa DOKUNMAZ → fixture/temizlik gerektirmez, __tmp__ yok.
 * Reset senaryosu BİRİNCİ SINIF vaka (sahada canlı kanıtlandı: CN14 prev=1 → cur=0).
 */
import { describe, it, expect } from 'vitest'
import {
  sayacIsle,
  blokGecersizMi,
  okumaHatasiKarari,
  durusGecis,
  aggregateTezgah,
  taze,
  kacisKapisiKarari,
  sifirGuvenKarari,
  tazelikDamgasiGuncellensinMi,
  type PinOzet,
} from './hesap'

describe('sayacIsle — hayalet üretim savunması', () => {
  // Yardımcı: bir pin'in tur dizisini işleyip toplam birikimi ve olayları döndürür.
  function akis(
    okumalar: Array<{ cur: number; baselineTazele?: boolean; blokGecersiz?: boolean }>,
  ) {
    let prev: number | undefined
    let birikim = 0
    const olaylar: string[] = []
    const deltalar: number[] = []
    for (const o of okumalar) {
      const r = sayacIsle({
        prev,
        cur: o.cur,
        baselineTazele: o.baselineTazele ?? false,
        blokGecersiz: o.blokGecersiz ?? false,
      })
      prev = r.yeniPrev
      birikim += r.delta
      deltalar.push(r.delta)
      olaylar.push(r.olay)
    }
    return { birikim, olaylar, deltalar, prev }
  }

  it('ilk okuma baseline kurar — birikmiş sayaç üretim SAYILMAZ', () => {
    const { birikim, olaylar } = akis([{ cur: 2053 }])
    expect(birikim).toBe(0)
    expect(olaylar).toEqual(['ilk'])
  })

  it('normal artış → delta = fark', () => {
    const { birikim, deltalar } = akis([{ cur: 100 }, { cur: 103 }, { cur: 105 }])
    expect(deltalar).toEqual([0, 3, 2])
    expect(birikim).toBe(5)
  })

  it('TEK TURLUK GLITCH (1146→0→1146) → birikim ARTMAZ', () => {
    // 22.07 saha olayının tam senaryosu: yarı-kopuk TCP'de 0 okundu, sonra toparladı.
    const { birikim, olaylar } = akis([{ cur: 1146 }, { cur: 0 }, { cur: 1146 }])
    expect(birikim).toBe(0) // HAYALET YOK
    expect(olaylar).toEqual(['ilk', 'sifir-suphesi', 'normal'])
  })

  it('ÇOK TURLUK GLITCH (1146→0→0→0→1146) → birikim ARTMAZ', () => {
    // Tek tur teyidi tek başına yetmezdi: 0>=0 sağlanıp gerçek reset sanılırdı.
    const { birikim, olaylar, prev } = akis([
      { cur: 1146 }, { cur: 0 }, { cur: 0 }, { cur: 0 }, { cur: 1146 },
    ])
    expect(birikim).toBe(0) // HAYALET YOK
    expect(olaylar).toEqual(['ilk', 'sifir-suphesi', 'sifir-suphesi', 'sifir-suphesi', 'normal'])
    expect(prev).toBe(1146) // prevSayac hiç bozulmadı
  })

  it('GERÇEK RESET (1146→3→5) → delta 3 sonra 2', () => {
    // Sıfır-olmayan düşük değer = gerçek reset (sayım yeniden başladı).
    const { deltalar, birikim } = akis([{ cur: 1146 }, { cur: 3 }, { cur: 5 }])
    expect(deltalar).toEqual([0, 3, 2])
    expect(birikim).toBe(5)
  })

  it('reset 0\'dan başlayıp sonra sayarsa üretim kaybolmaz (1146→0→3)', () => {
    const { deltalar, birikim } = akis([{ cur: 1146 }, { cur: 0 }, { cur: 3 }])
    expect(deltalar).toEqual([0, 0, 3]) // 0 turu şüpheli, 3 gelince gerçek reset
    expect(birikim).toBe(3)
  })

  it('BLOK GEÇERSİZ tur → delta yok, prevSayac KORUNUR', () => {
    const { birikim, olaylar, prev } = akis([
      { cur: 1146 }, { cur: 0, blokGecersiz: true }, { cur: 1146 },
    ])
    expect(birikim).toBe(0)
    expect(olaylar).toEqual(['ilk', 'blok-gecersiz', 'normal'])
    expect(prev).toBe(1146)
  })

  it('HATA → RECONNECT → 0 (geçersiz) → 0 (geçersiz) → 1146: birikim ARTMAZ, baseline 1146', () => {
    // 17:47 epizodunun tam deseni: sahte RESET reconnect SONRASINDA geliyor
    // (PLC toparlandıktan sonra da bir süre 0 dönüyor).
    const { birikim, olaylar, prev } = akis([
      { cur: 1146 },                                            // baseline
      { cur: 0, baselineTazele: true, blokGecersiz: true },      // reconnect + blok geçersiz
      { cur: 0, baselineTazele: true, blokGecersiz: true },      // hâlâ 0, hâlâ geçersiz
      { cur: 1146, baselineTazele: true },                       // toparlandı → baseline tazele
    ])
    expect(birikim).toBe(0) // HAYALET YOK
    expect(olaylar).toEqual(['ilk', 'blok-gecersiz', 'blok-gecersiz', 'baseline-tazelendi'])
    expect(prev).toBe(1146) // baseline gerçek değere tazelendi
  })

  it('KATMAN 2 ATEŞLENEMEZKEN baseline turunda bozuk 0 BENİMSENMEZ', () => {
    // Tek dolu sayaçlı PLC/vardiya başı: blokGecersizMi >=2 dolu sayaç ister,
    // ateşlenmez. Bozuk 0 baseline olarak benimsenirse sonraki gerçek okumada
    // delta = 1146 hayalet üretilirdi.
    const { birikim, olaylar, prev } = akis([
      { cur: 1146 },                          // baseline
      { cur: 0, baselineTazele: true },       // reconnect + bozuk 0, blok ATEŞLENMEDİ
      { cur: 1146, baselineTazele: true },    // bayrak devretti, gerçek değer geldi
    ])
    expect(birikim).toBe(0) // HAYALET YOK
    expect(olaylar).toEqual(['ilk', 'sifir-suphesi', 'baseline-tazelendi'])
    expect(prev).toBe(1146)
  })

  it('baseline turunda GERÇEK sıfır (prev de 0) sorunsuz benimsenir', () => {
    // Hiç üretmemiş makine: prev=0, cur=0 → şüphe yok, baseline tazelenir.
    const { olaylar, prev } = akis([{ cur: 0 }, { cur: 0, baselineTazele: true }])
    expect(olaylar).toEqual(['ilk', 'baseline-tazelendi'])
    expect(prev).toBe(0)
  })

  it('RECONNECT sonrası ilk okuma DELTA ÜRETMEZ, yalnız baseline tazeler', () => {
    // Kopma penceresinde makine üretmiş olabilir; o üretim bilinçli olarak sayılmaz
    // (hayalet üretmektense eksik saymak yeğdir).
    const { birikim, olaylar, prev } = akis([
      { cur: 1146 }, { cur: 1200, baselineTazele: true }, { cur: 1203 },
    ])
    expect(olaylar).toEqual(['ilk', 'baseline-tazelendi', 'normal'])
    expect(birikim).toBe(3) // 1146→1200 arası sayılmadı; 1200→1203 sayıldı
    expect(prev).toBe(1203)
  })
})

describe('blokGecersizMi — blok-geneli sıfır tespiti', () => {
  it('önceden dolu 3 sayaç aynı turda 0 → GEÇERSİZ', () => {
    // 22.07 PANO-3: 1146/1425/2053 aynı anda 0 döndü — üçü birden sıfırlanamaz.
    expect(
      blokGecersizMi([
        { prev: 1146, cur: 0 },
        { prev: 1425, cur: 0 },
        { prev: 2053, cur: 0 },
      ]),
    ).toBe(true)
  })

  it('TEK makine sıfırlandı, komşular normal → geçersiz DEĞİL (gerçek reset adayı)', () => {
    // Saha kanıtı: CN14 tek başına sıfırlandı, komşuları etkilenmedi.
    expect(
      blokGecersizMi([
        { prev: 1146, cur: 1146 },
        { prev: 1425, cur: 0 },
        { prev: 2053, cur: 2055 },
      ]),
    ).toBe(false)
  })

  it('önceden sıfır olanlar hesaba katılmaz', () => {
    expect(
      blokGecersizMi([
        { prev: 0, cur: 0 },
        { prev: 0, cur: 0 },
        { prev: 500, cur: 502 },
      ]),
    ).toBe(false)
  })

  it('tek dolu sayaç varsa blok kararı VERİLMEZ (katman 3\'e bırakılır)', () => {
    expect(blokGecersizMi([{ prev: 1146, cur: 0 }, { prev: 0, cur: 0 }])).toBe(false)
  })

  it('ilk tur (prev undefined) → geçersiz değil', () => {
    expect(blokGecersizMi([{ prev: undefined, cur: 0 }, { prev: undefined, cur: 0 }])).toBe(false)
  })

  it('boş liste → geçersiz değil', () => {
    expect(blokGecersizMi([])).toBe(false)
  })
})

describe('okumaHatasiKarari — yeniden bağlanma disiplini', () => {
  const ESIK = 2

  it('TEK hata → zorla kopma YOK (oturum muhtemelen canlı, churn yaratma)', () => {
    // Saha gözlemi: poller hiç reconnect etmeden okumalar geri geldi → oturum ölmemişti.
    expect(okumaHatasiKarari(0, ESIK)).toEqual({ ardArdaHata: 1, zorlaKop: false })
  })

  it('ARD ARDA 2 hata → ZORLA KOPMA', () => {
    const ilk = okumaHatasiKarari(0, ESIK)
    expect(ilk.zorlaKop).toBe(false)
    const ikinci = okumaHatasiKarari(ilk.ardArdaHata, ESIK)
    expect(ikinci).toEqual({ ardArdaHata: 2, zorlaKop: true })
  })

  it('araya BAŞARILI okuma girerse zincir kırılır — tek tek hatalar kopma yaratmaz', () => {
    // hata → başarı (sayaç 0'a döner) → hata → hâlâ kopma yok
    let sayac = 0
    sayac = okumaHatasiKarari(sayac, ESIK).ardArdaHata // 1
    sayac = 0 // markRead() başarılı okumada sıfırlar
    const sonraki = okumaHatasiKarari(sayac, ESIK)
    expect(sonraki).toEqual({ ardArdaHata: 1, zorlaKop: false })
  })

  it('eşik aşılırsa da kopma kararı sürer (3. hata)', () => {
    expect(okumaHatasiKarari(2, ESIK).zorlaKop).toBe(true)
  })

  it('eşik 1 verilirse ilk hatada kopar (yapılandırılabilir)', () => {
    expect(okumaHatasiKarari(0, 1)).toEqual({ ardArdaHata: 1, zorlaKop: true })
  })
})

describe('durusGecis', () => {
  it('0 → 1 = başladı', () => {
    expect(durusGecis(false, true)).toBe('basladi')
  })

  it('1 → 0 = bitti', () => {
    expect(durusGecis(true, false)).toBe('bitti')
  })

  it('değişmez (0→0, 1→1) → geçiş yok', () => {
    expect(durusGecis(false, false)).toBeNull()
    expect(durusGecis(true, true)).toBeNull()
  })

  it('ilk tur (prev undefined) → geçiş üretilmez (baseline)', () => {
    expect(durusGecis(undefined, true)).toBeNull()
    expect(durusGecis(undefined, false)).toBeNull()
  })
})

describe('taze (fail-safe tazelik)', () => {
  const T0 = Date.parse('2026-07-22T10:00:00.000Z')
  const ISO = (msOnce: number) => new Date(T0 - msOnce).toISOString()
  const ESIK = 20_000

  it('sonOkuma null (SOĞUK AÇILIŞ) → taze DEĞİL', () => {
    // Kritik: poller yeni kalktı, hiç okuma yok → tezgah /status'e GİRMEMELİ.
    expect(taze(null, T0, ESIK)).toBe(false)
  })

  it('az önce okundu → taze', () => {
    expect(taze(ISO(1_000), T0, ESIK)).toBe(true)
  })

  it('eşiğin ALTINDA (19.999 sn) → taze', () => {
    expect(taze(ISO(19_999), T0, ESIK)).toBe(true)
  })

  it('eşiğe TAM EŞİT (20.000 sn) → hâlâ taze (yaş eşiği AŞMALI)', () => {
    expect(taze(ISO(20_000), T0, ESIK)).toBe(true)
  })

  it('eşiğin ÜSTÜNDE (20.001 sn) → BAYAT', () => {
    expect(taze(ISO(20_001), T0, ESIK)).toBe(false)
  })

  it('PLC koptu, backoff 60 sn → BAYAT (bayat baseline sunulmaz)', () => {
    expect(taze(ISO(60_000), T0, ESIK)).toBe(false)
  })

  it('bozuk zaman damgası → güvenli tarafta, taze DEĞİL', () => {
    expect(taze('bozuk-damga', T0, ESIK)).toBe(false)
  })

  it('gelecekten damga (saat kayması) → taze sayılır', () => {
    expect(taze(ISO(-5_000), T0, ESIK)).toBe(true)
  })
})

describe('/status filtresi — fail-safe davranış', () => {
  // /status derlenirken aggregate sonucu taze() ile filtrelenir; burada o filtreyi
  // aynı mantıkla kurup uçtan uca davranışı doğruluyoruz (HTTP/PLC gerekmez).
  const T0 = Date.parse('2026-07-22T10:00:00.000Z')
  const ESIK = 20_000
  type TezgahSatir = { tezgahKod: string; sayacToplam: number; sonOkuma: string | null }
  const filtrele = (liste: TezgahSatir[]) => liste.filter((t) => taze(t.sonOkuma, T0, ESIK))

  it('SOĞUK AÇILIŞ: hiç okuma yokken /status BOŞ dizi döner', () => {
    const liste: TezgahSatir[] = [
      { tezgahKod: 'KH31', sayacToplam: 0, sonOkuma: null },
      { tezgahKod: 'KH32', sayacToplam: 0, sonOkuma: null },
    ]
    expect(filtrele(liste)).toEqual([])
    // ⇒ is-basla kaydı bulamaz → 503 → yanlış (sıfır) baseline ile iş AÇILMAZ.
  })

  it('KOPMA: bayat tezgah listeden düşer, taze olan kalır', () => {
    const liste: TezgahSatir[] = [
      { tezgahKod: 'KH31', sayacToplam: 2053, sonOkuma: new Date(T0 - 3_000).toISOString() },
      { tezgahKod: 'KH32', sayacToplam: 999, sonOkuma: new Date(T0 - 45_000).toISOString() },
    ]
    const sonuc = filtrele(liste)
    expect(sonuc.map((t) => t.tezgahKod)).toEqual(['KH31'])
    expect(sonuc[0].sayacToplam).toBe(2053) // taze olanın şekli korunur (is-basla sözleşmesi)
  })

  it('hepsi taze → hepsi listede (gereksiz 503 üretilmez)', () => {
    const liste: TezgahSatir[] = [
      { tezgahKod: 'KH31', sayacToplam: 10, sonOkuma: new Date(T0 - 5_000).toISOString() },
      { tezgahKod: 'KH32', sayacToplam: 20, sonOkuma: new Date(T0 - 9_000).toISOString() },
    ]
    expect(filtrele(liste)).toHaveLength(2)
  })
})

describe('aggregateTezgah', () => {
  const pin = (o: Partial<PinOzet>): PinOzet => ({
    tezgahKod: 'KH04',
    curSayac: 0,
    lastDelta: 0,
    durusBit: false,
    ...o,
  })

  it('çok-pinli tezgah: sayacToplam + sonDelta toplanır', () => {
    const m = aggregateTezgah([
      pin({ curSayac: 100, lastDelta: 2 }),
      pin({ curSayac: 50, lastDelta: 3 }),
    ])
    expect(m.get('KH04')).toEqual({ sayacToplam: 150, sonDelta: 5, durusta: false })
  })

  it('herhangi bir pin duruş biti 1 → tezgah duruşta', () => {
    const m = aggregateTezgah([
      pin({ curSayac: 10, durusBit: false }),
      pin({ curSayac: 20, durusBit: true }),
    ])
    expect(m.get('KH04')!.durusta).toBe(true)
  })

  it('tezgaha bağlı olmayan pin (tezgahKod null) toplamaya GİRMEZ', () => {
    const m = aggregateTezgah([
      pin({ tezgahKod: null, curSayac: 999, lastDelta: 7 }),
      pin({ tezgahKod: 'KH04', curSayac: 5, lastDelta: 1 }),
    ])
    expect(m.size).toBe(1)
    expect(m.get('KH04')).toEqual({ sayacToplam: 5, sonDelta: 1, durusta: false })
  })

  it('birden çok tezgah ayrı ayrı toplanır', () => {
    const m = aggregateTezgah([
      pin({ tezgahKod: 'KH04', curSayac: 10, lastDelta: 1 }),
      pin({ tezgahKod: 'CN14', curSayac: 20, lastDelta: 2, durusBit: true }),
    ])
    expect(m.get('KH04')).toEqual({ sayacToplam: 10, sonDelta: 1, durusta: false })
    expect(m.get('CN14')).toEqual({ sayacToplam: 20, sonDelta: 2, durusta: true })
  })

  it('boş girdi → boş sonuç', () => {
    expect(aggregateTezgah([]).size).toBe(0)
  })
})

// ── Donma tuzağı / kaçış kapısı (23.07.2026 bulgusu) ──
//
// Sahada 104 dk KESİNTİSİZ blok-geçersiz pencere görüldü (1248 tur). İki ayrı kusur:
//   (1) markRead() blok-geçersizlikten ÖNCE çağrıldığı için çöp okuma tezgahı TAZE
//       tutuyordu → /status donmuş sayaç sunuyordu (fail-safe filtresi atlanıyordu).
//   (2) Katman 2 sıfırları SONSUZA KADAR reddediyordu → gerçek sıfırlamada donma.
//
// Aşağıdaki simülasyon index.ts'in tur döngüsünü birebir yansıtır: saf fonksiyonların
// BİRLİKTE doğru davrandığı burada kanıtlanır.

describe('kacisKapisiKarari', () => {
  it('geçerli okuma ard arda sayacı sıfırlar, kapı açılmaz', () => {
    expect(kacisKapisiKarari({ blokGecersiz: false, ardArda: 7, maxTur: 12 })).toEqual({
      ardArda: 0,
      kacisKapisi: false,
    })
  })

  it('eşiğin altında yalnız sayaç ilerler', () => {
    expect(kacisKapisiKarari({ blokGecersiz: true, ardArda: 0, maxTur: 12 })).toEqual({
      ardArda: 1,
      kacisKapisi: false,
    })
    expect(kacisKapisiKarari({ blokGecersiz: true, ardArda: 10, maxTur: 12 })).toEqual({
      ardArda: 11,
      kacisKapisi: false,
    })
  })

  it('eşiğe ulaşınca kapı açılır ve sayaç sıfırlanır (her turda tekrar ateşlenmez)', () => {
    expect(kacisKapisiKarari({ blokGecersiz: true, ardArda: 11, maxTur: 12 })).toEqual({
      ardArda: 0,
      kacisKapisi: true,
    })
  })
})

describe('sifirGuvenKarari', () => {
  it('bekleme kurulmamışsa (kalanTur=0) beklenmez', () => {
    expect(sifirGuvenKarari({ kalanTur: 0, hepsiSifir: true })).toEqual({ kalanTur: 0, bekleniyor: false })
  })

  it('sıfırlar sürdükçe beklenir, tur tur azalır', () => {
    expect(sifirGuvenKarari({ kalanTur: 60, hepsiSifir: true })).toEqual({ kalanTur: 59, bekleniyor: true })
  })

  it('sıfır olmayan gerçek değer gelince bekleme ANINDA biter', () => {
    expect(sifirGuvenKarari({ kalanTur: 59, hepsiSifir: false })).toEqual({ kalanTur: 0, bekleniyor: false })
  })

  it('kalan tur tükenince bekleme biter (sonsuza kadar 503 vermeyiz)', () => {
    expect(sifirGuvenKarari({ kalanTur: 1, hepsiSifir: true })).toEqual({ kalanTur: 0, bekleniyor: true })
    expect(sifirGuvenKarari({ kalanTur: 0, hepsiSifir: true })).toEqual({ kalanTur: 0, bekleniyor: false })
  })
})

describe('tazelikDamgasiGuncellensinMi', () => {
  it('geçerli okuma → damga ilerler', () => {
    expect(
      tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz: false, sifirGuvenBekleniyor: false }),
    ).toBe(true)
  })

  it('BLOK-GEÇERSİZ tur damgayı İLERLETMEZ (asıl kusur buydu)', () => {
    expect(
      tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz: true, sifirGuvenBekleniyor: false }),
    ).toBe(false)
  })

  it('okuma hatası damgayı ilerletmez', () => {
    expect(
      tazelikDamgasiGuncellensinMi({ okumaBasarili: false, blokGecersiz: false, sifirGuvenBekleniyor: false }),
    ).toBe(false)
  })

  it('kaçış sonrası doğrulanmamış sıfır damgayı ilerletmez', () => {
    expect(
      tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz: false, sifirGuvenBekleniyor: true }),
    ).toBe(false)
  })
})

/**
 * index.ts tur döngüsünün saf simülasyonu (aynı sıra, aynı kararlar).
 * Girdi: her tur için pin başına ham okuma (null = MBRead hatası).
 */
function plcAkis(
  turlar: Array<Array<number | null>>,
  { maxTur = 12, guvenTuru = 6, bayatlikMs = 20_000, intervalMs = 5_000 } = {},
) {
  const pinSayisi = turlar[0].length
  const pins = Array.from({ length: pinSayisi }, () => ({
    prev: undefined as number | undefined,
    kacisEsigi: undefined as number | undefined,
  }))
  let ardArda = 0
  let sifirGuvenKalan = 0
  let baselineTazeleGerek = false
  let sonGecerliOkuma: string | null = null
  const kayit: Array<{ tur: number; bayat: boolean; delta: number; olaylar: string[] }> = []
  let birikim = 0

  turlar.forEach((okuma, i) => {
    const simdi = (i + 1) * intervalMs
    const olaylar: string[] = []
    let turDelta = 0

    if (okuma.some((v) => v === null)) {
      // MBRead hatası → damga ilerlemez, katman 1 bayrağı kurulur.
      baselineTazeleGerek = true
      kayit.push({ tur: i, bayat: !taze(sonGecerliOkuma, simdi, bayatlikMs), delta: 0, olaylar: ['hata'] })
      return
    }
    const curlar = okuma as number[]
    const blokGecersiz = blokGecersizMi(curlar.map((cur, k) => ({ prev: pins[k].prev, cur })))
    const kk = kacisKapisiKarari({ blokGecersiz, ardArda, maxTur })
    ardArda = kk.ardArda
    if (kk.kacisKapisi) {
      sifirGuvenKalan = guvenTuru
      pins.forEach((p) => { if (p.prev !== undefined && p.prev > 0) p.kacisEsigi = p.prev })
      baselineTazeleGerek = false
    }
    const baselineTazele = baselineTazeleGerek && !blokGecersiz
    let suphelSifir = false

    curlar.forEach((cur, k) => {
      const p = pins[k]
      const r = sayacIsle({
        prev: p.prev, cur, baselineTazele, blokGecersiz,
        kacisKapisi: kk.kacisKapisi, kacisEsigi: p.kacisEsigi,
      })
      if (baselineTazele && r.olay === 'sifir-suphesi') suphelSifir = true
      if (r.olay === 'kacis-geri-donus') p.kacisEsigi = undefined
      p.prev = r.yeniPrev
      turDelta += r.delta
      olaylar.push(r.olay)
    })
    if (baselineTazele && !suphelSifir) baselineTazeleGerek = false

    const sg = sifirGuvenKarari({ kalanTur: sifirGuvenKalan, hepsiSifir: curlar.every((c) => c === 0) })
    sifirGuvenKalan = sg.kalanTur
    if (tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz, sifirGuvenBekleniyor: sg.bekleniyor })) {
      sonGecerliOkuma = new Date(simdi).toISOString()
    }
    birikim += turDelta
    kayit.push({ tur: i, bayat: !taze(sonGecerliOkuma, simdi, bayatlikMs), delta: turDelta, olaylar })
  })
  return { kayit, birikim, pins }
}

describe('donma tuzağı + kaçış kapısı (tur döngüsü simülasyonu)', () => {
  const tekrar = <T>(n: number, v: T): T[] => Array.from({ length: n }, () => v)

  it('blok-geçersiz tur tazelik damgasını GÜNCELLEMEZ → 20 sn sonra BAYAT', () => {
    // 2 normal tur, ardından blok-geçersiz sıfırlar.
    const { kayit } = plcAkis([[100, 200], [101, 201], ...tekrar(8, [0, 0])])
    expect(kayit[1].bayat).toBe(false) // geçerli okuma → taze
    // Damga tur 1'de (t=10sn) donar. Bayatlık 20 sn → t=30sn'de hâlâ taze (yaş 20),
    // t=35sn'den (tur 6) itibaren BAYAT.
    expect(kayit[5].bayat).toBe(false) // t=30sn, yaş=20sn → eşiğe eşit, hâlâ taze
    expect(kayit[6].bayat).toBe(true) // t=35sn, yaş=25sn → BAYAT → /status'ten düşer
  })

  it('kısa blok-geçersizlik (3 tur) sonrası normal okuma → kaçış kapısı DEVREYE GİRMEZ', () => {
    const { kayit, birikim } = plcAkis([[100, 200], ...tekrar(3, [0, 0]), [102, 202]])
    expect(kayit.some((k) => k.olaylar.includes('kacis-kapisi'))).toBe(false)
    expect(birikim).toBe(4) // 100→102 (+2) ve 200→202 (+2); sıfırlar yutuldu
    expect(kayit[4].bayat).toBe(false) // geçerli okuma damgayı tazeledi
  })

  it('12+ tur sürerse kaçış kapısı açılır: baseline 0, delta ÜRETİLMEZ', () => {
    const { kayit, birikim, pins } = plcAkis([[100, 200], ...tekrar(12, [0, 0])])
    const kacis = kayit.find((k) => k.olaylar.includes('kacis-kapisi'))
    expect(kacis).toBeTruthy()
    expect(kacis!.tur).toBe(12) // 12. ard arda blok-geçersiz tur
    expect(kacis!.delta).toBe(0)
    expect(birikim).toBe(0) // hiçbir hayalet üretim yok
    expect(pins.map((p) => p.prev)).toEqual([0, 0]) // baseline sıfıra kuruldu (donma açıldı)
  })

  it('kaçıştan sonra ilk GERÇEK artış doğru delta üretir (donma tuzağı kapandı)', () => {
    // Kaçış → sıfırlar sürer (güven turu dolar) → sayaç gerçekten 0'dan tırmanır.
    const { kayit, birikim } = plcAkis([
      [100, 200], ...tekrar(12, [0, 0]), ...tekrar(6, [0, 0]), [3, 4], [5, 7],
    ])
    expect(birikim).toBe(12) // 0→3→5 (+5) ve 0→4→7 (+7)
    expect(kayit.at(-1)!.bayat).toBe(false) // gerçek değer geldi → yeniden taze
  })

  it('kaçış sonrası ESKİ DEĞERE sıçrama üretim SAYILMAZ (hayalet kapalı)', () => {
    // 22.07 senaryosunun uzun hâli: sıfırlar bozuktu, bağlantı toparlayınca
    // sayaç eski büyük değerine geri döndü. prev=0 olduğu için hayalet riski burada.
    const { kayit, birikim } = plcAkis([[1146, 1425], ...tekrar(12, [0, 0]), [1146, 1425], [1148, 1427]])
    expect(kayit.at(-2)!.olaylar).toEqual(['kacis-geri-donus', 'kacis-geri-donus'])
    expect(birikim).toBe(4) // yalnız gerçek artış (1146→1148, 1425→1427)
    expect(birikim).toBeLessThan(100) // 2571'lik hayalet ÜRETİLMEDİ
  })

  it('kaçış sonrası sıfırlar doğrulanana kadar tezgah BAYAT (0 baseline sızmaz)', () => {
    const { kayit } = plcAkis([[100, 200], ...tekrar(12, [0, 0]), ...tekrar(3, [0, 0])])
    // Kaçış turundan sonraki turlarda sıfır güveni bekleniyor → damga ilerlemez.
    expect(kayit.slice(13).every((k) => k.bayat)).toBe(true)
  })

  it('sıfır güveni turu dolunca sıfır kabul edilir ve tezgah yeniden TAZE olur', () => {
    const { kayit } = plcAkis([[100, 200], ...tekrar(12, [0, 0]), ...tekrar(8, [0, 0])], { guvenTuru: 6 })
    expect(kayit.at(-1)!.bayat).toBe(false) // 6 tur bekleme doldu → sıfır artık gerçek
  })

  it('REGRESYON: 22.07 hayalet senaryosu (kısa pencere) HÂLÂ kapalı', () => {
    // Yarı-kopuk TCP: 3 tur bozuk sıfır, sonra eski değer geri geldi.
    const { birikim, kayit } = plcAkis([[1146, 1425], ...tekrar(3, [0, 0]), [1146, 1425], [1147, 1426]])
    expect(birikim).toBe(2) // 1146→1147, 1425→1426 — 2571 hayalet YOK
    expect(kayit.some((k) => k.olaylar.includes('kacis-kapisi'))).toBe(false)
  })

  it('REGRESYON: gerçek tek-makine reset (CN14 prev=1 → 0 → 1,2) bozulmadı', () => {
    // Tek pin sıfırlanır, komşusu üretmeye devam eder → blok-geçersiz DEĞİL.
    const { birikim } = plcAkis([[1, 500], [0, 501], [1, 502], [2, 503]])
    // 1→0 sıfır şüphesi (prev korunur), 0→1 'normal' değil: prev=1, cur=1 → delta 0,
    // sonra 1→2 delta 1. Komşu: 500→503 = 3.
    expect(birikim).toBe(4)
  })
})
