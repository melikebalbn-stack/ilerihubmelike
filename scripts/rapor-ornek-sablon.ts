/**
 * Rapor motoru uçtan uca deneme kaydı: veri seti 'is_emri_uretim' + şablon 'URT-001'.
 *   npx tsx scripts/rapor-ornek-sablon.ts
 * Upsert (ad / kod unique) — tekrar koşumda günceller. Yalnız DB'ye yazar, IFS'e gitmez.
 * Veri seti tanımı scripts/rapor-veri-seti-test.ts'te doğrulanan tanımın aynısı.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import type { SablonIcerik, VeriSetiTanim } from '../src/lib/rapor/tipler'
import type { Prisma } from '../src/generated/prisma'

const VERI_SETI_AD = 'is_emri_uretim'
const SABLON_KOD = 'URT-001'

const tanim: VeriSetiTanim = {
  kaynaklar: [
    {
      ad: 'isEmri', tip: 'ifs-odata', projeksiyon: 'ShopOrderHandling', entitySet: 'ShopOrds',
      select: ['OrderNo', 'ReleaseNo', 'PartNo', 'RevisedQtyDue', 'QtyComplete', 'Objstate', 'RevisedDueDate'],
      filtre: 'Contract eq {p.contract} and RevisedDueDate ge {p.baslangic}',
      top: 200,
    },
    {
      ad: 'uretim', tip: 'postgres',
      sorgu: `SELECT "ifsOrderNo" AS order_no, SUM("qtyComplete")::int AS iyi, SUM("qtyScrap")::int AS hurda, COUNT(*)::int AS kayit
              FROM ipro_production_log WHERE "ifsOrderNo" IS NOT NULL AND "createdAt" >= $1 GROUP BY "ifsOrderNo"`,
      parametreler: ['baslangic'],
    },
  ],
  birlestir: [{ sol: 'isEmri.OrderNo', sag: 'uretim.order_no', tip: 'left' }],
  alanlar: {
    isEmriNo: 'isEmri.OrderNo', parca: 'isEmri.PartNo', planlanan: 'isEmri.RevisedQtyDue', ifsTamam: 'isEmri.QtyComplete',
    durum: 'isEmri.Objstate', termin: 'isEmri.RevisedDueDate', iproIyi: 'uretim.iyi', iproHurda: 'uretim.hurda',
  },
}

const icerik: SablonIcerik = {
  baslik: 'İş Emri Üretim Durumu',
  kategori: 'Üretim',
  altBaslik: 'IFS iş emirleri (termin ≥ başlangıç) — durum bazında plan/tamamlanan',
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Başlangıç (termin)', zorunlu: true },
    { ad: 'contract', tip: 'metin', etiket: 'IFS Site (Contract)', zorunlu: true },
  ],
  hesaplananAlanlar: [{ ad: 'verim', ifade: '{ifsTamam} / {planlanan} * 100', bicim: '%0,0' }],
  gruplar: [{ alan: 'durum' }],
  kolonlar: [
    { alan: 'isEmriNo', baslik: 'İş Emri', genislik: 18 },
    { alan: 'parca', baslik: 'Parça', genislik: 22 },
    { alan: 'planlanan', baslik: 'Planlanan', bicim: '#.##0', altToplam: 'topla' },
    { alan: 'ifsTamam', baslik: 'Tamamlanan', bicim: '#.##0', altToplam: 'topla' },
    {
      alan: 'verim', baslik: 'Verim', altToplam: 'orani', oraniPay: 'ifsTamam', oraniPayda: 'planlanan',
      kosulluBicim: [
        { kosul: '{verim} < 90', renk: 'kritik', kalin: true },
        { kosul: '{verim} >= 95', renk: 'iyi' },
      ],
    },
    { alan: 'termin', baslik: 'Termin', bicim: 'gg.aa.yyyy', genislik: 14 },
  ],
  genelToplam: true,
  sayfaAlti: { sol: `${SABLON_KOD} · ILERIHub /raporlar`, sag: 'Sayfa bilgisi tarayıcı yazdırma başlığında' },
}

// Prisma Json alanı: tipli nesneyi JSON'a çevirerek InputJsonValue'ya uydur (as any yok).
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

async function main() {
  const veriSeti = await prisma.raporVeriSeti.upsert({
    where: { ad: VERI_SETI_AD },
    create: { ad: VERI_SETI_AD, aciklama: 'IFS iş emirleri ⟕ IPRO üretim toplamı (OrderNo)', tanim: json(tanim), onbellekSn: 300, aktif: true },
    update: { aciklama: 'IFS iş emirleri ⟕ IPRO üretim toplamı (OrderNo)', tanim: json(tanim), aktif: true },
  })

  const sablon = await prisma.raporSablon.upsert({
    where: { kod: SABLON_KOD },
    create: { kod: SABLON_KOD, ad: 'İş Emri Üretim Durumu', aciklama: 'Durum bazında iş emri plan/tamamlanan ve verim', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
    update: { ad: 'İş Emri Üretim Durumu', aciklama: 'Durum bazında iş emri plan/tamamlanan ve verim', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
  })

  console.log(`Veri seti: ${veriSeti.ad}  id=${veriSeti.id}`)
  console.log(`Şablon:    ${sablon.kod}  id=${sablon.id}  durum=${sablon.durum}  sürüm=${sablon.surum}`)

  // Kendi kendini doğrula: geri oku
  const geri = await prisma.raporSablon.findUniqueOrThrow({ where: { kod: SABLON_KOD }, include: { veriSeti: true } })
  const geriIcerik = geri.icerik as unknown as SablonIcerik
  const geriTanim = geri.veriSeti.tanim as unknown as VeriSetiTanim
  console.log('\nGeri okuma:')
  console.log(`  şablon → veri seti: ${geri.veriSeti.ad} (${geri.veriSetiId === veriSeti.id ? 'eşleşti' : 'EŞLEŞMEDİ'})`)
  console.log(`  kaynaklar: ${geriTanim.kaynaklar.map((k) => `${k.ad}:${k.tip}`).join(', ')}  birleştirme: ${geriTanim.birlestir.map((b) => `${b.sol} ${b.tip} ${b.sag}`).join('; ')}`)
  console.log(`  alanlar: ${Object.keys(geriTanim.alanlar).join(', ')}`)
  console.log(`  parametreler: ${geriIcerik.parametreler?.map((p) => `${p.ad}(${p.tip}${p.zorunlu ? ',zorunlu' : ''})`).join(', ')}`)
  console.log(`  hesaplanan: ${geriIcerik.hesaplananAlanlar?.map((h) => `${h.ad}=${h.ifade}`).join(', ')}`)
  console.log(`  gruplar: ${geriIcerik.gruplar?.map((g) => g.alan).join(' > ')}  kolonlar: ${geriIcerik.kolonlar.map((k) => k.alan).join(', ')}`)

  const kolonAlanlari = new Set([...Object.keys(geriTanim.alanlar), ...(geriIcerik.hesaplananAlanlar ?? []).map((h) => h.ad)])
  const tanimsiz = geriIcerik.kolonlar.map((k) => k.alan).filter((a) => !kolonAlanlari.has(a))
  console.log(tanimsiz.length ? `  ✗ veri setinde olmayan kolon alanı: ${tanimsiz.join(', ')}` : '  ✓ tüm kolon alanları veri seti/hesaplanan alanlarda mevcut')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
