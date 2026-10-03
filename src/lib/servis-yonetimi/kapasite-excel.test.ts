import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { ServisKapasiteToplu } from './kapasite'
import {
  KAPASITE_GUZERGAH_BASLIKLARI,
  kapasiteExcelDosyaAdi,
  kapasiteExcelOlustur,
  kapasiteGuzergahSatirlari,
} from './kapasite-excel'

const ozet = (o: object) => ({
  kapasite: 10, atananPersonelSayisi: 5, bosKoltuk: 5, dolulukOrani: 50, aracSayisi: 1, durum: 'UYGUN', asimMiktari: 0, ...o,
})
const g = (kod: string, ad: string, araclar: string[], o: object) => ({
  guzergahId: kod, kod, ad, dilimKod: 'SABAH', dilimSayisi: 1, aracliDilimSayisi: araclar.length, araclar, ozet: ozet(o), dilimler: [],
})
const TOPLU = {
  tarih: '2026-10-03',
  guzergahlar: [
    g('G1', 'İstanbul Hattı', ['34 ABC 123', '34 ABC 124'], { kapasite: 16, atananPersonelSayisi: 12, bosKoltuk: 4, dolulukOrani: 75.04 }),
    g('G2', 'Şişli Hattı', ['34 SIS 001'], { kapasite: 10, atananPersonelSayisi: 12, bosKoltuk: -2, dolulukOrani: 120, durum: 'ASIM', asimMiktari: 2 }),
    g('G3', 'Çayırova Hattı', [], { kapasite: 0, atananPersonelSayisi: 3, bosKoltuk: -3, dolulukOrani: null, durum: 'ARAC_YOK', aracSayisi: 0 }),
  ],
  dilimSatirlari: [
    { guzergahId: 'G2', guzergahKod: 'G2', guzergahAd: 'Şişli Hattı', dilimId: 'd1', dilimKod: 'SABAH', dilimAd: 'Sabah', araclar: ['34 SIS 001'], ozet: ozet({ kapasite: 10, atananPersonelSayisi: 12, bosKoltuk: -2, dolulukOrani: 120, durum: 'ASIM', asimMiktari: 2 }) },
  ],
  asimlar: [{ guzergahId: 'G2', kod: 'G2', ad: 'Şişli Hattı', dilimKod: 'SABAH', koltuk: 10, personel: 12, fazla: 2 }],
  toplam: { guzergahSayisi: 3, atanmisPersonel: 27, toplamKoltuk: 26, netBosKoltuk: 2, asimSayisi: 1, asimKisi: 2, aracsizGuzergahSayisi: 1, dolmakUzereSayisi: 0 },
} as unknown as ServisKapasiteToplu

describe('kapasite Excel', () => {
  it('güzergâh sayfası: başlıklar + motor sayıları; araç yoksa koltuk/boş/doluluk BOŞ hücre', () => {
    const s = kapasiteGuzergahSatirlari(TOPLU.guzergahlar)
    expect(s[0]).toEqual([...KAPASITE_GUZERGAH_BASLIKLARI])
    expect(s[1]).toEqual(['G1', 'İstanbul Hattı', '34 ABC 123, 34 ABC 124', 16, 12, 4, 75, 'Uygun', 'SABAH'])
    expect(s[2]).toEqual(['G2', 'Şişli Hattı', '34 SIS 001', 10, 12, -2, 120, 'Aşım +2', 'SABAH'])
    expect(s[3]).toEqual(['G3', 'Çayırova Hattı', '', '', 3, '', '', 'Araç yok', 'SABAH'])
  })

  it('xlsx: 4 sayfa (Özet, Güzergâh Kapasitesi, Dilim Detayı, Aşımlar); özet tarih ve toplamlar', () => {
    const wb = XLSX.read(kapasiteExcelOlustur(TOPLU), { type: 'buffer' })
    expect(wb.SheetNames).toEqual(['Özet', 'Güzergâh Kapasitesi', 'Dilim Detayı', 'Aşımlar'])
    const ozetSayfa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Özet'], { header: 1 })
    expect(ozetSayfa[1]).toEqual(['Rapor tarihi', '2026-10-03'])
    expect(ozetSayfa.find((r) => String(r[0]).startsWith('Kapasite aşımı'))?.[1]).toBe(1)
    const asim = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Aşımlar'], { header: 1 })
    expect(asim[1]).toEqual(['G2', 'Şişli Hattı', 'SABAH', 10, 12, 2])
  })

  it('KVKK: dosyada kişi alanı yok (yalnız güzergâh/plaka/sayı başlıkları)', () => {
    const wb = XLSX.read(kapasiteExcelOlustur(TOPLU), { type: 'buffer' })
    const metin = wb.SheetNames.map((n) => JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }))).join('')
    expect(metin).not.toMatch(/SİCİL|AD SOYAD|TELEFON|ADRES/i)
  })

  it('dosya adı salt ASCII', () => {
    expect(kapasiteExcelDosyaAdi('2026-10-03')).toBe('Kapasite-Raporu-2026-10-03.xlsx')
  })
})
