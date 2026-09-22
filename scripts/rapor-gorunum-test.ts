/**
 * gorunum.ts birim testi — saf, DB/IFS yok.
 *   npx tsx scripts/rapor-gorunum-test.ts
 */
import { gorunumUygula, oranBilesenleri, filtreEslesir, kiyasla, toplamHesapla } from '../src/lib/rapor/gorunum'
import type { Gorunum } from '../src/lib/rapor/tipler'

let ok = 0, hata = 0
function test(ad: string, kosul: boolean, detay?: unknown) {
  kosul ? ok++ : hata++
  console.log(`${kosul ? '✓' : '✗'} ${ad}${kosul ? '' : `   → ${JSON.stringify(detay)}`}`)
}

const veri = [
  { tezgah: 'CNC-01', durum: 'Closed',   isEmri: 'İE-1', planlanan: 100, tamamlanan: 100, termin: '2026-09-05' },
  { tezgah: 'CNC-01', durum: 'Closed',   isEmri: 'İE-2', planlanan: 20,  tamamlanan: 10,  termin: '2026-09-02' },
  { tezgah: 'CNC-01', durum: 'Started',  isEmri: 'İE-3', planlanan: 50,  tamamlanan: 40,  termin: '2026-09-09' },
  { tezgah: 'TORNA',  durum: 'Started',  isEmri: 'İE-4', planlanan: 200, tamamlanan: 180, termin: '2026-09-01' },
  { tezgah: 'TORNA',  durum: 'Planned',  isEmri: 'İE-5', planlanan: 80,  tamamlanan: 0,   termin: null },
  { tezgah: null,     durum: 'Planned',  isEmri: 'İE-6', planlanan: null, tamamlanan: null, termin: '2026-09-03' },
  { tezgah: 'çelik',  durum: 'Closed',   isEmri: 'İE-7', planlanan: 10,  tamamlanan: 10,  termin: '2026-08-30' },
]
const gorunum: Gorunum = {
  kolonlar: [
    { alan: 'isEmri', gorunur: true },
    { alan: 'tezgah', gorunur: true },
    { alan: 'durum', gorunur: true },
    { alan: 'planlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
    { alan: 'tamamlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
    { alan: 'verim', gorunur: true, toplam: 'ortalama', bicim: '%0,0' },
    { alan: 'termin', gorunur: true, bicim: 'gg.aa.yyyy' },
  ],
  gruplar: ['tezgah', 'durum'],
  siralama: { alan: 'planlanan', yon: -1 },
  filtreler: {},
  grafik: { grupla: 'tezgah', deger: 'planlanan', fn: 'topla' },
  hesaplananAlanlar: [{ ad: 'verim', ifade: 'yuvarla({tamamlanan} / {planlanan} * 100, 1)', bicim: '%0,0' }],
}

console.log('— oran bileşenleri —')
test('{a}/{b}*100', JSON.stringify(oranBilesenleri('{tamamlanan} / {planlanan} * 100')) === '{"pay":"tamamlanan","payda":"planlanan","carpan":100}')
test('yuvarla sarmalı', oranBilesenleri('yuvarla({a} / {b} * 100, 1)')?.pay === 'a')
test('{a}/{b} çarpansız → 1', oranBilesenleri('{a}/{b}')?.carpan === 1)
test('oran değil → null', oranBilesenleri('{a} + {b}') === null && oranBilesenleri('{a} / 2') === null)

console.log('— 2 seviye grup + oran ortalaması —')
const s = gorunumUygula(veri, gorunum)
test('satır sayısı korunur', s.kpi.satirSayisi === 7 && s.satirlar.length === 7)
test('kolon tipleri', s.kolonTipleri.planlanan === 'sayi' && s.kolonTipleri.termin === 'tarih' && s.kolonTipleri.tezgah === 'metin', s.kolonTipleri)
test('1. seviye: tr-TR sıra, null sona', s.gruplar.map((g) => g.etiket).join(',') === 'CNC-01,çelik,TORNA,(boş)', s.gruplar.map((g) => g.etiket))
const cnc = s.gruplar[0]
test('CNC-01 satır sayısı 3, alt grup 2 (Closed, Started)', cnc.satirSayisi === 3 && cnc.altGruplar.map((g) => g.etiket).join(',') === 'Closed,Started', cnc.altGruplar.map((g) => g.etiket))
test('CNC-01 Σplanlanan=170 Σtamamlanan=150', cnc.toplamlar.planlanan === 170 && cnc.toplamlar.tamamlanan === 150, cnc.toplamlar)
// verim ortalaması: basit ort = (100+50+80)/3 = 76.7 → YANLIŞ; doğru = 150/170*100 = 88.2
test('CNC-01 verim = Σtamamlanan/Σplanlanan (88,2), satır ortalaması (76,7) DEĞİL', Math.abs((cnc.toplamlar.verim ?? 0) - 88.235) < 0.01, cnc.toplamlar.verim)
const closed = cnc.altGruplar[0]
test('CNC-01›Closed verim = 110/120 = 91,7', Math.abs((closed.toplamlar.verim ?? 0) - 91.667) < 0.01, closed.toplamlar.verim)
test('yaprak grupta satırlar sıralı (planlanan azalan)', closed.satirlar.map((r) => r.isEmri).join(',') === 'İE-1,İE-2')
test('genel toplam Σplanlanan=460, verim=340/460=73,9', s.genelToplam.planlanan === 460 && Math.abs((s.genelToplam.verim ?? 0) - 73.913) < 0.01, s.genelToplam)
test('null planlanan satırı toplamı bozmaz', s.genelToplam.tamamlanan === 340)
test('grafik: tezgah bazında Σplanlanan', JSON.stringify(s.grafikVerisi) === JSON.stringify([{ etiket: 'CNC-01', deger: 170 }, { etiket: 'çelik', deger: 10 }, { etiket: 'TORNA', deger: 280 }, { etiket: '(boş)', deger: 0 }]), s.grafikVerisi)
test('KPI kartları: planlanan, tamamlanan, verim', s.kpi.kartlar.map((k) => `${k.alan}:${k.fn}`).join(',') === 'planlanan:topla,tamamlanan:topla,verim:ortalama')

console.log('— sıralama —')
const sirali = gorunumUygula(veri, { ...gorunum, gruplar: [], siralama: { alan: 'termin', yon: 1 } })
test('tarih artan, null sona', sirali.satirlar.map((r) => r.isEmri).join(',') === 'İE-7,İE-4,İE-2,İE-6,İE-1,İE-3,İE-5', sirali.satirlar.map((r) => r.termin))
const metinSira = gorunumUygula(veri, { ...gorunum, gruplar: [], siralama: { alan: 'tezgah', yon: -1 } })
test('metin azalan (tr-TR): TORNA, çelik, CNC-01…, null sona', metinSira.satirlar.map((r) => r.tezgah).filter((v, i, a) => a.indexOf(v) === i).join(',') === 'TORNA,çelik,CNC-01,', metinSira.satirlar.map((r) => r.tezgah))
test('kiyasla null ↔ null = 0', kiyasla(null, undefined, 'sayi') === 0)

console.log('— filtre —')
const f1 = gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { verim: '< 90' } })
test('verim < 90 → İE-2(50), İE-3(80), İE-5(0)', f1.satirlar.map((r) => r.isEmri).sort().join(',') === 'İE-2,İE-3,İE-5', f1.satirlar.map((r) => [r.isEmri, r.verim]))
const f2 = gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { planlanan: '>= 100', durum: 'clos' } })
test('>= 100 AND durum içerir "clos" → İE-1', f2.satirlar.map((r) => r.isEmri).join(',') === 'İE-1')
test('sayı "= 80"', gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { planlanan: '= 80' } }).satirlar.length === 1)
test('çıplak sayı "80" = eşit', gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { planlanan: '80' } }).satirlar.length === 1)
test('tr-TR büyük/küçük: "ÇEL" tezgah çelik', gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { tezgah: 'ÇEL' } }).satirlar.length === 1)
test('tarih filtresi biçimlenmiş metinde: "09.2026"', gorunumUygula(veri, { ...gorunum, gruplar: [], filtreler: { termin: '09.2026' } }).satirlar.length === 5)
test('anlaşılmayan sayı süzgeci satır düşürmez', filtreEslesir(5, 'abc', 'sayi') === true)
test('null sayı, süzgeç varsa düşer', filtreEslesir(null, '> 0', 'sayi') === false)
test('filtreli KPI satır sayısı', f1.kpi.satirSayisi === 3 && f1.kpi.toplamSatir === 7)

