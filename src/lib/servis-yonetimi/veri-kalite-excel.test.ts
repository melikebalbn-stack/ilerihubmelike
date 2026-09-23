import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  EXCEL_SATIR_TAVANI,
  KAPSAM_DISI_METNI,
  KIRPILDI_METNI,
  SAYFA_ADI_MAX,
  tarihMetni,
  veriKaliteExcelDosyaAdi,
  veriKaliteExcelOlustur,
  type VeriKaliteExcelSatiri,
} from './veri-kalite-excel'

// ----------------------------------------------------------------------------
// Yardımcılar — üretilen dosyayı GERÇEKTEN okuyarak doğrularız (mock yok).
// ----------------------------------------------------------------------------

function oku(buf: Buffer) {
  return XLSX.read(buf, { type: 'buffer' })
}

/** Bir sayfayı satır dizisi olarak döndürür (başlık dahil). */
function sayfaSatirlari(wb: XLSX.WorkBook, ad: string): unknown[][] {
  const ws = wb.Sheets[ad]
  expect(ws, `"${ad}" sayfası yok. Mevcut: ${wb.SheetNames.join(', ')}`).toBeTruthy()
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }) as unknown[][]
}

function ozetSatiri(wb: XLSX.WorkBook, kod: string): unknown[] {
  const satirlar = sayfaSatirlari(wb, 'Özet')
  const bulunan = satirlar.find(s => s[0] === kod)
  expect(bulunan, `Özet'te "${kod}" satırı yok`).toBeTruthy()
  return bulunan!
}

// Özet kolonları: Kod | Kontrol | Adet | Satır | Durum | Not
const SUTUN = { KOD: 0, KONTROL: 1, ADET: 2, SATIR: 3, DURUM: 4, NOT: 5 } as const

function bulgu(
  kod: string,
  baslik: string,
  kayitlar: Record<string, unknown>[],
  ek: Partial<VeriKaliteExcelSatiri> = {},
): VeriKaliteExcelSatiri {
  return { kod, baslik, adet: kayitlar.length, kayitlar, ...ek }
}

function yerTutucu(kod: string, baslik: string, not: string): VeriKaliteExcelSatiri {
  return { kod, baslik, adet: 0, kayitlar: [], kirpildi: false, kapsamDisi: true, not }
}

/** API'nin döndürdüğü 16 satırın (13 kontrol + 3 yer tutucu) temsili. */
function tamRapor(ustGelen: Partial<Record<string, VeriKaliteExcelSatiri>> = {}): VeriKaliteExcelSatiri[] {
  const varsayilan: VeriKaliteExcelSatiri[] = [
    bulgu('aktif-personel-servis-yok', 'Aktif personel / servis yok', []),
    bulgu('pasif-personel-servis-aktif', 'Pasif personel / servis aktif', []),
    bulgu('mukerrer-aktif-servis', 'Mükerrer aktif servis', []),
    bulgu('servis-var-arac-yok', 'Servis var / araç yok', []),
    bulgu('servis-var-sofor-yok', 'Servis var / sürücü yok', []),
    bulgu('guzergah-sefer-dilimi-tanimsiz', 'Güzergah var / sefer dilimi tanımsız', []),
    bulgu('kapasitesi-eksik-arac', 'Kapasitesi eksik araç', []),
    bulgu('koordinatsiz-durak', 'Koordinatsız durak', []),
    yerTutucu('vardiya-uyumsuzlugu', 'Vardiya uyumsuzluğu', 'Veri kaynağı yok (B.8).'),
    bulgu('cakisan-atamalar', 'Çakışan atamalar', []),
    yerTutucu('adres-degismis-servis-yeniden-degerlendirilmemis', 'Adres değişmiş / yeniden değerlendirilmemiş', 'Veri kaynağı yok (B.10).'),
    bulgu('suresi-bitmis-gecici-atama', 'Süresi bitmiş geçici atama', []),
    yerTutucu('kapasite-asimi', 'Kapasite aşımı', 'Kapasite motoru main\'e girmedi.'),
    bulgu('tarih-cakismasi-arac-sofor', 'Tarih çakışması (araç/şoför)', []),
    bulgu('aktif-arac-pasif-firma', 'Eksik firma ilişkisi (a)', []),
    bulgu('dis-firma-soforu-firmasiz', 'Eksik firma ilişkisi (b)', []),
  ]
  return varsayilan.map(s => ustGelen[s.kod] ?? s)
}

