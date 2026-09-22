/**
 * Tuval (serbest yerleşim) örneği: is_emri_liste veri setiyle 'URT-020' Hazır Rapor şablonu.
 *   npx tsx scripts/rapor-ornek-tuval.ts
 * Upsert (kod unique) — tekrar koşumda günceller. Yalnız DB'ye yazar.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import type { SablonIcerik, TuvalTasarim } from '../src/lib/rapor/tipler'
import type { Prisma } from '../src/generated/prisma'

const KOD = 'URT-020'
const VERI_SETI = 'is_emri_liste'

const tuval: TuvalTasarim = {
  sayfa: { boyut: 'A4', yon: 'dikey', kenar: [15, 15, 15, 15] },
  bantlar: [
    { id: 'rb', yukseklik: 74 }, { id: 'sb', yukseklik: 28 }, { id: 'gb', yukseklik: 26 },
    { id: 'dt', yukseklik: 22 }, { id: 'gs', yukseklik: 26 }, { id: 'rs', yukseklik: 120 }, { id: 'sa', yukseklik: 24 },
  ],
  grup: { alan: 'durum' },
  ogeler: [
    { id: 'o1', bant: 'rb', tip: 'gorsel', kaynak: 'logo', x: 0, y: 10, w: 88, h: 40 },
    { id: 'o2', bant: 'rb', tip: 'metin', metin: 'İş Emri Üretim Föyü', x: 100, y: 10, w: 380, h: 24, size: 17, kalin: true },
    { id: 'o3', bant: 'rb', tip: 'metin', metin: 'Termin ≥ {p.baslangic} · Site: {p.contract}', x: 100, y: 40, w: 380, h: 16, size: 10.5 },
    { id: 'o4', bant: 'rb', tip: 'metin', metin: '{bugun}', x: 490, y: 10, w: 150, h: 16, size: 10, hiza: 'sag' },
    { id: 'o5', bant: 'sb', tip: 'metin', metin: 'İş Emri', x: 0, y: 6, w: 110, h: 16, kalin: true },
    { id: 'o6', bant: 'sb', tip: 'metin', metin: 'Parça', x: 116, y: 6, w: 130, h: 16, kalin: true },
    { id: 'o7', bant: 'sb', tip: 'metin', metin: 'Tezgah', x: 250, y: 6, w: 120, h: 16, kalin: true },
    { id: 'o8', bant: 'sb', tip: 'metin', metin: 'Planlanan', x: 380, y: 6, w: 80, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o9', bant: 'sb', tip: 'metin', metin: 'Tamamlanan', x: 466, y: 6, w: 86, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o10', bant: 'sb', tip: 'metin', metin: 'Verim', x: 558, y: 6, w: 82, h: 16, kalin: true, hiza: 'sag' },
    { id: 'o11', bant: 'sb', tip: 'cizgi', x: 0, y: 25, w: 640, h: 0, kalinlik: 1.5 },
    { id: 'o12', bant: 'gb', tip: 'metin', metin: 'Durum: {grup}', x: 0, y: 5, w: 300, h: 17, kalin: true, size: 11.5 },
    { id: 'o13', bant: 'dt', tip: 'alan', alan: 'isEmri', x: 0, y: 3, w: 110, h: 16 },
    { id: 'o14', bant: 'dt', tip: 'alan', alan: 'parca', x: 116, y: 3, w: 130, h: 16 },
    { id: 'o15', bant: 'dt', tip: 'alan', alan: 'tezgah', x: 250, y: 3, w: 120, h: 16 },
    { id: 'o16', bant: 'dt', tip: 'alan', alan: 'planlanan', bicim: '#.##0', x: 380, y: 3, w: 80, h: 16, hiza: 'sag' },
    { id: 'o17', bant: 'dt', tip: 'alan', alan: 'tamamlanan', bicim: '#.##0', x: 466, y: 3, w: 86, h: 16, hiza: 'sag' },
    { id: 'o18', bant: 'dt', tip: 'alan', alan: 'verim', bicim: '%0,0', x: 558, y: 3, w: 82, h: 16, hiza: 'sag', kosulluBicim: [{ kosul: '{verim} < 90', renk: 'kritik', kalin: true }, { kosul: '{verim} >= 95', renk: 'iyi' }] },
    { id: 'o19', bant: 'gs', tip: 'metin', metin: '{grup} toplamı', x: 0, y: 5, w: 220, h: 16, kalin: true },
    { id: 'o20', bant: 'gs', tip: 'toplam', fn: 'topla', alan: 'planlanan', bicim: '#.##0', x: 380, y: 5, w: 80, h: 16, hiza: 'sag', kalin: true },
    { id: 'o21', bant: 'gs', tip: 'toplam', fn: 'topla', alan: 'tamamlanan', bicim: '#.##0', x: 466, y: 5, w: 86, h: 16, hiza: 'sag', kalin: true },
    { id: 'o22', bant: 'gs', tip: 'toplam', fn: 'orani', alan: 'verim', oraniPay: 'tamamlanan', oraniPayda: 'planlanan', bicim: '%0,0', x: 558, y: 5, w: 82, h: 16, hiza: 'sag', kalin: true },
    { id: 'o23', bant: 'rs', tip: 'metin', metin: 'Genel toplam', x: 0, y: 6, w: 200, h: 16, kalin: true },
    { id: 'o24', bant: 'rs', tip: 'toplam', fn: 'topla', alan: 'planlanan', bicim: '#.##0', x: 380, y: 6, w: 80, h: 16, hiza: 'sag', kalin: true },
    { id: 'o25', bant: 'rs', tip: 'toplam', fn: 'topla', alan: 'tamamlanan', bicim: '#.##0', x: 466, y: 6, w: 86, h: 16, hiza: 'sag', kalin: true },
    { id: 'o26', bant: 'rs', tip: 'toplam', fn: 'orani', alan: 'verim', oraniPay: 'tamamlanan', oraniPayda: 'planlanan', bicim: '%0,0', x: 558, y: 6, w: 82, h: 16, hiza: 'sag', kalin: true },
    { id: 'o27', bant: 'rs', tip: 'grafik', grafikTipi: 'sutun', grupla: 'durum', deger: 'planlanan', fn: 'topla', x: 0, y: 30, w: 640, h: 84 },
    { id: 'o28', bant: 'sa', tip: 'metin', metin: '{rapor.ad} · {calistiran}', x: 0, y: 5, w: 320, h: 15, size: 9.5 },
    { id: 'o29', bant: 'sa', tip: 'metin', metin: 'Sayfa {sayfa} / {toplamSayfa}', x: 420, y: 5, w: 220, h: 15, size: 9.5, hiza: 'sag' },
  ],
}

const icerik: SablonIcerik & { tur: 'belge' } = {
  tur: 'belge',
  baslik: 'İş Emri Üretim Föyü',
  altBaslik: 'IFS ShopOrd + IPRO tezgah',
  kategori: 'Üretim',
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Termin başlangıcı', zorunlu: true },
    { ad: 'contract', tip: 'metin', etiket: 'IFS Site', zorunlu: true },
  ],
  hesaplananAlanlar: [{ ad: 'verim', ifade: '{tamamlanan} / {planlanan} * 100', bicim: '%0,0' }],
  // Liste yerleşimi de geçerli kalsın (yerlesim='tuval' olduğu için kullanılmaz).
  kolonlar: [
    { alan: 'isEmri', baslik: 'İş Emri' }, { alan: 'parca', baslik: 'Parça' }, { alan: 'tezgah', baslik: 'Tezgah' },
    { alan: 'planlanan', baslik: 'Planlanan', bicim: '#.##0', altToplam: 'topla' },
    { alan: 'tamamlanan', baslik: 'Tamamlanan', bicim: '#.##0', altToplam: 'topla' },
    { alan: 'verim', baslik: 'Verim', bicim: '%0,0' },
  ],
  gruplar: [{ alan: 'durum' }],
  genelToplam: true,
  yerlesim: 'tuval',
  tuval,
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

async function main() {
  const veriSeti = await prisma.raporVeriSeti.findUnique({ where: { ad: VERI_SETI } })
  if (!veriSeti) throw new Error(`Veri seti yok: ${VERI_SETI} (önce scripts/rapor-ornek-etkilesimli.ts)`)
  const s = await prisma.raporSablon.upsert({
    where: { kod: KOD },
    create: { kod: KOD, ad: 'İş Emri Üretim Föyü', aciklama: 'Tuval: A4 föy, durum bazında grup, toplamlar ve grafik', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
    update: { ad: 'İş Emri Üretim Föyü', aciklama: 'Tuval: A4 föy, durum bazında grup, toplamlar ve grafik', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA' },
  })
  console.log(`Şablon: ${s.kod}  id=${s.id}  tur=belge  yerlesim=tuval  durum=${s.durum}  sürüm=${s.surum}`)
  console.log(`Tasarım: /raporlar/tasarim/${s.id}   ·   Çalıştır: /raporlar/${s.id}`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
