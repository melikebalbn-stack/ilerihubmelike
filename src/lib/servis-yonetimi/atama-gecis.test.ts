import { describe, expect, it } from 'vitest'
import { TarihHatasi } from './tarih-kurallari'
import { gecisPlanla } from './atama-gecis'
import { GECIS_ESKI_BASLANGIC, GECIS_ORNEKLERI, GECIS_SIMDI_ISO } from './atama-gecis.ornekler'

// 2026-10-03 12:00 UTC = Türkiye günü 2026-10-03
const SIMDI = new Date('2026-10-03T12:00:00.000Z')
const ESKI = new Date('2026-09-27T00:00:00.000Z')
const gun = (d: Date) => d.toISOString().slice(0, 10)

describe('gecisPlanla — transfer ve Excel değişikliği için TEK kural', () => {
  it('bugün tarihli: eski atama HEMEN pasif (bitiş = geçiş günü), yeni bugün başlar ve bugünün kapasitesine girer', () => {
    const p = gecisPlanla(ESKI, '2026-10-03', 'Transfer tarihi', SIMDI)
    expect(p).toMatchObject({ gecisGunu: '2026-10-03', eskiAktif: false, yeniBugunKapsar: true })
    expect(gun(p.eskiBitis)).toBe('2026-10-03')
    expect(gun(p.yeniBaslangic)).toBe('2026-10-03')
  })

  it('geçmiş tarihli: eski pasif (bitiş = tarih), yeni o tarihte başlar, bugünün kapasitesine girer', () => {
    const p = gecisPlanla(ESKI, '2026-09-30', 'Transfer tarihi', SIMDI)
    expect(p).toMatchObject({ eskiAktif: false, yeniBugunKapsar: true })
    expect(gun(p.eskiBitis)).toBe('2026-09-30')
  })

  it('🔴 İLERİ tarihli: eski atama AKTİF kalır; bitiş = geçiş gününün ÖNCEKİ günü (DB kapalı-aralık EXCLUDE kısıtı yüzünden); yeni geçiş gününde başlar; bugünün kapasitesine GİRMEZ', () => {
    const p = gecisPlanla(ESKI, '2026-10-10', 'Transfer tarihi', SIMDI)
    expect(p.eskiAktif).toBe(true)
    expect(gun(p.eskiBitis)).toBe('2026-10-09')
    expect(gun(p.yeniBaslangic)).toBe('2026-10-10')
    expect(p.yeniBugunKapsar).toBe(false)
    // eski [başlangıç, bitiş] ile yeni [başlangıç, ∞) KAPALI aralıkta çakışmaz
    expect(p.eskiBitis.getTime()).toBeLessThan(p.yeniBaslangic.getTime())
  })

  it('ay/yıl sınırı: 1 Ocak geçişinde bitiş 31 Aralık', () => {
    const p = gecisPlanla(ESKI, '2027-01-01', 'Transfer tarihi', SIMDI)
    expect(gun(p.eskiBitis)).toBe('2026-12-31')
  })

  it('geçiş günü = eski atamanın başlangıcı: aralık oluşamaz → hemen pasif (bitiş = başlangıç), ileri tarihli olsa bile', () => {
    const gelecekBaslayan = new Date('2026-10-20T00:00:00.000Z')
    const p = gecisPlanla(gelecekBaslayan, '2026-10-20', 'Transfer tarihi', SIMDI)
    expect(p.eskiAktif).toBe(false)
    expect(gun(p.eskiBitis)).toBe('2026-10-20')
  })

  it('🔴 A3 kuralları: eski başlangıçtan önce, 2020 öncesi, bir yıldan ileri, geçersiz gün, boş → TarihHatasi (Türkçe)', () => {
    const hata = (g: string | null | undefined) => { try { gecisPlanla(ESKI, g, 'Transfer tarihi', SIMDI); return 'OK' } catch (e) { expect(e).toBeInstanceOf(TarihHatasi); return (e as Error).message } }
    expect(hata('2026-09-01')).toBe('Transfer tarihi, eski atamanın başlangıç tarihinden önce olamaz.')
    expect(hata('2019-12-31')).toContain('2020-01-01 tarihinden önce olamaz')
    expect(hata('2028-01-01')).toContain('en fazla 1 yıl sonrası')
    expect(hata('2026-02-30')).toContain('geçersiz')
    expect(hata('03.10.2026')).toContain('geçersiz')
    expect(hata('')).toContain('zorunludur')
    expect(hata(undefined)).toContain('zorunludur')
    expect(hata('2027-10-03')).toBe('OK') // tam 1 yıl: üst sınır dahil
  })
})

describe('ortak örnek tablosu (transfer ve Excel testleri de AYNI tabloyu kullanır)', () => {
  it.each(GECIS_ORNEKLERI)('$ad ($gun)', (o) => {
    const p = gecisPlanla(new Date(`${GECIS_ESKI_BASLANGIC}T00:00:00.000Z`), o.gun, 'Transfer tarihi', new Date(GECIS_SIMDI_ISO))
    expect({ eskiAktif: p.eskiAktif, eskiBitis: gun(p.eskiBitis), yeniBaslangic: gun(p.yeniBaslangic), yeniBugunKapsar: p.yeniBugunKapsar })
      .toEqual({ eskiAktif: o.eskiAktif, eskiBitis: o.eskiBitis, yeniBaslangic: o.gun, yeniBugunKapsar: o.yeniBugunKapsar })
  })
})