const YER_TUTUCU_KODLARI = [
  'vardiya-uyumsuzlugu',
  'adres-degismis-servis-yeniden-degerlendirilmemis',
  'kapasite-asimi',
]

// ----------------------------------------------------------------------------
// Özet sayfası
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — Özet sayfası', () => {
  it('16 kontrolün (13 uygulanmış + 3 yer tutucu) HEPSİ Özet\'te listelenir', () => {
    const wb = oku(veriKaliteExcelOlustur(tamRapor()))
    const satirlar = sayfaSatirlari(wb, 'Özet')

    // 1 başlık + 16 kontrol
    expect(satirlar).toHaveLength(17)
    for (const s of tamRapor()) {
      expect(satirlar.some(r => r[0] === s.kod), `${s.kod} eksik`).toBe(true)
    }
  })

  it('🔴 yer tutucu 3 kontrolün Adet hücresine 0 YAZILMAZ, "KAPSAM DIŞI" yazar', () => {
    const wb = oku(veriKaliteExcelOlustur(tamRapor()))

    for (const kod of YER_TUTUCU_KODLARI) {
      const satir = ozetSatiri(wb, kod)
      // Açıkça: ne sayı 0, ne de "0" metni.
      expect(satir[SUTUN.ADET], `${kod} adet hücresi 0 OLMAMALI`).not.toBe(0)
      expect(satir[SUTUN.ADET], `${kod} adet hücresi "0" OLMAMALI`).not.toBe('0')
      expect(satir[SUTUN.ADET]).toBe('')
      expect(String(satir[SUTUN.DURUM])).toContain('KAPSAM DIŞI')
      expect(satir[SUTUN.DURUM]).toBe(KAPSAM_DISI_METNI)
    }
  })

  it('uygulanmış ama kaydı olmayan kontrol 0 yazar ve "Temiz" der (yer tutucudan AYRIŞIR)', () => {
    const wb = oku(veriKaliteExcelOlustur(tamRapor()))
    const satir = ozetSatiri(wb, 'koordinatsiz-durak')

    expect(satir[SUTUN.ADET]).toBe(0)
    expect(satir[SUTUN.DURUM]).toBe('Temiz')
    expect(String(satir[SUTUN.DURUM])).not.toContain('KAPSAM DIŞI')
  })

  it('kaydı olan kontrol adet + satır sayısını yazar', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'kapasitesi-eksik-arac': bulgu('kapasitesi-eksik-arac', 'Kapasitesi eksik araç', [
            { id: 'a1', plaka: '41 AB 1', kapasite: 0, firmaAd: 'Firma A' },
            { id: 'a2', plaka: '41 AB 2', kapasite: 0, firmaAd: 'Firma B' },
          ]),
        }),
      ),
    )
    const satir = ozetSatiri(wb, 'kapasitesi-eksik-arac')
    expect(satir[SUTUN.ADET]).toBe(2)
    expect(satir[SUTUN.SATIR]).toBe(2)
    expect(satir[SUTUN.DURUM]).toBe('Kayıt var')
  })

  it('iç içe diziden türeyen sayfalarda satır > kayıt olduğu Özet\'te NOT olarak yazar', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'mukerrer-aktif-servis': bulgu('mukerrer-aktif-servis', 'Mükerrer aktif servis', [
            {
              personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet', bolum: 'Üretim', aktifAtamaSayisi: 2,
              atamalar: [
                { id: 'x1', guzergahKod: 'G1', guzergahAd: 'Hat 1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null },
                { id: 'x2', guzergahKod: 'G2', guzergahAd: 'Hat 2', baslangicTarihi: new Date('2026-02-01'), bitisTarihi: null },
              ],
            },
          ]),
        }),
      ),
    )
    const satir = ozetSatiri(wb, 'mukerrer-aktif-servis')
    expect(satir[SUTUN.ADET]).toBe(1)
    expect(satir[SUTUN.SATIR]).toBe(2)
    expect(String(satir[SUTUN.NOT])).toContain('Satır sayısı kayıt sayısından FAZLADIR')
  })

  it('kontrol hata döndüyse Özet durumunda HATA görünür (sessizce "Temiz" denmez)', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'cakisan-atamalar': { kod: 'cakisan-atamalar', baslik: 'Çakışan atamalar', adet: 0, kayitlar: [], hata: 'DB bağlantısı düştü' },
        }),
      ),
    )
    const satir = ozetSatiri(wb, 'cakisan-atamalar')
    expect(String(satir[SUTUN.DURUM])).toContain('HATA')
    expect(String(satir[SUTUN.DURUM])).toContain('DB bağlantısı düştü')
    expect(satir[SUTUN.DURUM]).not.toBe('Temiz')
  })
})

