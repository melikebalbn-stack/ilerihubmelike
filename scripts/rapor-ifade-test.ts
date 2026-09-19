/**
 * Rapor ifade dili — deneme betiği (DB/IFS yok, saf).
 *   npx tsx scripts/rapor-ifade-test.ts
 */
import { ifadeDerle, ifadeCalistir, ifadeDogrula, toplamHesapla, IfadeHatasi } from '../src/lib/rapor/ifade'

let basarili = 0
let hatali = 0
const esit = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b))
function test(ad: string, kaynak: string, satir: Record<string, unknown>, beklenen: unknown, parametreler?: Record<string, unknown>) {
  let sonuc: unknown
  try { sonuc = ifadeCalistir(ifadeDerle(kaynak), { satir, parametreler }) } catch (e) { sonuc = `İSTİSNA: ${(e as Error).message}` }
  const ok = esit(sonuc, beklenen)
  ok ? basarili++ : hatali++
  console.log(`${ok ? '✓' : '✗'} ${ad.padEnd(44)} ${kaynak.padEnd(46)} → ${JSON.stringify(sonuc)}${ok ? '' : `   (beklenen ${JSON.stringify(beklenen)})`}`)
}
function sozdizimiHatasi(ad: string, kaynak: string, parca: string) {
  try {
    ifadeDerle(kaynak)
    hatali++; console.log(`✗ ${ad.padEnd(44)} ${kaynak.padEnd(46)} → hata BEKLENİYORDU`)
  } catch (e) {
    const ok = e instanceof IfadeHatasi && e.message.includes(parca)
    ok ? basarili++ : hatali++
    console.log(`${ok ? '✓' : '✗'} ${ad.padEnd(44)} ${kaynak.padEnd(46)} → ${(e as Error).message}`)
  }
}

const s = { uretilen: 85, planlanan: 100, verim: 85, kod: 'MM63', ad: 'Torna', bosAlan: '', metinSayi: '42', tarih: '2026-09-01', tarih2: new Date('2026-09-19T00:00:00Z') }

console.log('— Aritmetik / öncelik —')
test('bölme yüzdesi', '{uretilen} / {planlanan} * 100', s, 85)
test('0 a bölme → null', '{uretilen} / 0', s, null)
test('null a bölme → null', '{uretilen} / {yok}', s, null)
test('öncelik', '2 + 3 * 4 == 14', s, true)
test('iç içe parantez', '((2 + 3) * (4 - 1)) % 7', s, 1)
test('tekli eksi', '-{uretilen} + 100', s, 15)
test('metin sayı karışık', '{metinSayi} * 2', s, 84)
test('yuvarla', 'yuvarla({uretilen} / 3, 2)', s, 28.33)
test('yuvarla basamaksız', 'yuvarla(2.5)', s, 3)
test('mutlak', 'mutlak(-7.5)', s, 7.5)

console.log('— Karşılaştırma / mantık —')
test('iif kritik', "iif({verim} < 90, 'KRİTİK', 'NORMAL')", s, 'KRİTİK')
test('iif normal', "iif({verim} >= 90, 'YÜKSEK', 'NORMAL')", s, 'NORMAL')
test('metin/sayı karşılaştırma', "{metinSayi} > 5", s, true)
test('metin karşılaştırma', "'abc' < 'abd'", s, true)
test('<> operatörü', "{kod} <> 'MM63'", s, false)
test('&& ||', "{verim} > 80 && ({kod} == 'X' || dogru)", s, true)
test('! ve bos', '!bosMu({kod}) && bosMu({bosAlan}) && {yok} == bos', s, true)
test('null sıralama → null', '{yok} < 5', s, null)
test('parametre', "{p.esik} <= {verim}", s, true, { esik: 80 })
test('tanımsız parametre → null', '{p.yok}', s, null)

