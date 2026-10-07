import { describe, expect, it } from 'vitest'
import { anomaliBul, type GecisNokta } from './anomali'

const g = (id: string, hhmmss: string, yon: 'GIRIS' | 'CIKIS', kapiNo = 1, cihazId = 'c1'): GecisNokta => {
  const [h, m, s = '0'] = hhmmss.split(':')
  return { id, zaman: new Date(Date.UTC(2026, 9, 8, Number(h), Number(m), Number(s))), yon, kapiNo, cihazId }
}

describe('anomali tespiti', () => {
  it('normal giriş-çıkış → anomali yok', () => {
    expect(anomaliBul('p1', [g('1', '07:00', 'GIRIS'), g('2', '17:00', 'CIKIS')])).toHaveLength(0)
  })
  it('ardışık giriş (çıkış yok) → ARDISIK_GIRIS', () => {
    const r = anomaliBul('p1', [g('1', '07:00', 'GIRIS'), g('2', '09:00', 'GIRIS')])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ tur: 'ARDISIK_GIRIS', gecisId: '2', oncekiGecisId: '1' })
  })
  it('ardışık çıkış → ARDISIK_CIKIS', () => {
    const r = anomaliBul('p1', [g('1', '17:00', 'CIKIS'), g('2', '17:05', 'CIKIS')])
    expect(r.some((a) => a.tur === 'ARDISIK_CIKIS')).toBe(true)
  })
  it('kısa sürede farklı kapı → COK_HIZLI_FARKLI_NOKTA (kart paylaşımı)', () => {
    const r = anomaliBul('p1', [g('1', '07:00:00', 'GIRIS', 1, 'c1'), g('2', '07:00:30', 'CIKIS', 2, 'c2')])
    expect(r.some((a) => a.tur === 'COK_HIZLI_FARKLI_NOKTA')).toBe(true)
  })
  it('kısa sürede AYNI kapı → hız anomalisi yok (tekrar okutma olabilir)', () => {
    const r = anomaliBul('p1', [g('1', '07:00:00', 'GIRIS', 1, 'c1'), g('2', '07:00:30', 'CIKIS', 1, 'c1')])
    expect(r.some((a) => a.tur === 'COK_HIZLI_FARKLI_NOKTA')).toBe(false)
  })
  it('eşik üstü farklı kapı → hız anomalisi yok', () => {
    const r = anomaliBul('p1', [g('1', '07:00:00', 'GIRIS', 1, 'c1'), g('2', '07:05:00', 'CIKIS', 2, 'c2')])
    expect(r.some((a) => a.tur === 'COK_HIZLI_FARKLI_NOKTA')).toBe(false)
  })
  it('sırasız giriş zaman sıralanır', () => {
    const r = anomaliBul('p1', [g('2', '09:00', 'GIRIS'), g('1', '07:00', 'GIRIS')])
    expect(r[0]).toMatchObject({ tur: 'ARDISIK_GIRIS', oncekiGecisId: '1', gecisId: '2' })
  })
})
