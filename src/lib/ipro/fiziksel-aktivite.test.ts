/**
 * fiziksel-aktivite — fizikselDurum hareket penceresi mantığı (SAF-ish; module-level
 * hareket haritası + Date.now). statusCek (fetch) burada test edilmez (harita'dan aynen
 * taşındı). Her senaryo AYRI tezgahKod kullanır → module-map çapraz bulaşması yok.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fizikselDurum, HAREKET_PENCERESI_MS, type StatusHaritasi } from './fiziksel-aktivite'

const m = (kod: string, sayacToplam: number, durusta = false): StatusHaritasi =>
  new Map([[kod, { sayacToplam, durusta }]])

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('fizikselDurum', () => {
  it('statusByKod null (poller down) → null', () => {
    expect(fizikselDurum('A1', null)).toBeNull()
  })

  it('/status\'te YOK (bayat/sinyalsiz) → null', () => {
    expect(fizikselDurum('YOK1', m('BASKA', 5))).toBeNull()
  })

  it('(d) durusta biti FALSE → fiziksel durusta ÜRETMEZ (kiosk-only doğrulaması)', () => {
    // İlk görülüş null; hareketsiz sonraki turlar da null — asla 'durusta'.
    expect(fizikselDurum('D1', m('D1', 10, false))).toBeNull()
    expect(fizikselDurum('D1', m('D1', 10, false))).toBeNull()
  })

  it('durusta biti TRUE → durusta (ölü dal ama mantık dursun)', () => {
    expect(fizikselDurum('DB1', m('DB1', 10, true))).toBe('durusta')
  })

  it('(b) sayaç ARTIŞI hareket penceresi içinde → calisiyor', () => {
    expect(fizikselDurum('B1', m('B1', 10))).toBeNull() // ilk görülüş: referans yok
    expect(fizikselDurum('B1', m('B1', 12))).toBe('calisiyor') // sayaç arttı → hareket
  })

  it('sayaç SABİT (ilk referanstan sonra artış yok) → null (bosta)', () => {
    expect(fizikselDurum('S1', m('S1', 10))).toBeNull() // ilk
    expect(fizikselDurum('S1', m('S1', 10))).toBeNull() // artmadı → hareket yok
  })

  it('(e) hareket penceresi DIŞINDA (>180sn artış yok) → calisiyor DEĞİL (null)', () => {
    expect(fizikselDurum('E1', m('E1', 10))).toBeNull() // ilk referans
    expect(fizikselDurum('E1', m('E1', 12))).toBe('calisiyor') // hareket damgalandı
    vi.advanceTimersByTime(HAREKET_PENCERESI_MS + 1000) // 180sn+ geç, yeni artış yok
    expect(fizikselDurum('E1', m('E1', 12))).toBeNull() // pencere kapandı → bosta
  })

  it('pencere içinde tekrar hareket → damga yenilenir (calisiyor sürer)', () => {
    expect(fizikselDurum('F1', m('F1', 10))).toBeNull()
    expect(fizikselDurum('F1', m('F1', 11))).toBe('calisiyor')
    vi.advanceTimersByTime(HAREKET_PENCERESI_MS - 5000) // pencere dolmadan
    expect(fizikselDurum('F1', m('F1', 12))).toBe('calisiyor') // yeni artış → damga yenilendi
    vi.advanceTimersByTime(HAREKET_PENCERESI_MS - 5000) // yine dolmadan
    expect(fizikselDurum('F1', m('F1', 12))).toBe('calisiyor') // hâlâ pencere içinde
  })
})
