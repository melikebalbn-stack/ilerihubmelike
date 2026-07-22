/**
 * IPRO PLC Poller — saf hesap fonksiyonu testleri.
 *
 * SAF: PLC'ye, DB'ye, ağa DOKUNMAZ → fixture/temizlik gerektirmez, __tmp__ yok.
 * Reset senaryosu BİRİNCİ SINIF vaka (sahada canlı kanıtlandı: CN14 prev=1 → cur=0).
 */
import { describe, it, expect } from 'vitest'
import { sayacDelta, durusGecis, aggregateTezgah, type PinOzet } from './hesap'

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
