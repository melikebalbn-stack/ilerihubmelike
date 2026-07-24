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
  tazelikDamgasiGuncellensinMi,
  parcaPlani,
  pduParcaBoyutu,
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

// ── Donma tuzağı + KANITA dayalı kaçış kapısı (23.07.2026) ──
//
// İki kusur birlikte çözülür:
//   (1) markRead() blok-geçersizlikten ÖNCE çağrıldığı için çöp okuma tezgahı TAZE
//       tutuyordu → /status donmuş sayaç sunuyordu (fail-safe filtresi atlanıyordu).
//   (2) Katman 2 sıfırları SONSUZA KADAR reddediyordu → gerçek sıfırlamada donma.
//
// KALICI DERS: SÜRE, GERÇEKLİK KANITI DEĞİLDİR. Sahada 104 DAKİKALIK blok-geçersiz
// pencerenin sonunda sayaçlar ESKİ BÜYÜK DEĞERLERİNE döndü — o sıfırlar saatlerce
// sürmesine rağmen SAHTEYDİ. Bu yüzden kaçış kapısı süreye değil, SIFIRDAN GELEN
// GERÇEK ARTIŞ kanıtına bağlıdır.

describe('kacisKapisiKarari — kanıta dayalı', () => {
  const ok = (prev: number | undefined, cur: number) => ({ prev, cur })

  it('blok-geçersiz tur: sıfırlar sürüyor, kanıt aranmaz → kapı açılmaz', () => {
    expect(
      kacisKapisiKarari({ blokGecersiz: true, blokGecersizDizisiVar: true, okumalar: [ok(1146, 0), ok(1425, 0)] }),
    ).toEqual({ kacisKapisi: false, kanitIndex: null })
  })

  it('süregelen dizi YOKKEN artış kanıt sayılmaz (normal tek-makine reset karışmasın)', () => {
    expect(
      kacisKapisiKarari({ blokGecersiz: false, blokGecersizDizisiVar: false, okumalar: [ok(1146, 1)] }),
    ).toEqual({ kacisKapisi: false, kanitIndex: null })
  })

  it('SIFIRDAN ARTIŞ (0 < cur < prev) → kapı AÇILIR, kanıt pini bildirilir', () => {
    expect(
      kacisKapisiKarari({ blokGecersiz: false, blokGecersizDizisiVar: true, okumalar: [ok(1146, 0), ok(1425, 2)] }),
    ).toEqual({ kacisKapisi: true, kanitIndex: 1 })
  })

  it('ESKİ DEĞERE geri dönüş (cur >= prev) kanıt DEĞİLDİR — kapı açılmaz', () => {
    expect(
      kacisKapisiKarari({
        blokGecersiz: false,
        blokGecersizDizisiVar: true,
        okumalar: [ok(1146, 1146), ok(1425, 1425)],
      }),
    ).toEqual({ kacisKapisi: false, kanitIndex: null })
  })

  it('hâlâ sıfır okuyan pinler tek başına kanıt üretmez', () => {
    expect(
      kacisKapisiKarari({ blokGecersiz: false, blokGecersizDizisiVar: true, okumalar: [ok(1146, 0), ok(undefined, 0)] }),
    ).toEqual({ kacisKapisi: false, kanitIndex: null })
  })
})

describe('tazelikDamgasiGuncellensinMi', () => {
  it('geçerli okuma → damga ilerler', () => {
    expect(tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz: false })).toBe(true)
  })

  it('BLOK-GEÇERSİZ tur damgayı İLERLETMEZ (asıl kusur buydu)', () => {
    expect(tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz: true })).toBe(false)
  })

  it('okuma hatası damgayı ilerletmez', () => {
    expect(tazelikDamgasiGuncellensinMi({ okumaBasarili: false, blokGecersiz: false })).toBe(false)
  })
})

/**
 * index.ts tur döngüsünün saf simülasyonu (aynı sıra, aynı kararlar).
 * Girdi: her tur için pin başına ham okuma (null = MBRead hatası).
 */
