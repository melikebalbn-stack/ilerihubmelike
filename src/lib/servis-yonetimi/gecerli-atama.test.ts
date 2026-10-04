import { describe, expect, it } from 'vitest'
import {
  ATAMA_DURUM_ETIKETLERI, atamaDurumu, atamaGunuKapsar, bugunTRTarihi, gecerliAtamaFiltresi, gecerliAtamaMi, gunTarihi, tarihAraligiFiltresi,
} from './gecerli-atama'

const D = (g: string) => new Date(`${g}T00:00:00.000Z`)
const BUGUN = '2026-10-03'
const atama = (baslangic: string, bitis: string | null, aktif = true) => ({ aktif, baslangicTarihi: D(baslangic), bitisTarihi: bitis ? D(bitis) : null })

describe('geçerli atama — tek kaynak (Prisma where ve JS karşılığı AYNI kural)', () => {
  it('where yapısı: aktif:true + başlangıç ≤ gün + (bitiş boş ya da ≥ gün)', () => {
    const g = D(BUGUN)
    expect(gecerliAtamaFiltresi(g)).toEqual({
      aktif: true,
      baslangicTarihi: { lte: g },
      OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: g } }],
    })
    expect(tarihAraligiFiltresi(g)).not.toHaveProperty('aktif') // araç/şoför varsayılanları için aktif'siz hali
  })

  it.each([
    ['süresiz, başlamış', atama('2026-09-27', null), true],
    ['bitişi bugün (dahil)', atama('2026-09-27', BUGUN), true],
    ['bitişi dün (süresi doldu)', atama('2026-09-27', '2026-10-02'), false],
    ['başlangıcı yarın (başlamadı)', atama('2026-10-04', null), false],
    ['başlangıcı bugün', atama('2026-10-03', null), true],
    ['pasif atama, tarih kapsıyor', atama('2026-09-27', null, false), false],
    ['planlı geçişte eski atama (bitiş = geçiş − 1), geçişten önce', atama('2026-09-27', '2026-10-09'), true],
  ])('JS karşılığı: %s', (_ad, a, beklenen) => {
    expect(gecerliAtamaMi(a, BUGUN)).toBe(beklenen)
  })

  it('atamaGunuKapsar aktif bayrağına BAKMAZ (yalnız tarih aralığı)', () => {
    expect(atamaGunuKapsar(atama('2026-09-27', null, false), BUGUN)).toBe(true)
  })

  it('hesaplanan durum: Aktif / Başlamadı / Süresi doldu / Pasif (pasif her zaman Pasif)', () => {
    expect(atamaDurumu(atama('2026-09-27', null), BUGUN)).toBe('AKTIF')
    expect(atamaDurumu(atama('2026-09-27', BUGUN), BUGUN)).toBe('AKTIF')
    expect(atamaDurumu(atama('2026-10-04', null), BUGUN)).toBe('BASLAMADI')
    expect(atamaDurumu(atama('2026-09-27', '2026-10-02'), BUGUN)).toBe('SURESI_DOLDU')
    expect(atamaDurumu(atama('2026-09-27', '2026-10-02', false), BUGUN)).toBe('PASIF')
    expect(atamaDurumu(atama('2026-10-10', null, false), BUGUN)).toBe('PASIF')
    expect(ATAMA_DURUM_ETIKETLERI).toEqual({ AKTIF: 'Aktif', BASLAMADI: 'Başlamadı', SURESI_DOLDU: 'Süresi doldu', PASIF: 'Pasif' })
  })

  it('🔴 gün Türkiye gününe göre: UTC 21:30 (TR ertesi gün 00:30) → TR günü', () => {
    expect(bugunTRTarihi(new Date('2026-10-03T21:30:00.000Z')).toISOString()).toBe('2026-10-04T00:00:00.000Z')
    expect(bugunTRTarihi(new Date('2026-10-03T20:59:00.000Z')).toISOString()).toBe('2026-10-03T00:00:00.000Z')
    expect(gunTarihi('2026-10-03').toISOString()).toBe('2026-10-03T00:00:00.000Z')
  })

  it('planlı geçiş: geçiş gününden önce eski geçerli/yeni değil; geçiş günü ve sonrası eski değil/yeni geçerli (aktif=true kalsa da)', () => {
    const eski = atama('2026-09-27', '2026-10-09') // geçiş 10-10: bitiş = 10-09, aktif=true kalır
    const yeni = atama('2026-10-10', null)
    expect([gecerliAtamaMi(eski, '2026-10-09'), gecerliAtamaMi(yeni, '2026-10-09')]).toEqual([true, false])
    expect([gecerliAtamaMi(eski, '2026-10-10'), gecerliAtamaMi(yeni, '2026-10-10')]).toEqual([false, true])
    expect(atamaDurumu(eski, '2026-10-10')).toBe('SURESI_DOLDU')
  })
})
