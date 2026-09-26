import { describe, expect, it } from 'vitest'
import {
  SIKAYET_PDF_KOLONLARI,
  sikayetExcelDosyaAdi,
  sikayetExcelSatirlari,
  SIKAYET_EXPORT_GORUNUMU,
  SIKAYET_EXPORT_KOLONLARI,
  type SikayetFirmaKaydi,
} from './sikayet-excel'
import { firmaSiniriniDogrula } from './sikayet-firma-siniri'

function kayit(ek: Partial<SikayetFirmaKaydi> = {}): SikayetFirmaKaydi {
  return {
    id: 'c1',
    no: 7,
    tarih: new Date('2026-09-01T00:00:00.000Z'),
    bildirimTarihi: new Date('2026-09-02T00:00:00.000Z'),
    kategori: 'GEC_GELME',
    aciklama: 'Servis 20 dakika geç geldi',
    durum: 'ACIK',
    kaynak: 'IV',
    termin: null,
    aksiyon: null,
    aksiyonTarihi: null,
    kapanisTarihi: null,
    kapanisNotu: null,
    guzergahId: 'g1',
    dilimId: 'd1',
    firmaId: 'f1',
    aracId: null,
    soforId: null,
    durakId: 'dr1',
    guzergah: { kod: 'GZR-01', ad: 'Çerkezköy Hattı' },
    durak: { id: 'dr1', kod: 'DRK-01', ad: 'Merkez' },
    plaka: '59 ABC 123',
    soforAdSoyad: 'Sürücü Bir',
    firmaAd: 'Taşeron A.Ş.',
    sorumluAdSoyad: 'İV Sorumlusu',
    planlananSaat: '07:30',
    createdAt: new Date('2026-09-02T08:00:00.000Z'),
    ...ek,
  } as SikayetFirmaKaydi
}

describe('sikayetExcelSatirlari — sunum', () => {
  it('enum değerlerini Türkçe etikete çevirir', () => {
    const [s] = sikayetExcelSatirlari([kayit({ kategori: 'TEHLIKELI_KULLANIM', kaynak: 'PERSONEL', durum: 'KAPANDI' })])
    expect(s.kategori).toBe('Tehlikeli kullanım')
    expect(s.kaynak).toBe('Çalışan')
    expect(s.durum).toBe('Kapandı')
  })

  it('güzergâhı "KOD — Ad" biçiminde yazar, güzergâh yoksa boş bırakır', () => {
    expect(sikayetExcelSatirlari([kayit()])[0].guzergah).toBe('GZR-01 — Çerkezköy Hattı')
    expect(sikayetExcelSatirlari([kayit({ guzergah: null })])[0].guzergah).toBe('')
  })

  it('durağı "KOD — Ad" biçiminde yazar, durak yoksa boş bırakır', () => {
    expect(sikayetExcelSatirlari([kayit()])[0].durak).toBe('DRK-01 — Merkez')
    expect(sikayetExcelSatirlari([kayit({ durak: null })])[0].durak).toBe('')
  })

  it('firma adı boşsa satır DÜŞMEZ, gruplanabilir bir etiket alır', () => {
    // Gruplama alanı boş kalırsa grup başlığı boş görünür; bu bilinçli dolgu.
    expect(sikayetExcelSatirlari([kayit({ firmaAd: null })])[0].firmaAd).toBe('Firma belirtilmemiş')
  })

  it('tarihleri Date olarak bırakır (biçimi Excel numFmt verir, metne çevrilmez)', () => {
    const [s] = sikayetExcelSatirlari([kayit()])
    expect(s.bildirimTarihi).toBeInstanceOf(Date)
    expect(s.olayTarihi).toBeInstanceOf(Date)
  })
})

describe('🔴 KVKK — şikâyetçi ve ham kimlik alanları dosyaya girmez', () => {
  it('üretilen satırlarda şikâyetçi anahtarı YOK (bekçiden geçer)', () => {
    const satirlar = sikayetExcelSatirlari([kayit()])
    expect(() => firmaSiniriniDogrula(satirlar)).not.toThrow()
  })

  it('🔴 bekçi VAKUMLU DEĞİL: satırlara şikâyetçi alanı eklenirse yakalar', () => {
    const kirli = sikayetExcelSatirlari([kayit()]).map(s => ({ ...s, sikayetciAdSoyad: 'Ali Veli' }))
    expect(() => firmaSiniriniDogrula(kirli)).toThrow(/şikâyetçi kimliği bulundu/)
  })

  it('ham UUID kolonları (…Id) dosyaya yazılmaz', () => {
    const [s] = sikayetExcelSatirlari([kayit()])
    const idAnahtarlari = Object.keys(s).filter(a => a === 'id' || a.endsWith('Id'))
    expect(idAnahtarlari).toEqual([])
  })
})

