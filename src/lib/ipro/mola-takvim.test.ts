import { describe, it, expect } from 'vitest'
import { pencerelerCoz, pencereBirlesimMs, gunBiti, type MolaTanimCoz } from './mola-takvim'
import type { IproTatilTip } from './takvim-util'

const bosTatil = () => new Map<string, IproTatilTip>()

// Gündüz vardiyası 07:00–17:00 yerel (UTC+3). Öğle molası 12:00 45dk, tüm günler (maske 127).
const GUNDUZ_OGLE = (over: Partial<MolaTanimCoz> = {}): MolaTanimCoz => ({
  bolum: null,
  sebepId: 'yemek',
  baslangic: '12:00',
  sureDk: 45,
  gunMaskesi: 127,
  gecerliBaslangic: null,
  gecerliBitis: null,
  aktif: true,
  vardiyaBaslangic: '07:00',
  vardiyaBitis: '17:00',
  vardiyaErtesiGuneTasar: false,
  ...over,
})
// Gece vardiyası 21:00–07:00 (ertesiGuneTasar). Gece yarısı sonrası mola 02:00 30dk.
const GECE_MOLA = (over: Partial<MolaTanimCoz> = {}): MolaTanimCoz => ({
  bolum: null,
  sebepId: 'gece-cay',
  baslangic: '02:00',
  sureDk: 30,
  gunMaskesi: 127,
  gecerliBaslangic: null,
  gecerliBitis: null,
  aktif: true,
  vardiyaBaslangic: '21:00',
  vardiyaBitis: '07:00',
  vardiyaErtesiGuneTasar: true,
  ...over,
})

// Gündüz iş penceresi: 2026-08-10 (Pazartesi) 04:00Z–14:00Z (= 07:00–17:00 yerel).
const GUN_BAS = new Date('2026-08-10T04:00:00Z')
const GUN_BIT = new Date('2026-08-10T14:00:00Z')

describe('gunBiti — Pzt=1 … Paz=64', () => {
  it('getUTCDay eşlemesi', () => {
    expect(gunBiti(1)).toBe(1) // Pzt
    expect(gunBiti(5)).toBe(16) // Cum
    expect(gunBiti(6)).toBe(32) // Cmt
    expect(gunBiti(0)).toBe(64) // Paz
  })
})