console.log('— boş veri / kenar —')
const bos = gorunumUygula([], gorunum)
test('boş veri: satır 0, grup boş, genel toplam topla=0 ortalama=null', bos.satirlar.length === 0 && bos.gruplar.length === 0 && bos.genelToplam.planlanan === 0 && bos.genelToplam.verim === null, bos.genelToplam)
test('boş veri: grafik boş, kolon tipleri metin', bos.grafikVerisi.length === 0 && bos.kolonTipleri.planlanan === 'sayi' /* bicim'den */)
const tekNull = gorunumUygula([{ a: null, b: null }], { kolonlar: [{ alan: 'a', gorunur: true, toplam: 'ortalama' }, { alan: 'b', gorunur: true, toplam: 'say' }], gruplar: ['a'], filtreler: {} })
test('tümü null: ortalama null, say 1, grup etiketi (boş)', tekNull.genelToplam.a === null && tekNull.genelToplam.b === 1 && tekNull.gruplar[0].etiket === '(boş)')
test('3. grup seviyesi kırpılır (≤2)', gorunumUygula(veri, { ...gorunum, gruplar: ['tezgah', 'durum', 'isEmri'] }).gruplar[0].altGruplar[0].altGruplar.length === 0)
test('toplamHesapla enkucuk/enbuyuk', toplamHesapla('enkucuk', 'planlanan', veri) === 10 && toplamHesapla('enbuyuk', 'planlanan', veri) === 200)
test('Prisma Decimal benzeri (toNumber)', toplamHesapla('topla', 'x', [{ x: { toNumber: () => 2.5 } }, { x: '1,5' }]) === 4)

console.log(`\nSonuç: ${ok} başarılı, ${hata} hatalı`)
process.exitCode = hata ? 1 : 0