describe('görünüm tanımı', () => {
  it('🔴 SÜRÜKLENME: kolon alanları ile satır anahtarları BİREBİR aynı', () => {
    // Kolon eklenip satır dönüşümü unutulursa (ya da tersi) bu test patlar.
    const [s] = sikayetExcelSatirlari([kayit()])
    expect(new Set(SIKAYET_EXPORT_GORUNUMU.kolonlar.map(k => k.alan))).toEqual(new Set(Object.keys(s)))
  })

  it('firmaAd üzerinden gruplanır', () => {
    expect(SIKAYET_EXPORT_GORUNUMU.gruplar).toEqual(['firmaAd'])
  })

  it('🔴 Ders 79 — hiçbir kolon oran/yüzde taşımaz, tek alt toplam SAYIM', () => {
    const toplamli = SIKAYET_EXPORT_GORUNUMU.kolonlar.filter(k => k.toplam)
    expect(toplamli.map(k => k.alan)).toEqual(['no'])
    expect(toplamli[0].toplam).toBe('say')

    for (const k of SIKAYET_EXPORT_GORUNUMU.kolonlar) {
      expect(k.bicim ?? '').not.toMatch(/%/)
      expect(k.baslik ?? '').not.toMatch(/%|[Oo]ran|[Yy]üzde/)
    }
  })

  it('görünümde ikinci bir süzgeç yok (süzme sorgu katmanında)', () => {
    expect(SIKAYET_EXPORT_GORUNUMU.filtreler).toEqual({})
  })

  it('tüm kolonlar görünür', () => {
    expect(SIKAYET_EXPORT_GORUNUMU.kolonlar.every(k => k.gorunur)).toBe(true)
    expect(SIKAYET_EXPORT_GORUNUMU.kolonlar).toHaveLength(SIKAYET_EXPORT_KOLONLARI.length)
  })
})

describe('sikayetExcelDosyaAdi', () => {
  it('🔴 SALT ASCII ve tarih taşır', () => {
    const ad = sikayetExcelDosyaAdi(new Date('2026-09-26T10:00:00.000Z'))
    expect(ad).toBe('Servis-Sikayet-Firma-Raporu-2026-09-26.xlsx')
    // eslint-disable-next-line no-control-regex
    expect(ad).toMatch(/^[\x00-\x7F]+$/)
    expect(ad).toMatch(/^[A-Za-z0-9._-]+\.xlsx$/)
  })
})

// ----------------------------------------------------------------------------
// Adım 5G — PDF kolon alt kümesi tek kaynaktan türer
// ----------------------------------------------------------------------------
describe('SIKAYET_PDF_KOLONLARI', () => {
  it('🔴 Excel kolonlarının ALT KÜMESİ — ayrı bir liste değil', () => {
    const excel = new Set(SIKAYET_EXPORT_KOLONLARI.map(k => k.alan))
    for (const k of SIKAYET_PDF_KOLONLARI) expect(excel.has(k.alan)).toBe(true)
    expect(SIKAYET_PDF_KOLONLARI.length).toBeLessThan(SIKAYET_EXPORT_KOLONLARI.length)
  })

  it('🔴 PDF dışında bırakılanlar TAM OLARAK belgelenen küme', () => {
    // Bu liste değişirse test patlar — "PDF\'te neden yok" sorusu sessizce
    // cevapsız kalmasın. Excel HER ZAMAN tam listedir.
    const disarida = SIKAYET_EXPORT_KOLONLARI.filter(k => !k.pdf).map(k => k.alan)
    expect(disarida.sort()).toEqual([
      'aksiyonTarihi', 'firmaAd', 'kapanisNotu', 'kaynak',
      'olayTarihi', 'planlananSaat', 'sorumluAdSoyad', 'termin',
    ])
  })

  it('PDF kolonları da satır anahtarlarıyla eşleşir (ölü kolon yok)', () => {
    const [s] = sikayetExcelSatirlari([kayit()])
    for (const k of SIKAYET_PDF_KOLONLARI) expect(Object.keys(s)).toContain(k.alan)
  })

  it('🔴 Ders 79 — PDF tablosunda da oran/yüzde başlığı yok', () => {
    for (const k of SIKAYET_PDF_KOLONLARI) {
      expect(k.baslik).not.toMatch(/%|[Oo]ran|[Yy]üzde/)
    }
  })
})
