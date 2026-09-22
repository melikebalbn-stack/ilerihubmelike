/**
 * Etkileşimli rapor örneği: veri seti 'is_emri_liste' (IFS ShopOrd ⟕ IPRO tezgah/üretim) + şablon 'URT-010'.
 *   npx tsx scripts/rapor-ornek-etkilesimli.ts
 * Upsert (ad / kod unique) — tekrar koşumda günceller. Yalnız DB'ye yazar.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import type { EtkilesimliIcerik, VeriSetiTanim } from '../src/lib/rapor/tipler'
import type { Prisma } from '../src/generated/prisma'

const VERI_SETI_AD = 'is_emri_liste'
const SABLON_KOD = 'URT-010'

const tanim: VeriSetiTanim = {
  kaynaklar: [
    {
      ad: 'isEmri', tip: 'ifs-odata', projeksiyon: 'ShopOrderHandling', entitySet: 'ShopOrds',
      select: ['OrderNo', 'ReleaseNo', 'PartNo', 'RevisedQtyDue', 'QtyComplete', 'Objstate', 'RevisedDueDate', 'RevisedStartDate'],
      filtre: 'Contract eq {p.contract} and RevisedDueDate ge {p.baslangic}',
      top: 2000,
    },
    {
      ad: 'ipro', tip: 'postgres',
      sorgu: `SELECT p."ifsOrderNo" AS order_no, MAX(t.ad) AS tezgah, SUM(p."qtyComplete")::int AS iyi, SUM(p."qtyScrap")::int AS hurda
              FROM ipro_production_log p JOIN ipro_tezgah t ON t.id = p."tezgahId"
              WHERE p."ifsOrderNo" IS NOT NULL AND p."createdAt" >= $1 GROUP BY 1`,
      parametreler: ['baslangic'],
    },
  ],
  birlestir: [{ sol: 'isEmri.OrderNo', sag: 'ipro.order_no', tip: 'left' }],
  alanlar: {
    isEmri: 'isEmri.OrderNo', parca: 'isEmri.PartNo', tezgah: 'ipro.tezgah', durum: 'isEmri.Objstate',
    planlanan: 'isEmri.RevisedQtyDue', tamamlanan: 'isEmri.QtyComplete', termin: 'isEmri.RevisedDueDate', baslangicTarihi: 'isEmri.RevisedStartDate',
    iproIyi: 'ipro.iyi', iproHurda: 'ipro.hurda',
  },
}

const icerik: EtkilesimliIcerik = {
  tur: 'etkilesimli',
  baslik: 'İş Emri Listesi',
  altBaslik: 'IFS ShopOrd + IPRO tezgah',
  parametreler: [
    { ad: 'baslangic', tip: 'tarih', etiket: 'Termin başlangıcı', zorunlu: true },
    { ad: 'contract', tip: 'metin', etiket: 'IFS Site', zorunlu: true },
  ],
  gorunum: {
    kolonlar: [
      { alan: 'isEmri', baslik: 'İş Emri No', gorunur: true },
      { alan: 'parca', baslik: 'Parça No', gorunur: true },
      { alan: 'tezgah', baslik: 'Tezgah', gorunur: true },
      { alan: 'durum', baslik: 'Durum', gorunur: true },
      { alan: 'planlanan', baslik: 'Planlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
      { alan: 'tamamlanan', baslik: 'Tamamlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
      { alan: 'verim', baslik: 'Verim %', gorunur: true, toplam: 'ortalama', bicim: '%0,0' },
      { alan: 'termin', baslik: 'Termin', gorunur: true, bicim: 'gg.aa.yyyy' },
      { alan: 'baslangicTarihi', baslik: 'Başlangıç', gorunur: false, bicim: 'gg.aa.yyyy' },
      { alan: 'iproIyi', baslik: 'IPRO iyi', gorunur: false, toplam: 'topla', bicim: '#.##0' },
      { alan: 'iproHurda', baslik: 'IPRO hurda', gorunur: false, toplam: 'topla', bicim: '#.##0' },
    ],
    gruplar: [],
    siralama: null,
    filtreler: {},
    grafik: { grupla: 'durum', deger: 'planlanan', fn: 'topla' },
    // Oran: grup ortalaması gorunum.ts kuralıyla Σtamamlanan/Σplanlanan*100 olarak hesaplanır.
    hesaplananAlanlar: [{ ad: 'verim', ifade: '{tamamlanan} / {planlanan} * 100', bicim: '%0,0' }],
  },
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

async function main() {
  const veriSeti = await prisma.raporVeriSeti.upsert({
    where: { ad: VERI_SETI_AD },
    create: { ad: VERI_SETI_AD, aciklama: 'IFS iş emirleri ⟕ IPRO tezgah/üretim toplamı (OrderNo)', tanim: json(tanim), onbellekSn: 300, aktif: true },
    update: { aciklama: 'IFS iş emirleri ⟕ IPRO tezgah/üretim toplamı (OrderNo)', tanim: json(tanim), aktif: true },
  })
  const sablon = await prisma.raporSablon.upsert({
    where: { kod: SABLON_KOD },
    create: { kod: SABLON_KOD, ad: 'İş Emri Listesi', aciklama: 'Etkileşimli: tezgah/durum bazında grupla, verim ve toplamlar', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
    update: { ad: 'İş Emri Listesi', aciklama: 'Etkileşimli: tezgah/durum bazında grupla, verim ve toplamlar', veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'YAYINDA', izinAnahtari: null },
  })
  console.log(`Veri seti: ${veriSeti.ad}  id=${veriSeti.id}`)
  console.log(`Şablon:    ${sablon.kod}  id=${sablon.id}  tur=${(sablon.icerik as { tur?: string }).tur}  durum=${sablon.durum}  sürüm=${sablon.surum}`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
