import { describe, expect, it } from 'vitest'
import { gunEkle, gunStr, sonuclariYaz, type PuantajYazici } from './puantaj-servis'
import type { PuantajSonucu } from './puantaj-motor'

const sonuc = (durum: PuantajSonucu['durum']): PuantajSonucu => ({
  durum, vardiyaId: 'v', vardiyaKaynak: 'VARSAYILAN', beklenenBaslangic: null, beklenenBitis: null, ilkGiris: null, sonCikis: null,
  ilkGirisGecisId: null, sonCikisGecisId: null, girisKaynak: null, cikisKaynak: null, kartOkutamamaId: null, gecDakika: 0,
  erkenCikisDakika: 0, fiiliDakika: null, dusulenMolaDakika: null, calismaDakika: null, onayliMesaiDakika: null, mesaiPersonelId: null,
  fazlaDakika: null, uyarilar: [],
})

describe('kilitli gün', () => {
  it('kilitli satır YENİDEN HESAPLANMAZ (yazılmaz); kilitsizler yazılır', async () => {
    const tablo = new Map<string, { durum: string; kilitli: boolean }>([
      ['p1', { durum: 'GELMEDI', kilitli: true }], // bordro sonrası kilitlendi
      ['p2', { durum: 'GELMEDI', kilitli: false }],
    ])
    const yazici: PuantajYazici = {
      async kilitliler(_g, ids) {
        return new Set(ids.filter((id) => tablo.get(id)?.kilitli))
      },
      async yaz(_g, satirlar) {
        for (const s of satirlar) tablo.set(s.personnelId, { durum: s.sonuc.durum, kilitli: false })
      },
    }
    const r = await sonuclariYaz(yazici, '2026-09-28', [
      { personnelId: 'p1', sonuc: sonuc('TAM_FORMLA') },
      { personnelId: 'p2', sonuc: sonuc('TAM_FORMLA') },
      { personnelId: 'p3', sonuc: sonuc('TAM') },
    ])
    expect(r).toEqual({ yazilan: 2, kilitliAtlanan: 1 })
    expect(tablo.get('p1')).toEqual({ durum: 'GELMEDI', kilitli: true }) // dokunulmadı
    expect(tablo.get('p2')!.durum).toBe('TAM_FORMLA')
    expect(tablo.get('p3')!.durum).toBe('TAM')
  })
  it('hepsi kilitliyse yazıcı hiç çağrılmaz', async () => {
    let cagri = 0
    const r = await sonuclariYaz(
      { kilitliler: async (_g, ids) => new Set(ids), yaz: async () => void cagri++ },
      '2026-09-28',
      [{ personnelId: 'p1', sonuc: sonuc('TAM') }],
    )
    expect(r).toEqual({ yazilan: 0, kilitliAtlanan: 1 })
    expect(cagri).toBe(0)
  })
})

describe('gün yardımcıları (İstanbul)', () => {
  it('gunStr UTC 21:30 → ertesi yerel gün; gunEkle ay sonu', () => {
    expect(gunStr(new Date('2026-09-28T21:30:00Z'))).toBe('2026-09-29')
    expect(gunEkle('2026-09-30', 1)).toBe('2026-10-01')
    expect(gunEkle('2026-10-01', -8)).toBe('2026-09-23')
  })
})