function plcAkis(
  turlar: Array<Array<number | null>>,
  { bayatlikMs = 20_000, intervalMs = 5_000 } = {},
) {
  const pinSayisi = turlar[0].length
  const pins = Array.from({ length: pinSayisi }, () => ({
    prev: undefined as number | undefined,
    kacisEsigi: undefined as number | undefined,
  }))
  let ardArdaBlokGecersiz = 0
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
    const okumalar = curlar.map((cur, k) => ({ prev: pins[k].prev, cur }))
    const blokGecersiz = blokGecersizMi(okumalar)
    const kk = kacisKapisiKarari({ blokGecersiz, blokGecersizDizisiVar: ardArdaBlokGecersiz > 0, okumalar })
    ardArdaBlokGecersiz = blokGecersiz ? ardArdaBlokGecersiz + 1 : 0
    if (kk.kacisKapisi) {
      okumalar.forEach((o, k) => {
        if (o.cur === 0 && o.prev !== undefined && o.prev > 0) pins[k].kacisEsigi = o.prev
      })
      baselineTazeleGerek = false
    }
    const baselineTazele = baselineTazeleGerek && !blokGecersiz
    let suphelSifir = false

    okumalar.forEach((o, k) => {
      const p = pins[k]
      const r = sayacIsle({
        prev: o.prev, cur: o.cur, baselineTazele, blokGecersiz,
        kacisKapisi: kk.kacisKapisi, kacisEsigi: p.kacisEsigi,
      })
      if (baselineTazele && r.olay === 'sifir-suphesi') suphelSifir = true
      if (r.olay === 'kacis-geri-donus') p.kacisEsigi = undefined
      p.prev = r.yeniPrev
      turDelta += r.delta
      olaylar.push(r.olay)
    })
    if (baselineTazele && !suphelSifir) baselineTazeleGerek = false

    if (tazelikDamgasiGuncellensinMi({ okumaBasarili: true, blokGecersiz })) {
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
    const { kayit } = plcAkis([[100, 200], [101, 201], ...tekrar(8, [0, 0])])
    expect(kayit[1].bayat).toBe(false) // geçerli okuma → taze
    // Damga tur 1'de (t=10sn) donar. Bayatlık 20 sn → t=30sn'de yaş 20 (hâlâ taze),
    // t=35sn'den itibaren BAYAT → /status'ten düşer → is-basla 503.
    expect(kayit[5].bayat).toBe(false)
    expect(kayit[6].bayat).toBe(true)
  })

  it('kısa blok-geçersizlik (3 tur) sonrası normal okuma → kaçış DEVREYE GİRMEZ', () => {
    const { kayit, birikim } = plcAkis([[100, 200], ...tekrar(3, [0, 0]), [102, 202]])
    expect(kayit.some((k) => k.olaylar.includes('kacis-kapisi'))).toBe(false)
    expect(birikim).toBe(4) // 100→102, 200→202; sıfırlar yutuldu
    expect(kayit[4].bayat).toBe(false) // geçerli okuma damgayı tazeledi
  })

  it('104 DK SABİT SIFIR sonra eski değere dönüş: tezgah /status DIŞINDA, hayalet YOK', () => {
    // Sahada görülen pencere (1248 tur ≈ 104 dk) — kısaltılmış ama davranışı aynı.
    const TUR = 1248
    const { kayit, birikim } = plcAkis([[1146, 1425], ...tekrar(TUR, [0, 0]), [1146, 1425], [1147, 1426]])
    // Kapı hiç açılmadı: sıfırdan artış kanıtı hiç gelmedi.
    expect(kayit.some((k) => k.olaylar.includes('kacis-kapisi'))).toBe(false)
    // Pencere boyunca tezgah BAYAT — 0 baseline is-basla'ya sızmadı.
    expect(kayit.slice(6, TUR + 1).every((k) => k.bayat)).toBe(true)
    // Hayalet üretim yok: yalnız gerçek artış (1146→1147, 1425→1426).
    expect(birikim).toBe(2)
    expect(kayit.at(-1)!.bayat).toBe(false) // gerçek değerler döndü → yeniden taze
  })

  it('GERÇEK PLC RESTART: sıfırlar + 0→1→2 artış → kapı açılır, baseline 0, delta doğru', () => {
    const { kayit, birikim, pins } = plcAkis([
      [1146, 1425], ...tekrar(30, [0, 0]), [1, 0], [2, 1], [3, 2],
    ])
    const kacisTur = kayit.findIndex((k) => k.olaylar.includes('kacis-kapisi'))
    expect(kacisTur).toBe(31) // kanıtın geldiği tur
    // Kanıt pini 'reset-kabul' ile gerçek deltasını üretir; kardeşi 0'a çekilir.
    expect(kayit[31].olaylar).toEqual(['reset-kabul', 'kacis-kapisi'])
    expect(pins.map((p) => p.prev)).toEqual([3, 2]) // donma açıldı, sayaç normal akışta
    expect(birikim).toBe(5) // pin A: 1+1+1 = 3, pin B: 0→1→2 = 2
    expect(kayit.at(-1)!.bayat).toBe(false)
  })

  it('kaçıştan sonra ESKİ DEĞERE sıçrama üretim SAYILMAZ (katman 3 korundu)', () => {
    // Kanıt geldi (kapı açıldı) ama kardeş pin sonradan eski değerine sıçradı.
    const { kayit, birikim } = plcAkis([
      [1146, 1425], ...tekrar(10, [0, 0]), [1, 0], [2, 1425],
    ])
    expect(kayit.at(-1)!.olaylar[1]).toBe('kacis-geri-donus')
    // pin A: 0→1 (reset-kabul, +1) ve 1→2 (normal, +1) = 2. pin B hiç üretmedi.
    expect(birikim).toBe(2) // 1425'lik hayalet YOK
  })

  it('REGRESYON: 22.07 hayalet senaryosu (kısa pencere) HÂLÂ kapalı', () => {
    const { birikim, kayit } = plcAkis([[1146, 1425], ...tekrar(3, [0, 0]), [1146, 1425], [1147, 1426]])
    expect(birikim).toBe(2) // 2571 hayalet YOK
    expect(kayit.some((k) => k.olaylar.includes('kacis-kapisi'))).toBe(false)
  })

  it('REGRESYON: gerçek tek-makine reset (CN14 prev=1 → 0 → 1,2) bozulmadı', () => {
    const { birikim } = plcAkis([[1, 500], [0, 501], [1, 502], [2, 503]])
    expect(birikim).toBe(4) // CN14: 1, komşu: 3
  })
})