// ----------------------------------------------------------------------------
// Sayfa açma kuralı
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — sayfa açma', () => {
  it('kaydı OLMAYAN kontrol için sayfa AÇILMAZ (yalnız Özet kalır)', () => {
    const wb = oku(veriKaliteExcelOlustur(tamRapor()))
    expect(wb.SheetNames).toEqual(['Özet'])
  })

  it('yer tutucu için de sayfa açılmaz', () => {
    const wb = oku(veriKaliteExcelOlustur(tamRapor()))
    expect(wb.SheetNames).not.toContain('Vardiya uyumsuzluğu')
    expect(wb.SheetNames).toHaveLength(1)
  })

  it('kaydı OLAN her kontrol için ayrı sayfa açılır', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'kapasitesi-eksik-arac': bulgu('kapasitesi-eksik-arac', 'Kapasitesi eksik araç', [
            { id: 'a1', plaka: '41 AB 1', kapasite: 0, firmaAd: 'Firma A' },
          ]),
          'dis-firma-soforu-firmasiz': bulgu('dis-firma-soforu-firmasiz', 'Eksik firma ilişkisi (b)', [
            { id: 's1', adSoyad: 'Sürücü', disFirmaSoforKodu: 'X-9' },
          ]),
        }),
      ),
    )
    expect(wb.SheetNames).toHaveLength(3)
    expect(wb.SheetNames[0]).toBe('Özet')
  })
})

// ----------------------------------------------------------------------------
// 🔴 Sayfa adı kuralı (Excel biçim sınırı)
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — sayfa adları', () => {
  /** HER kontrole birer kayıt vererek tüm sayfaları açtıran rapor. */
  function herKontroldeKayitliRapor(): VeriKaliteExcelSatiri[] {
    return tamRapor().map(s => (s.kapsamDisi ? s : bulgu(s.kod, s.baslik, [{ ornek: 'x' }])))
  }

  it('hepsi ≤31 karakter, hepsi birbirinden FARKLI ve yasaklı karakter yok', () => {
    const wb = oku(veriKaliteExcelOlustur(herKontroldeKayitliRapor()))

    // Özet + 13 uygulanmış kontrol
    expect(wb.SheetNames).toHaveLength(14)
    for (const ad of wb.SheetNames) {
      expect(ad.length, `"${ad}" ${ad.length} karakter`).toBeLessThanOrEqual(SAYFA_ADI_MAX)
      expect(ad, `"${ad}" yasaklı karakter içeriyor`).not.toMatch(/[:\\/?*[\]]/)
    }
    expect(new Set(wb.SheetNames).size).toBe(wb.SheetNames.length)
  })

  it('aynı başlıklı iki kontrol gelse bile sayfa adları TEKİL kalır', () => {
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('bilinmeyen-kontrol-a', 'Aynı Başlık', [{ x: 1 }]),
        bulgu('bilinmeyen-kontrol-b', 'Aynı Başlık', [{ x: 2 }]),
      ]),
    )
    expect(new Set(wb.SheetNames).size).toBe(wb.SheetNames.length)
    expect(wb.SheetNames).toHaveLength(3)
  })

  it('31 karakterden uzun ve yasaklı karakterli başlık güvenli ada indirgenir', () => {
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('uzun-kod', 'Adres değişmiş / servis yeniden değerlendirilmemiş [acil]', [{ x: 1 }]),
      ]),
    )
    const ad = wb.SheetNames[1]
    expect(ad.length).toBeLessThanOrEqual(SAYFA_ADI_MAX)
    expect(ad).not.toMatch(/[:\\/?*[\]]/)
  })
})

