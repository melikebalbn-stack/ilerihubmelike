/**
 * IPRO PLC Poller — saf hesap fonksiyonu testleri.
 *
 * SAF: PLC'ye, DB'ye, ağa DOKUNMAZ → fixture/temizlik gerektirmez, __tmp__ yok.
 * Reset senaryosu BİRİNCİ SINIF vaka (sahada canlı kanıtlandı: CN14 prev=1 → cur=0).
 */
import { describe, it, expect } from 'vitest'
import { sayacDelta, durusGecis, aggregateTezgah, taze, type PinOzet } from './hesap'

describe('sayacDelta', () => {
  it('normal artış → delta = fark', () => {
    expect(sayacDelta(100, 103)).toEqual({ delta: 3, resetMi: false })
  })

  it('değişim yok → delta 0', () => {
    expect(sayacDelta(42, 42)).toEqual({ delta: 0, resetMi: false })
  })

  it('ilk tur (prev undefined) → delta 0, baseline kurulur', () => {
    // Birikmiş sayaç tek turda "üretim" gibi görünmemeli.
    expect(sayacDelta(undefined, 2053)).toEqual({ delta: 0, resetMi: false })
  })

  it('RESET: cur < prev → delta = cur (wrap DEĞİL)', () => {
    // Saha kanıtı: CN14 prev=1 → cur=0 → sonra 1,2 diye yeniden saydı.
    expect(sayacDelta(1, 0)).toEqual({ delta: 0, resetMi: true })
    expect(sayacDelta(500, 0)).toEqual({ delta: 0, resetMi: true })
  })

  it('RESET + aynı turda üretim: prev=500, cur=3 → delta 3 (üretim kaybolmaz)', () => {
    expect(sayacDelta(500, 3)).toEqual({ delta: 3, resetMi: true })
  })

  it('wrap branch YOK — büyük prev/küçük cur da RESET sayılır', () => {
    // Sayaçlar wrap eşiğine yaklaşmadan sıfırlanıyor (max görülen 3997).
    // Bu yüzden 2^32'ye yakın değerler bile reset olarak yorumlanır.
    const r = sayacDelta(4_294_967_000, 5)
    expect(r.resetMi).toBe(true)
    expect(r.delta).toBe(5)
  })

  it('negatif guard: bozuk cur → delta 0', () => {
    expect(sayacDelta(10, -5).delta).toBe(0)
  })

  it('gerçek akış: baseline → artış → reset → artış', () => {
    let prev: number | undefined = undefined
    const deltalar: number[] = []
    for (const cur of [1000, 1001, 1003, 0, 1, 2]) {
      const r = sayacDelta(prev, cur)
      deltalar.push(r.delta)
      prev = cur
    }
    // ilk tur 0, +1, +2, reset(0), +1, +1 → toplam üretim 5
    expect(deltalar).toEqual([0, 1, 2, 0, 1, 1])
    expect(deltalar.reduce((a, b) => a + b, 0)).toBe(5)
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
