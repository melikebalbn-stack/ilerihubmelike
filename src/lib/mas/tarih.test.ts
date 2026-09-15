import { describe, it, expect } from 'vitest'
import { masTarih, zoneOffsetMs } from './tarih'

// Sürücü davranışını taklit et: MAS yerel duvar saati "11:03:35" → Date epoch'u o değerin UTC yorumu.
const surucuDate = (y: number, ay: number, g: number, s: number, dk = 0, sn = 0) =>
  new Date(Date.UTC(y, ay - 1, g, s, dk, sn))

describe('masTarih — Europe/Istanbul (DST yok, sabit +3)', () => {
  it('kış (Ocak) → -3 saat', () => {
    // Duvar 2026-01-15 11:03:35 İstanbul → gerçek 08:03:35Z
    expect(masTarih(surucuDate(2026, 1, 15, 11, 3, 35), 'Europe/Istanbul')!.toISOString()).toBe(
      '2026-01-15T08:03:35.000Z',
    )
  })
  it('yaz (Temmuz) → yine -3 saat (Türkiye DST uygulamıyor)', () => {
    expect(masTarih(surucuDate(2026, 7, 15, 11, 3, 35), 'Europe/Istanbul')!.toISOString()).toBe(
      '2026-07-15T08:03:35.000Z',
    )
  })
  it('salise KORUNUR ve tam -3s (sub-saniye sapma yok)', () => {
    // 06:59:13.473 duvar → 03:59:13.473 (salise aynen, offset tam dakika)
    expect(masTarih(surucuDate(2026, 9, 15, 6, 59, 13), 'Europe/Istanbul')!.toISOString()).toBe(
      '2026-09-15T03:59:13.000Z',
    )
    const msli = new Date(Date.UTC(2026, 8, 15, 6, 59, 13, 473))
    expect(masTarih(msli, 'Europe/Istanbul')!.toISOString()).toBe('2026-09-15T03:59:13.473Z')
  })
  it('null/geçersiz → null', () => {
    expect(masTarih(null, 'Europe/Istanbul')).toBeNull()
    expect(masTarih(undefined, 'Europe/Istanbul')).toBeNull()
    expect(masTarih(new Date(NaN), 'Europe/Istanbul')).toBeNull()
  })
})

describe('masTarih — DST olan zone (Europe/Berlin) SABİT -offset DEĞİL, IANA ile çözülür', () => {
  it('kış (Ocak) CET = UTC+1 → -1 saat', () => {
    expect(masTarih(surucuDate(2026, 1, 15, 11, 0, 0), 'Europe/Berlin')!.toISOString()).toBe(
      '2026-01-15T10:00:00.000Z',
    )
  })
  it('yaz (Temmuz) CEST = UTC+2 → -2 saat', () => {
    expect(masTarih(surucuDate(2026, 7, 15, 11, 0, 0), 'Europe/Berlin')!.toISOString()).toBe(
      '2026-07-15T09:00:00.000Z',
    )
  })
})

describe('zoneOffsetMs', () => {
  it('İstanbul +3s = +10800000 ms (kış ve yaz)', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T00:00:00Z'), 'Europe/Istanbul')).toBe(3 * 3600_000)
    expect(zoneOffsetMs(new Date('2026-07-15T00:00:00Z'), 'Europe/Istanbul')).toBe(3 * 3600_000)
  })
  it('Berlin kış +1s / yaz +2s (DST)', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T00:00:00Z'), 'Europe/Berlin')).toBe(1 * 3600_000)
    expect(zoneOffsetMs(new Date('2026-07-15T00:00:00Z'), 'Europe/Berlin')).toBe(2 * 3600_000)
  })
})

describe('round-trip (duvar saati korunur)', () => {
  it('masTarih → o UTC anı İstanbul yerelinde yazılınca aynı duvar saati', () => {
    const duvar = surucuDate(2026, 3, 20, 14, 25, 0) // 14:25 İstanbul duvar
    const utc = masTarih(duvar, 'Europe/Istanbul')!
    const geri = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(utc)
    expect(geri).toBe('14:25:00')
  })
})