describe('pencerelerCoz — mola pencere çözümü', () => {
  it('tam gündüz vardiyası: öğle molası 12:00 yerel = 09:00Z, 45 dk', () => {
    const p = pencerelerCoz([GUNDUZ_OGLE()], null, GUN_BAS, GUN_BIT, bosTatil())
    expect(p).toHaveLength(1)
    expect(p[0].basla.toISOString()).toBe('2026-08-10T09:00:00.000Z')
    expect(p[0].bitis.toISOString()).toBe('2026-08-10T09:45:00.000Z')
    expect(p[0].sebepId).toBe('yemek')
  })

  it('gece vardiyası gece yarısı geçişi: 02:00 molası shift gününe (Pzt başlangıç) eşlenir → Salı 02:00 yerel = Pzt 23:00Z', () => {
    // Gece vardiyası Pzt 21:00 (Pzt 18:00Z) → Salı 07:00 (Salı 04:00Z).
    const bas = new Date('2026-08-10T18:00:00Z')
    const bit = new Date('2026-08-11T04:00:00Z')
    const p = pencerelerCoz([GECE_MOLA()], null, bas, bit, bosTatil())
    expect(p).toHaveLength(1)
    expect(p[0].basla.toISOString()).toBe('2026-08-10T23:00:00.000Z')
    expect(p[0].bitis.toISOString()).toBe('2026-08-10T23:30:00.000Z')
  })

  it('Cuma+Yemek maskesi (yalnız Cuma=16): Cuma günü döner, Pazartesi dönmez', () => {
    const cumaTanim = GUNDUZ_OGLE({ gunMaskesi: 16 })
    // 2026-08-14 Cuma
    const cuma = pencerelerCoz([cumaTanim], null, new Date('2026-08-14T04:00:00Z'), new Date('2026-08-14T14:00:00Z'), bosTatil())
    expect(cuma).toHaveLength(1)
    // 2026-08-10 Pazartesi → maske tutmaz
    const pzt = pencerelerCoz([cumaTanim], null, GUN_BAS, GUN_BIT, bosTatil())
    expect(pzt).toHaveLength(0)
  })

  it('YARIM gün: yalnız çalışma aralığına (ilk yarı, <12:00) düşen pencere', () => {
    const yarim = new Map<string, IproTatilTip>([['2026-08-10', 'YARIM']])
    // 11:00 molası ilk yarıda → döner
    const erken = pencerelerCoz([GUNDUZ_OGLE({ baslangic: '11:00', sureDk: 15 })], null, GUN_BAS, GUN_BIT, yarim)
    expect(erken).toHaveLength(1)
    // 12:30 molası ikinci yarıda → elenir
    const gec = pencerelerCoz([GUNDUZ_OGLE({ baslangic: '12:30', sureDk: 15 })], null, GUN_BAS, GUN_BIT, yarim)
    expect(gec).toHaveLength(0)
  })

  it('TATIL günü: pencere yok', () => {
    const tatil = new Map<string, IproTatilTip>([['2026-08-10', 'TATIL']])
    expect(pencerelerCoz([GUNDUZ_OGLE()], null, GUN_BAS, GUN_BIT, tatil)).toHaveLength(0)
  })

  it('Pazar otomatik TATIL: pencere yok (2026-08-09 Pazar)', () => {
    const p = pencerelerCoz([GUNDUZ_OGLE()], null, new Date('2026-08-09T04:00:00Z'), new Date('2026-08-09T14:00:00Z'), bosTatil())
    expect(p).toHaveLength(0)
  })

  it('bölüm override: bölüm-özel tanım null-bölüm tanımını ezer (aynı slot)', () => {
    const nullTanim = GUNDUZ_OGLE({ bolum: null, sureDk: 30 })
    const enjTanim = GUNDUZ_OGLE({ bolum: 'ENJ', sureDk: 45 })
    // ENJ sorgusu → yalnız ENJ (45dk), null elenir
    const enj = pencerelerCoz([nullTanim, enjTanim], 'ENJ', GUN_BAS, GUN_BIT, bosTatil())
    expect(enj).toHaveLength(1)
    expect(enj[0].bitis.getTime() - enj[0].basla.getTime()).toBe(45 * 60000)
    // Başka bölüm (LZR) → null tanım uygulanır (30dk)
    const lzr = pencerelerCoz([nullTanim, enjTanim], 'LZR', GUN_BAS, GUN_BIT, bosTatil())
    expect(lzr).toHaveLength(1)
    expect(lzr[0].bitis.getTime() - lzr[0].basla.getTime()).toBe(30 * 60000)
  })

  it('aralık pencereyi tamamen dışarıda bırakırsa dönmez', () => {
    // Sorgu 04:00–08:00Z; öğle molası 09:00Z → kesişmez
    const p = pencerelerCoz([GUNDUZ_OGLE()], null, GUN_BAS, new Date('2026-08-10T08:00:00Z'), bosTatil())
    expect(p).toHaveLength(0)
  })

  it('aralık pencereyi kısmen kesiyorsa döner (kırpılmamış)', () => {
    // Sorgu 04:00–09:20Z; mola 09:00–09:45Z → 20 dk kesişir ama pencere KIRPILMAMIŞ döner
    const p = pencerelerCoz([GUNDUZ_OGLE()], null, GUN_BAS, new Date('2026-08-10T09:20:00Z'), bosTatil())
    expect(p).toHaveLength(1)
    expect(p[0].bitis.toISOString()).toBe('2026-08-10T09:45:00.000Z') // tam pencere
  })

  it('pasif tanım (aktif=false) elenir', () => {
    expect(pencerelerCoz([GUNDUZ_OGLE({ aktif: false })], null, GUN_BAS, GUN_BIT, bosTatil())).toHaveLength(0)
  })

  it('geçerlilik aralığı dışındaki pencere elenir', () => {
    const t = GUNDUZ_OGLE({ gecerliBaslangic: new Date('2026-09-01T00:00:00Z') })
    expect(pencerelerCoz([t], null, GUN_BAS, GUN_BIT, bosTatil())).toHaveLength(0)
  })
})

describe('pencereBirlesimMs — örtüşen pencerelerin birleşik uzunluğu', () => {
  const w = (s: string, e: string) => ({ basla: new Date(s), bitis: new Date(e) })
  it('örtüşen iki pencere birleşir (çift sayılmaz)', () => {
    const r = pencereBirlesimMs(
      [w('2026-08-10T10:00:00Z', '2026-08-10T10:30:00Z'), w('2026-08-10T10:15:00Z', '2026-08-10T10:45:00Z')],
      new Date('2026-08-10T00:00:00Z').getTime(),
      new Date('2026-08-10T23:59:00Z').getTime(),
    )
    expect(r).toBe(45 * 60000) // 10:00–10:45 = 45 dk
  })
  it('ayrık pencereler toplanır', () => {
    const r = pencereBirlesimMs(
      [w('2026-08-10T10:00:00Z', '2026-08-10T10:15:00Z'), w('2026-08-10T12:00:00Z', '2026-08-10T12:30:00Z')],
      new Date('2026-08-10T00:00:00Z').getTime(),
      new Date('2026-08-10T23:59:00Z').getTime(),
    )
    expect(r).toBe(45 * 60000)
  })
  it('sorgu aralığıyla kırpılır', () => {
    const r = pencereBirlesimMs(
      [w('2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z')],
      new Date('2026-08-10T10:30:00Z').getTime(),
      new Date('2026-08-10T12:00:00Z').getTime(),
    )
    expect(r).toBe(30 * 60000) // yalnız 10:30–11:00
  })
  it('boş → 0', () => {
    expect(pencereBirlesimMs([], 0, 1000)).toBe(0)
  })
})