// ----------------------------------------------------------------------------
// 🔴 Düzleştirme
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — düzleştirme', () => {
  it('mukerrer-aktif-servis: 1 personel / 2 atama → 2 veri satırı, personel kimliği tekrar eder', () => {
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('mukerrer-aktif-servis', 'Mükerrer aktif servis', [
          {
            personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet Yılmaz', bolum: 'Üretim', aktifAtamaSayisi: 2,
            atamalar: [
              { id: 'x1', guzergahKod: 'G1', guzergahAd: 'Hat 1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null },
              { id: 'x2', guzergahKod: 'G2', guzergahAd: 'Hat 2', baslangicTarihi: new Date('2026-02-01'), bitisTarihi: new Date('2026-03-01') },
            ],
          },
        ]),
      ]),
    )
    const satirlar = sayfaSatirlari(wb, 'Mükerrer Aktif Servis')

    expect(satirlar).toHaveLength(3) // başlık + 2
    expect(satirlar[1][1]).toBe('Ahmet Yılmaz')
    expect(satirlar[2][1]).toBe('Ahmet Yılmaz') // kimlik TEKRAR eder
    const guzergahSutunu = satirlar[0].indexOf('Güzergah Kod')
    expect(satirlar[1][guzergahSutunu]).toBe('G1')
    expect(satirlar[2][guzergahSutunu]).toBe('G2')
  })

  it('cakisan-atamalar: 1 personel / 2 çift → 2 veri satırı', () => {
    const cift = (g1: string, g2: string) => ({
      atama1: { id: 'a', guzergahKod: g1, baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null },
      atama2: { id: 'b', guzergahKod: g2, baslangicTarihi: new Date('2026-01-15'), bitisTarihi: null },
    })
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('cakisan-atamalar', 'Çakışan atamalar', [
          { personnelId: 'p1', sicilNo: '111', adSoyad: 'Ayşe', bolum: 'Kalite', cakisanCiftSayisi: 2, ciftler: [cift('G1', 'G2'), cift('G3', 'G4')] },
        ]),
      ]),
    )
    const satirlar = sayfaSatirlari(wb, 'Çakışan Atamalar')

    expect(satirlar).toHaveLength(3)
    expect(satirlar[1][1]).toBe('Ayşe')
    expect(satirlar[2][1]).toBe('Ayşe')
    const s1 = satirlar[0].indexOf('Atama 1 Güzergah')
    expect(satirlar[1][s1]).toBe('G1')
    expect(satirlar[2][s1]).toBe('G3')
  })

  it('🔴 tarih-cakismasi-arac-sofor: TEK "Kaynak" kolonu; ARAÇ ve ŞOFÖR satırlarının İKİSİ de dolu', () => {
    const atamalar = {
      atama1: { id: 'a', guzergahKod: 'G1', baslangicTarihi: new Date('2026-01-01'), bitisTarihi: null },
      atama2: { id: 'b', guzergahKod: 'G2', baslangicTarihi: new Date('2026-01-10'), bitisTarihi: null },
    }
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('tarih-cakismasi-arac-sofor', 'Tarih çakışması (araç/şoför)', [
          { tur: 'ARAC', aracPlaka: '41 AB 1', dilimKod: 'SABAH', ...atamalar },
          { tur: 'SOFOR', soforAdSoyad: 'Mehmet Şoför', dilimKod: 'AKSAM', ...atamalar },
        ]),
      ]),
    )
    const satirlar = sayfaSatirlari(wb, 'Tarih Çakışması')
    const basliklar = satirlar[0] as string[]

    // Tek kaynak kolonu — ayrı "Plaka"/"Sürücü" kolonları AÇILMAMIŞ olmalı.
    const kaynakSutunlari = basliklar.filter(b => /Kaynak/.test(b))
    expect(kaynakSutunlari).toHaveLength(1)
    expect(basliklar).not.toContain('Plaka')
    expect(basliklar).not.toContain('Sürücü')
    expect(basliklar).not.toContain('Araç Plaka')

    const kaynak = basliklar.indexOf(kaynakSutunlari[0])
    expect(satirlar[1][kaynak]).toBe('41 AB 1')
    expect(satirlar[2][kaynak]).toBe('Mehmet Şoför')
    // İkisi de DOLU — yarısı boş kolon yok.
    expect(satirlar[1][kaynak]).not.toBe('')
    expect(satirlar[2][kaynak]).not.toBe('')

    expect(satirlar[1][basliklar.indexOf('Tür')]).toBe('ARAÇ')
    expect(satirlar[2][basliklar.indexOf('Tür')]).toBe('ŞOFÖR')
  })
})

