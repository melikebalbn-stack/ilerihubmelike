import { describe, it, expect } from 'vitest'
import { isGunuSayisi, eskalasyonSeviyesi, eskalasyonKonusu } from './fif-eskalasyon'
import { VARSAYILAN_AYAR } from '@/lib/sla/calisma-takvimi'
import type { IproTatilTip } from '@/lib/ipro/takvim-util'

const bosTatil = new Map<string, IproTatilTip>()
const gun = (iso: string) => new Date(`${iso}T09:00:00.000Z`)

describe('fif-eskalasyon — isGunuSayisi (SLA takvimi)', () => {
  it('Pazartesi → Cuma = 4 iş günü (başlangıç günü hariç)', () => {
    expect(isGunuSayisi(gun('2026-09-21'), gun('2026-09-25'), bosTatil, VARSAYILAN_AYAR)).toBe(4)
  })
  it('hafta sonu sayılmaz (Cuma → Pazartesi = 1)', () => {
    expect(isGunuSayisi(gun('2026-09-25'), gun('2026-09-28'), bosTatil, VARSAYILAN_AYAR)).toBe(1)
  })
  it('iki tam hafta = 10 iş günü', () => {
    expect(isGunuSayisi(gun('2026-09-21'), gun('2026-10-05'), bosTatil, VARSAYILAN_AYAR)).toBe(10)
  })
  it('resmî tatil (TATIL) düşülür', () => {
    const tatil = new Map<string, IproTatilTip>([['2026-09-23', 'TATIL' as IproTatilTip]])
    expect(isGunuSayisi(gun('2026-09-21'), gun('2026-09-25'), tatil, VARSAYILAN_AYAR)).toBe(3)
  })
  it('bitiş başlangıçtan önceyse 0', () => {
    expect(isGunuSayisi(gun('2026-09-25'), gun('2026-09-21'), bosTatil, VARSAYILAN_AYAR)).toBe(0)
  })
})

describe('fif-eskalasyon — seviye', () => {
  it('5 iş günü altı → eskalasyon yok', () => {
    expect(eskalasyonSeviyesi(0)).toBeNull()
    expect(eskalasyonSeviyesi(4)).toBeNull()
  })
  it('5/10/15 eşikleri', () => {
    expect(eskalasyonSeviyesi(5)).toBe(1)
    expect(eskalasyonSeviyesi(9)).toBe(1)
    expect(eskalasyonSeviyesi(10)).toBe(2)
    expect(eskalasyonSeviyesi(14)).toBe(2)
    expect(eskalasyonSeviyesi(15)).toBe(3)
    expect(eskalasyonSeviyesi(99)).toBe(3)
  })
  it('konu seviye taşır (dedup anahtarı)', () => {
    expect(eskalasyonKonusu('FIF-2026-001', 2)).toContain('Eskalasyon 2')
    expect(eskalasyonKonusu('FIF-2026-001', 2)).not.toBe(eskalasyonKonusu('FIF-2026-001', 3))
  })
})
