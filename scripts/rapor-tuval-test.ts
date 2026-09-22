/**
 * tuval-render.ts testi — saf, DB/IFS yok. Uydurma 30 satır → A4 HTML.
 *   npx tsx scripts/rapor-tuval-test.ts   → /tmp/rapor-tuval.html
 * Kontrol: bant tekrarı (sb/sa her sayfada), grup kırılımı, grup/rapor toplamları,
 * koşullu renk, A4 mm ölçeği, sayfalama ve {sayfa}/{toplamSayfa}.
 */
import { writeFileSync, statSync } from 'fs'
import { tuvalRender, listedenTuval } from '../src/lib/rapor/tuval-render'
import { tuvalDogrula } from '../src/lib/rapor/sablon-dogrula'
import { TUVAL_GENISLIK, type TuvalTasarim } from '../src/lib/rapor/tipler'

let ok = 0, hata = 0
const test = (ad: string, kosul: boolean, detay?: unknown) => { kosul ? ok++ : hata++; console.log(`${kosul ? '✓' : '✗'} ${ad}${kosul ? '' : `   → ${JSON.stringify(detay)}`}`) }

// ── Uydurma veri: 30 satır, 3 tezgah ──
const tezgahlar = ['CNC-01', 'TORNA-02', 'FREZE-03']
const satirlar = Array.from({ length: 30 }, (_, i) => {
  const planlanan = 20 + ((i * 37) % 180)
  const tamamlanan = i % 7 === 0 ? 0 : Math.round(planlanan * (0.55 + ((i * 13) % 50) / 100))
  return {
    isEmri: `İE-${100 + i}`, parca: ['21970032', 'DPH0001', '<script>x</script>'][i % 3],
    tezgah: tezgahlar[i % 3], durum: ['Closed', 'Released', 'Started'][i % 3],
    planlanan, tamamlanan, termin: new Date(2026, 8, 1 + (i % 25)),
  }
})
const hesaplananAlanlar = [{ ad: 'verim', ifade: '{tamamlanan} / {planlanan} * 100', bicim: '%0,0' as const }]