// ----------------------------------------------------------------------------
// 🔴 50.000 satır güvenlik tavanı (Ders 76 — kesme VE bildirim birlikte)
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — satır tavanı', () => {
  it('tavanın ÜSTÜNDE veri verildiğinde satır kesilir VE Özet\'te "KIRPILDI" yazar', () => {
    const fazla = EXCEL_SATIR_TAVANI + 1
    const kayitlar = Array.from({ length: fazla }, (_, i) => ({
      id: `p${i}`, sicilNo: String(i), adSoyad: `Personel ${i}`, bolum: 'Üretim',
    }))

    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'aktif-personel-servis-yok': bulgu('aktif-personel-servis-yok', 'Aktif personel / servis yok', kayitlar),
        }),
      ),
    )

    // (1) Satır GERÇEKTEN kesildi
    const satirlar = sayfaSatirlari(wb, 'Personel Var Servis Yok')
    expect(satirlar).toHaveLength(EXCEL_SATIR_TAVANI + 1) // başlık + tavan

    // (2) VE Özet bunu bildiriyor — ikisi birlikte
    const ozet = ozetSatiri(wb, 'aktif-personel-servis-yok')
    expect(ozet[SUTUN.DURUM]).toBe(KIRPILDI_METNI)
    expect(ozet[SUTUN.ADET]).toBe(fazla) // gerçek toplam korunur
    expect(ozet[SUTUN.SATIR]).toBe(EXCEL_SATIR_TAVANI)
    expect(String(ozet[SUTUN.NOT])).toContain(String(EXCEL_SATIR_TAVANI))
  }, 60_000)

  it('tavanın ALTINDA kırpma olmaz, "KIRPILDI" yazılmaz', () => {
    const kayitlar = Array.from({ length: 300 }, (_, i) => ({
      id: `p${i}`, sicilNo: String(i), adSoyad: `Personel ${i}`, bolum: 'Üretim',
    }))
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'aktif-personel-servis-yok': bulgu('aktif-personel-servis-yok', 'Aktif personel / servis yok', kayitlar),
        }),
      ),
    )
    expect(sayfaSatirlari(wb, 'Personel Var Servis Yok')).toHaveLength(301)
    const ozet = ozetSatiri(wb, 'aktif-personel-servis-yok')
    expect(ozet[SUTUN.DURUM]).toBe('Kayıt var')
    expect(ozet[SUTUN.DURUM]).not.toBe(KIRPILDI_METNI)
  })

  it('girdi zaten kırpılmış geldiyse (ekran limiti) Özet bunu da KIRPILDI olarak bildirir', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor({
          'koordinatsiz-durak': bulgu(
            'koordinatsiz-durak',
            'Koordinatsız durak',
            [{ id: 'd1', kod: 'D1', ad: 'Durak 1', il: 'Kocaeli', ilce: 'Gebze', aktif: true, aktifGuzergahaBagli: true }],
            { adet: 500, kirpildi: true },
          ),
        }),
      ),
    )
    const ozet = ozetSatiri(wb, 'koordinatsiz-durak')
    expect(ozet[SUTUN.DURUM]).toBe(KIRPILDI_METNI)
    expect(ozet[SUTUN.ADET]).toBe(500)
  })
})