// ── Blok okuma parçalama (PDU çok-parça birleştirme yolunu kaldırır, 24.07.2026) ──
describe('pduParcaBoyutu — müzakere edilen PDU\'dan DWORD-hizalı boyut', () => {
  it('PDU 240 → payload 222 → 220 (DWORD hizalı)', () => {
    expect(pduParcaBoyutu(240)).toBe(220)
  })
  it('PDU 480 (S7-1500) → 462 → 460', () => {
    expect(pduParcaBoyutu(480)).toBe(460)
  })
  it('geçersiz/küçük PDU → güvenli varsayılan (DWORD hizalı)', () => {
    expect(pduParcaBoyutu(0)).toBe(200)
    expect(pduParcaBoyutu(10)).toBe(200)
    expect(pduParcaBoyutu(NaN)).toBe(200)
  })
  it('sonuç DAİMA 4\'ün katı', () => {
    for (const pdu of [128, 240, 300, 480, 960]) expect(pduParcaBoyutu(pdu) % 4).toBe(0)
  })
})

describe('parcaPlani — blok parçalama', () => {
  const kapla = (p: { off: number; len: number }[]) => p.reduce((s, x) => s + x.len, 0)

  it('küçük blok (size ≤ chunk) TEK parça kalır — PANO-3 regresyonu', () => {
    const p = parcaPlani(0, 56, 220)
    expect(p).toEqual([{ off: 0, len: 56 }])
  })

  it('PANO-1 400B / 220 chunk → iki parça, toplam kapsam 400', () => {
    const p = parcaPlani(0, 400, 220)
    expect(p).toEqual([{ off: 0, len: 220 }, { off: 220, len: 180 }])
    expect(kapla(p)).toBe(400)
  })

  it('parça sınırları ve start DWORD-hizalı (her off %4==0)', () => {
    for (const p of parcaPlani(0, 400, 220)) expect(p.off % 4).toBe(0)
  })

  it('start 0 değilse ofsetler mutlak (duruş bloğu 1000\'den)', () => {
    const p = parcaPlani(1000, 400, 220)
    expect(p).toEqual([{ off: 1000, len: 220 }, { off: 1220, len: 180 }])
  })

  it('tam katı blok artık parça bırakmaz (440/220 → iki tam parça)', () => {
    expect(parcaPlani(0, 440, 220)).toEqual([{ off: 0, len: 220 }, { off: 220, len: 220 }])
  })

  it('chunk DWORD hizalanır (222 verilse de 220 kullanılır)', () => {
    expect(parcaPlani(0, 400, 222)).toEqual([{ off: 0, len: 220 }, { off: 220, len: 180 }])
  })

  it('çok parça: 960B / 220 → 5 parça, kapsam tam', () => {
    const p = parcaPlani(0, 960, 220)
    expect(p.length).toBe(5) // 220*4 + 80
    expect(kapla(p)).toBe(960)
    expect(p.at(-1)).toEqual({ off: 880, len: 80 })
  })

  it('birleştirme byte-exact: parça ofsetleri ardışık, boşluk/çakışma yok', () => {
    const p = parcaPlani(0, 400, 220)
    let beklenen = 0
    for (const { off, len } of p) { expect(off).toBe(beklenen); beklenen += len }
    expect(beklenen).toBe(400)
  })
})