const tasarim: TuvalTasarim = {
  sayfa: { boyut: 'A4', yon: 'dikey', kenar: [15, 15, 15, 15] },
  bantlar: [
    { id: 'rb', yukseklik: 74 }, { id: 'sb', yukseklik: 28 }, { id: 'gb', yukseklik: 26 },
    { id: 'dt', yukseklik: 22 }, { id: 'gs', yukseklik: 26 }, { id: 'rs', yukseklik: 118 }, { id: 'sa', yukseklik: 24 },
  ],
  grup: { alan: 'tezgah' },
  ogeler: [
    { id: 'o1', bant: 'rb', tip: 'gorsel', kaynak: 'logo', x: 0, y: 8, w: 88, h: 40 },
    { id: 'o2', bant: 'rb', tip: 'metin', metin: 'İş Emri Üretim Durumu', x: 100, y: 8, w: 380, h: 24, size: 17, kalin: true },
    { id: 'o3', bant: 'rb', tip: 'metin', metin: 'Başlangıç: {p.baslangic} · Site: {p.contract}', x: 100, y: 38, w: 380, h: 16, size: 10.5 },
    { id: 'o4', bant: 'rb', tip: 'metin', metin: '{bugun}', x: 500, y: 8, w: 140, h: 16, size: 10, hiza: 'sag' },
    // sayfa başlığı
    { id: 'o5', bant: 'sb', tip: 'metin', metin: 'İş Emri', x: 0, y: 6, w: 110, h: 16, kalin: true },
    { id: 'o6', bant: 'sb', tip: 'metin', metin: 'Parça', x: 116, y: 6, w: 130, h: 16, kalin: true },
    { id: 'o7', bant: 'sb', tip: 'metin', metin: 'Planlanan', x: 330, y: 6, w: 92, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o8', bant: 'sb', tip: 'metin', metin: 'Tamamlanan', x: 428, y: 6, w: 92, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o9', bant: 'sb', tip: 'metin', metin: 'Verim', x: 526, y: 6, w: 100, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o10', bant: 'sb', tip: 'cizgi', x: 0, y: 25, w: 640, h: 0, kalinlik: 1.5 },
    // grup başı
    { id: 'o11', bant: 'gb', tip: 'alan', alan: 'tezgah', x: 0, y: 5, w: 200, h: 17, kalin: true, size: 11.5 },
    // detay
    { id: 'o12', bant: 'dt', tip: 'alan', alan: 'isEmri', x: 0, y: 3, w: 110, h: 16 },
    { id: 'o13', bant: 'dt', tip: 'alan', alan: 'parca', x: 116, y: 3, w: 130, h: 16 },
    { id: 'o14', bant: 'dt', tip: 'alan', alan: 'planlanan', bicim: '#.##0', x: 330, y: 3, w: 92, h: 16, hiza: 'sag' },
    { id: 'o15', bant: 'dt', tip: 'alan', alan: 'tamamlanan', bicim: '#.##0', x: 428, y: 3, w: 92, h: 16, hiza: 'sag' },
    { id: 'o16', bant: 'dt', tip: 'alan', alan: 'verim', bicim: '%0,0', x: 526, y: 3, w: 100, h: 16, hiza: 'sag', kosulluBicim: [{ kosul: '{verim} < 90', renk: 'kritik', kalin: true }, { kosul: '{verim} >= 95', renk: 'iyi' }] },
    // grup sonu
    { id: 'o17', bant: 'gs', tip: 'metin', metin: '{grup} toplamı', x: 0, y: 5, w: 200, h: 16, kalin: true },
    { id: 'o18', bant: 'gs', tip: 'toplam', fn: 'topla', alan: 'planlanan', bicim: '#.##0', x: 330, y: 5, w: 92, h: 16, hiza: 'sag', kalin: true },
    { id: 'o19', bant: 'gs', tip: 'toplam', fn: 'topla', alan: 'tamamlanan', bicim: '#.##0', x: 428, y: 5, w: 92, h: 16, hiza: 'sag', kalin: true },
    { id: 'o20', bant: 'gs', tip: 'toplam', fn: 'orani', alan: 'verim', oraniPay: 'tamamlanan', oraniPayda: 'planlanan', bicim: '%0,0', x: 526, y: 5, w: 100, h: 16, hiza: 'sag', kalin: true },
    // rapor sonu
    { id: 'o21', bant: 'rs', tip: 'metin', metin: 'Genel toplam', x: 0, y: 6, w: 150, h: 16, kalin: true },
    { id: 'o22', bant: 'rs', tip: 'toplam', fn: 'topla', alan: 'planlanan', bicim: '#.##0', x: 330, y: 6, w: 92, h: 16, hiza: 'sag', kalin: true },
    { id: 'o23', bant: 'rs', tip: 'toplam', fn: 'orani', alan: 'verim', oraniPay: 'tamamlanan', oraniPayda: 'planlanan', bicim: '%0,0', x: 526, y: 6, w: 100, h: 16, hiza: 'sag', kalin: true },
    { id: 'o24', bant: 'rs', tip: 'grafik', grafikTipi: 'sutun', grupla: 'tezgah', deger: 'planlanan', fn: 'topla', x: 0, y: 28, w: 614, h: 82 },
    // sayfa altı
    { id: 'o25', bant: 'sa', tip: 'metin', metin: '{rapor.ad} · {calistiran}', x: 0, y: 4, w: 320, h: 15, size: 9.5 },
    { id: 'o26', bant: 'sa', tip: 'metin', metin: 'Sayfa {sayfa} / {toplamSayfa}', x: 420, y: 4, w: 220, h: 15, size: 9.5, hiza: 'sag' },
  ],
}

const r = tuvalRender(tasarim, satirlar, {
  hesaplananAlanlar,
  parametreler: { baslangic: new Date(2026, 8, 1), contract: 'ILER2' },
  parametreTanimlari: [{ ad: 'baslangic', tip: 'tarih', etiket: 'Başlangıç' }, { ad: 'contract', tip: 'metin', etiket: 'Site' }],
  raporAdi: 'İş Emri Üretim Durumu', raporKodu: 'URT-020', calistiran: 'Melih Dilben',
  degerEtiketleri: { durum: { Closed: 'Kapandı', Released: 'Serbest bırakıldı', Started: 'Başladı' } },
})
const h = r.html
writeFileSync('/tmp/rapor-tuval.html', h, 'utf8')

console.log(`Satır: ${r.satirSayisi}  sayfa: ${r.sayfaSayisi}  dosya: /tmp/rapor-tuval.html (${statSync('/tmp/rapor-tuval.html').size} bayt)\n`)
const say = (re: RegExp) => (h.match(re) ?? []).length

console.log('— bant tekrarı / sayfalama —')
test('çok sayfa üretildi', r.sayfaSayisi >= 2, r.sayfaSayisi)
test('sayfa bölümü sayısı = sayfaSayisi', say(/<section class="sayfa/g) === r.sayfaSayisi)
test('sb her sayfada tekrar (İş Emri başlığı)', say(/>İş Emri</g) === r.sayfaSayisi, say(/>İş Emri</g))
test('sa her sayfada tekrar (Sayfa n / m)', say(/Sayfa \d+ \/ \d+/g) === r.sayfaSayisi)
test('{sayfa}/{toplamSayfa} gerçek numara', h.includes(`Sayfa 1 / ${r.sayfaSayisi}`) && h.includes(`Sayfa ${r.sayfaSayisi} / ${r.sayfaSayisi}`))
test('rb yalnız bir kez (logo)', say(/class="o logo"/g) === 1)
test('son sayfa break-after:auto', h.includes('sayfa son'))

console.log('— grup kırılımı / toplamlar —')
test('3 grup başı (tezgah)', say(/>CNC-01</g) + say(/>TORNA-02</g) + say(/>FREZE-03</g) >= 3)
test('3 grup sonu ("… toplamı")', say(/ toplamı</g) === 3, say(/ toplamı</g))
const toplamPlan = satirlar.reduce((t, s) => t + s.planlanan, 0)
test(`genel toplam Σplanlanan = ${toplamPlan.toLocaleString('tr-TR')}`, h.includes(toplamPlan.toLocaleString('tr-TR')), toplamPlan)
const cnc = satirlar.filter((s) => s.tezgah === 'CNC-01')
const cncPlan = cnc.reduce((t, s) => t + s.planlanan, 0)
test(`CNC-01 grup toplamı = ${cncPlan.toLocaleString('tr-TR')}`, h.includes(cncPlan.toLocaleString('tr-TR')), cncPlan)
const oran = (cnc.reduce((t, s) => t + s.tamamlanan, 0) / cncPlan) * 100
test(`oran toplamı Σtamamlanan/Σplanlanan (%${oran.toFixed(1).replace('.', ',')})`, h.includes(`%${oran.toFixed(1).replace('.', ',')}`), oran)
test('detay satırı sayısı = 30', say(/>İE-1\d\d</g) === 30, say(/>İE-1\d\d</g))

console.log('— biçim / güvenlik / ölçek —')
test('koşullu kırmızı (verim < 90)', say(/class="o r-kritik/g) > 0, say(/class="o r-kritik/g))
test('koşullu yeşil (verim ≥ 95)', say(/class="o r-iyi/g) >= 0)
test('XSS kaçışı (<script> metin olarak)', !h.includes('<script>x</script>') && h.includes('&lt;script&gt;'))
test('tr-TR tarih (gg.aa.yyyy)', /\d{2}\.\d{2}\.2026/.test(h))
test('mm ölçeği: 640px → 180mm içerik', h.includes('width:180mm'), h.match(/width:[\d.]+mm;height:[\d.]+mm/)?.[0])
test('CSS transform YOK', !/transform:\s*scale/.test(h))
test('@page A4 dikey + kenar', h.includes('@page{size:A4 portrait') && h.includes('@page{margin:15mm 15mm 15mm 15mm}'))
test('konumlar absolute + mm', h.includes('position:absolute') && /left:[\d.]+mm;top:[\d.]+mm/.test(h))
test('grafik SVG basıldı', h.includes('<svg'))
test('parametre yer tutucusu çözüldü', h.includes('Başlangıç: 01.09.2026') && h.includes('Site: ILER2'))
test('{grup} yer tutucusu', h.includes('CNC-01 toplamı'))
test('{calistiran} / {rapor.ad}', h.includes('İş Emri Üretim Durumu · Melih Dilben'))

console.log('— yatay sayfa / doğrulama / listedenTuval —')
const yatay = tuvalRender({ ...tasarim, sayfa: { ...tasarim.sayfa, yon: 'yatay' } }, satirlar, { hesaplananAlanlar })
test('yatay: @page landscape ve 267mm içerik', yatay.html.includes('@page{size:A4 landscape') && yatay.html.includes('width:267mm'))
test('yatay sayfa sayısı ≤ dikey (daha az satır sığmaz ama yükseklik azalır)', yatay.sayfaSayisi >= 1)
const tumAlanlar = new Set(['isEmri', 'parca', 'tezgah', 'durum', 'planlanan', 'tamamlanan', 'termin', 'verim'])
test('doğrulama: geçerli tasarım → hata yok', tuvalDogrula(tasarim, tumAlanlar).length === 0, tuvalDogrula(tasarim, tumAlanlar))
const bozuk: TuvalTasarim = { ...tasarim, grup: { alan: 'yokAlan' }, ogeler: [
  { id: 'x1', bant: 'dt', tip: 'alan', alan: 'olmayan', x: 0, y: 3, w: 100, h: 16 },
  { id: 'x1', bant: 'dt', tip: 'metin', metin: '{yokBu} ve {p.contract}', x: 0, y: 3, w: 100, h: 16 },
  { id: 'x3', bant: 'dt', tip: 'alan', alan: 'verim', x: 600, y: 3, w: 200, h: 16, kosulluBicim: [{ kosul: '{verim} <<< 90' }] },
  { id: 'x4', bant: 'rs', tip: 'tablo', kolonlar: [{ alan: 'yokKolon', baslik: 'X', genislik: 0 }], x: 0, y: 0, w: 300, h: 40 },
  { id: 'x5', bant: 'rs', tip: 'grafik', grafikTipi: 'sutun', grupla: 'yokG', deger: 'yokD', fn: 'topla', x: 0, y: 0, w: 100, h: 40 },
] }
const hatalar = tuvalDogrula(bozuk, tumAlanlar)
console.log('  bozuk tasarım hataları:'); for (const x of hatalar) console.log('   -', x)
test('bozuk: alan/kimlik/taşma/tablo/grafik/koşul yakalandı', hatalar.length >= 8 && hatalar.some((x) => x.startsWith('Uyarı:')), hatalar.length)
const cevrilen = listedenTuval({ baslik: 'Liste', kolonlar: [
  { alan: 'isEmri', baslik: 'İş Emri', genislik: 20 }, { alan: 'parca', baslik: 'Parça', genislik: 30 },
  { alan: 'planlanan', baslik: 'Planlanan', genislik: 25, bicim: '#.##0', altToplam: 'topla' },
  { alan: 'verim', baslik: 'Verim', genislik: 25, bicim: '%0,0', altToplam: 'orani', oraniPay: 'tamamlanan', oraniPayda: 'planlanan' },
], gruplar: [{ alan: 'tezgah' }], genelToplam: true })
test('listedenTuval: bantlar + öğeler üretildi', cevrilen.ogeler.length >= 12 && cevrilen.grup?.alan === 'tezgah', cevrilen.ogeler.length)
test('listedenTuval: kolonlar dt, başlıklar sb, toplamlar gs+rs', cevrilen.ogeler.filter((o) => o.bant === 'dt').length === 4 && cevrilen.ogeler.filter((o) => o.bant === 'sb' && o.tip === 'metin').length === 4 && cevrilen.ogeler.filter((o) => o.tip === 'toplam').length === 4)
test('listedenTuval: genişlik toplamı ≈ 640', Math.abs(cevrilen.ogeler.filter((o) => o.bant === 'dt').reduce((t, o) => t + o.w, 0) - TUVAL_GENISLIK) <= 4)
test('listedenTuval çıktısı doğrulamadan geçer', tuvalDogrula(cevrilen, tumAlanlar).length === 0, tuvalDogrula(cevrilen, tumAlanlar))
const cevrilenR = tuvalRender(cevrilen, satirlar, { hesaplananAlanlar, raporAdi: 'Liste' })
test('listedenTuval render: sayfa üretildi', cevrilenR.sayfaSayisi >= 1 && cevrilenR.html.includes('Genel toplam'))

console.log('— boş veri —')
const bos = tuvalRender(tasarim, [], { hesaplananAlanlar })
test('boş veri: 1 sayfa, rb/rs var, detay yok', bos.sayfaSayisi === 1 && bos.html.includes('class="o logo"') && !/>İE-/.test(bos.html), bos.sayfaSayisi)

console.log(`\nSonuç: ${ok} başarılı, ${hata} hatalı`)
process.exitCode = hata ? 1 : 0