// ----------------------------------------------------------------------------
// 🔴 KVKK
// ----------------------------------------------------------------------------
describe('veriKaliteExcelOlustur — KVKK sınırı', () => {
  it('üretilen HİÇBİR sayfada telefon/adres/e-posta kolonu YOK', () => {
    const wb = oku(
      veriKaliteExcelOlustur(
        tamRapor().map(s =>
          s.kapsamDisi
            ? s
            : bulgu(s.kod, s.baslik, [
                { id: 'p1', sicilNo: '111', adSoyad: 'Ahmet', bolum: 'Üretim', plaka: '41 AB 1', adSoyadSofor: 'X' },
              ]),
        ),
      ),
    )

    const yasakli = /telefon|tel\b|gsm|adres|e-?posta|email|mail/i
    for (const ad of wb.SheetNames) {
      const basliklar = (sayfaSatirlari(wb, ad)[0] ?? []) as string[]
      for (const b of basliklar) {
        expect(String(b), `"${ad}" sayfasında yasak kolon: ${b}`).not.toMatch(yasakli)
      }
    }
  })

  it('kayıtta beklenmedik şekilde telefon gelse bile tanımlı sayfalarda kolona DÖNÜŞMEZ', () => {
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('aktif-personel-servis-yok', 'Aktif personel / servis yok', [
          { id: 'p1', sicilNo: '111', adSoyad: 'Ahmet', bolum: 'Üretim', telefon: '0555 111 22 33' },
        ]),
      ]),
    )
    const basliklar = sayfaSatirlari(wb, 'Personel Var Servis Yok')[0] as string[]
    expect(basliklar).toEqual(['Sicil No', 'Ad Soyad', 'Bölüm'])

    // Sayfanın hiçbir hücresinde o numara geçmiyor.
    const tumHucreler = sayfaSatirlari(wb, 'Personel Var Servis Yok').flat().map(String)
    expect(tumHucreler.some(h => h.includes('0555'))).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// Tarih biçimi
// ----------------------------------------------------------------------------
describe('tarihMetni — YYYY-MM-DD metin', () => {
  it('Date, ISO string ve tarih-saat string aynı biçime indirgenir', () => {
    expect(tarihMetni(new Date('2026-03-05T00:00:00.000Z'))).toBe('2026-03-05')
    expect(tarihMetni('2026-03-05')).toBe('2026-03-05')
    expect(tarihMetni('2026-03-05T00:00:00.000Z')).toBe('2026-03-05')
  })

  it('boş değerler boş metne indirgenir, geçersiz Date çökmez', () => {
    expect(tarihMetni(null)).toBe('')
    expect(tarihMetni(undefined)).toBe('')
    expect(tarihMetni('')).toBe('')
    expect(tarihMetni(new Date('gecersiz'))).toBe('')
  })

  it('sayfada tarihler METİN olarak yazılır (yerel biçim belirsizliği yok)', () => {
    const wb = oku(
      veriKaliteExcelOlustur([
        bulgu('suresi-bitmis-gecici-atama', 'Süresi bitmiş geçici atama', [
          {
            id: 'a1', personnelId: 'p1', sicilNo: '111', adSoyad: 'Ahmet', bolum: 'Üretim',
            guzergahKod: 'G1', guzergahAd: 'Hat 1',
            baslangicTarihi: new Date('2026-01-01T00:00:00.000Z'),
            bitisTarihi: new Date('2026-02-28T00:00:00.000Z'),
          },
        ]),
      ]),
    )
    const satirlar = sayfaSatirlari(wb, 'Süresi Bitmiş Atama')
    const basliklar = satirlar[0] as string[]
    expect(satirlar[1][basliklar.indexOf('Başlangıç')]).toBe('2026-01-01')
    expect(satirlar[1][basliklar.indexOf('Bitiş')]).toBe('2026-02-28')
  })
})

describe('veriKaliteExcelDosyaAdi', () => {
  it('tarihi ISO biçiminde taşır', () => {
    expect(veriKaliteExcelDosyaAdi(new Date('2026-09-23T10:00:00.000Z'))).toBe('Veri-Kalite-Raporu-2026-09-23.xlsx')
  })
})