console.log('— Metin —')
test('birlestir', "birlestir({kod}, ' · ', {ad})", s, 'MM63 · Torna')
test('buyuk tr-TR', "buyuk('ileri')", s, 'İLERİ')
test('kucuk tr-TR', "kucuk('ILERİ')", s, 'ıleri')
test('uzunluk/kirp', "uzunluk(kirp('  abc  '))", s, 3)
test('metin() ve sayi()', "metin(12.5) == '12.5' && sayi('x') == bos", s, true)
test('tek tırnak kaçışı', "'O''Neil'", s, "O'Neil")

console.log('— Tarih —')
test('yil/ay/gun ISO metin', 'yil({tarih}) * 10000 + ay({tarih}) * 100 + gun({tarih})', s, 20260901)
test('tarihFark ISO ↔ Date', 'tarihFark({tarih}, {tarih2})', s, 18)
test('tarih() dönüşümü', "tarih('2026-01-15') < {tarih2}", s, true)
test('geçersiz tarih → null', "yil('abc')", s, null)

console.log('— Tanımsız alan / hata toleransı —')
test('tanımsız alan → null', '{yokBoyleAlan}', s, null)
test('tanımsız alan aritmetik → null', '{yokBoyleAlan} + 5', s, null)
test('tanımsız alan iif', "iif({yokBoyleAlan} == bos, 'boş', 'dolu')", s, 'boş')

console.log('— Sözdizimi hataları —')
sozdizimiHatasi('kapanmamış parantez', '(2 + 3', "')' bekleniyor")
sozdizimiHatasi('bilinmeyen fonksiyon', 'foo(1)', "bilinmeyen fonksiyon 'foo'")
sozdizimiHatasi('argüman sayısı', 'iif(1, 2)', '3 argüman bekleniyor')
sozdizimiHatasi('kapanmamış metin', "'abc", 'kapanmamış')
sozdizimiHatasi('süssüz alan', 'uretilen * 2', "{uretilen}")
sozdizimiHatasi('eksik operand', '2 +', 'ifade eksik bitti')
sozdizimiHatasi('kapanmamış süslü', '{uretilen', "'}' bekleniyor")

console.log('— ifadeDogrula —')
const d1 = ifadeDogrula("iif({verim} < 90, 'K', 'N') + {yok}", ['verim', 'uretilen'])
console.log(JSON.stringify(d1))
const d2 = ifadeDogrula('2 +', ['verim'])
console.log(JSON.stringify(d2))
const dogrulaOk = d1.gecerli && d1.hata?.includes('{yok}') && d1.kullanilanAlanlar.join() === 'verim,yok' && !d2.gecerli && !!d2.hata
dogrulaOk ? basarili++ : hatali++
console.log(`${dogrulaOk ? '✓' : '✗'} ifadeDogrula uyarı/hata ayrımı`)

console.log('— Toplamlar —')
const satirlar = [{ adet: 10, ad: 'a' }, { adet: '20', ad: '' }, { adet: null, ad: 'c' }, { adet: 'x', ad: null }, { adet: 30, ad: 'e' }]
const toplamlar = {
  topla: toplamHesapla('topla', 'adet', satirlar),
  ortalama: toplamHesapla('ortalama', 'adet', satirlar),
  say: toplamHesapla('say', 'ad', satirlar),
  enbuyuk: toplamHesapla('enbuyuk', 'adet', satirlar),
  enkucuk: toplamHesapla('enkucuk', 'adet', satirlar),
  bosOrtalama: toplamHesapla('ortalama', 'yok', satirlar),
}
console.log(JSON.stringify(toplamlar))
const toplamOk = toplamlar.topla === 60 && toplamlar.ortalama === 20 && toplamlar.say === 3 && toplamlar.enbuyuk === 30 && toplamlar.enkucuk === 10 && toplamlar.bosOrtalama === null
toplamOk ? basarili++ : hatali++
console.log(`${toplamOk ? '✓' : '✗'} topla=60 ortalama=20 say=3 enbuyuk=30 enkucuk=10 boş→null`)

console.log(`\nSonuç: ${basarili} başarılı, ${hatali} hatalı`)
process.exitCode = hatali ? 1 : 0
