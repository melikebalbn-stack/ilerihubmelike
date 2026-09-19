/**
 * Rapor render motoru — deneme betiği (DB/IFS yok, uydurma veri).
 *   npx tsx scripts/rapor-render-test.ts   → /tmp/rapor-ornek.html
 */
import { writeFileSync, statSync } from 'fs'
import { raporRender } from '../src/lib/rapor/render'
import type { SablonIcerik } from '../src/lib/rapor/tipler'

const sablon: SablonIcerik = {
  baslik: 'Tezgah Bazında Üretim Verimi',
  altBaslik: 'IPRO üretim kayıtları × IFS iş emri planı',
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Başlangıç', zorunlu: true },
    { ad: 'bitis', tip: 'tarih', etiket: 'Bitiş', zorunlu: true },
    { ad: 'esik', tip: 'sayi', etiket: 'Kritik eşik (%)' },
  ],
  hesaplananAlanlar: [
    { ad: 'verim', ifade: 'yuvarla({uretilen} / {planlanan} * 100, 1)', bicim: '%0,0' },
    { ad: 'durum', ifade: "iif({verim} == bos, '', iif({verim} < {p.esik}, 'KRİTİK', iif({verim} < 95, 'İzle', 'Normal')))" },
  ],
  gruplar: [
    { alan: 'tezgah', baslik: "birlestir('Tezgah ', {tezgah}, ' — ', {tezgahAd})" },
    { alan: 'vardiya', baslik: "birlestir({vardiya}, '. vardiya')" },
  ],
  kolonlar: [
    { alan: 'isEmri', baslik: 'İş Emri', genislik: 16 },
    { alan: 'parca', baslik: 'Parça', genislik: 20 },
    { alan: 'tarih', baslik: 'Tarih', bicim: 'gg.aa.yyyy', genislik: 14 },
    { alan: 'planlanan', baslik: 'Planlanan', bicim: '#.##0', altToplam: 'topla' },
    { alan: 'uretilen', baslik: 'Üretilen', bicim: '#.##0', altToplam: 'topla', kosulluBicim: [{ kosul: '{uretilen} > {planlanan}', renk: 'iyi', kalin: true }] },
    {
      alan: 'verim', baslik: 'Verim', altToplam: 'orani', oraniPay: 'uretilen', oraniPayda: 'planlanan',
      kosulluBicim: [
        { kosul: '{verim} < {p.esik}', renk: 'kritik', kalin: true },
        { kosul: '{verim} >= {p.esik} && {verim} < 95', renk: 'uyari' },
      ],
    },
  ],
  sayfaAlti: { sol: 'ILERIHub · Rapor Tasarımcısı', sag: 'Gizli — şirket içi <test>' },
}

// 20 uydurma satır: 3 tezgah × vardiya
const tezgahlar = [['MM63', 'CNC Torna'], ['ILR-00207', 'Dik İşleme'], ['PRS-04', 'Pres 400t']]
const parcalar = ['21970032', '28150023', 'DPH0001', '<script>alert(1)</script>']
const satirlar = Array.from({ length: 20 }, (_, i) => {
  const [tezgah, tezgahAd] = tezgahlar[i % 3]
  const planlanan = 50 + (i * 37) % 200
  const uretilen = i === 7 ? null : Math.round(planlanan * (0.6 + ((i * 13) % 50) / 100))
  return {
    tezgah, tezgahAd, vardiya: (Math.floor(i / 3) % 3) + 1,
    isEmri: `M0022798${String(i).padStart(2, '0')}`, parca: parcalar[i % 4],
    tarih: new Date(2026, 8, 1 + (i % 18)), planlanan, uretilen,
  }
})

const sonuc = raporRender(sablon, satirlar, {
  parametreler: { baslangic: new Date(2026, 8, 1), bitis: new Date(2026, 8, 18), esik: 80 },
  calistiran: 'Melih Dilben', raporKodu: 'URT-VERIM-01',
})
const yol = '/tmp/rapor-ornek.html'
writeFileSync(yol, sonuc.html, 'utf8')
console.log(`Satır: ${sonuc.satirSayisi}  süre: ${sonuc.sureMs} ms  dosya: ${yol} (${statSync(yol).size} bayt)`)

// Kaba doğrulamalar
const h = sonuc.html
const kontrol: [string, boolean][] = [
  ['XSS escape (script etiketi yok)', !h.includes('<script>') && h.includes('&lt;script&gt;')],
  ['sayfa altı escape', h.includes('şirket içi &lt;test&gt;')],
  ['2 seviye grup', (h.match(/class="grup grup-0/g) ?? []).length === 3 && (h.match(/class="grup grup-1/g) ?? []).length === 9],
  ['alt toplam + genel toplam', h.includes('alt-toplam-1') && h.includes('alt-toplam-0') && h.includes('genel-toplam')],
  ['koşullu biçim sınıfları', h.includes('r-kritik') && h.includes('r-uyari') && h.includes('r-iyi')],
  ['tr-TR yüzde biçimi', /%\d+,\d/.test(h)],
  ['tarih gg.aa.yyyy', h.includes('01.09.2026')],
  ['null hücre boş', h.includes('<td class="h-sag"></td>')],
  ['print CSS', h.includes('@page{size:A4 portrait') && h.includes('display:table-header-group') && h.includes('break-inside:avoid')],
  ['utf-8 meta', h.includes('<meta charset="utf-8">')],
]
let hatali = 0
for (const [ad, ok] of kontrol) { if (!ok) hatali++; console.log(`${ok ? '✓' : '✗'} ${ad}`) }
// Grup sınırı
try { raporRender({ ...sablon, gruplar: [{ alan: 'a' }, { alan: 'b' }, { alan: 'c' }, { alan: 'd' }] }, satirlar); console.log('✗ 4 grup hata vermedi'); hatali++ }
catch (e) { console.log(`✓ 4 grup → ${(e as Error).message}`) }
// 10.000+ uyarısı
const buyuk = raporRender({ ...sablon, gruplar: [] }, Array.from({ length: 10_001 }, (_, i) => satirlar[i % 20]))
console.log(`${buyuk.html.includes('uyari-satir') ? '✓' : '✗'} 10.001 satır uyarısı (${buyuk.sureMs} ms, ${(buyuk.html.length / 1024).toFixed(0)} KB)`)
process.exitCode = hatali ? 1 : 0
