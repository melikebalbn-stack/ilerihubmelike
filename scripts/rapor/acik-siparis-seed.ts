/**
 * Açık Sipariş raporu — Syteline `TR_Acik_Siparis1_SL9` prosedürünün IFS karşılığı.
 *   npx tsx scripts/rapor/acik-siparis-seed.ts
 *
 * SUNUCUDA çalışır: EntitySet adlarını IFS $metadata'sından ÇÖZER (ad türetilemez,
 * bkz. ifs-metadata.ts · entitySetleri). Bulut oturumunda IFS'e erişim yok, o yüzden
 * setler koda sabit yazılmadı.
 *
 * Kaynak prosedürün yaptığı iş:
 *   coitem ⋈ co ⋈ custaddr ⋈ itemwhse, qty_ordered − qty_shipped > 0, due_date aralığı,
 *   stat in ('O','P'); artı imleçle malzeme bazında stoğun satırlara sırayla düşülmesi.
 * Bu seed ilk ikisini karşılar; "KalanStokMiktar" (yürüyen bakiye) satır-satır hesap
 * olduğundan görünüm motorunda karşılığı yok — ayrı iş, aşağıdaki nota bakın.
 *
 * Upsert: ad/kod unique, tekrar koşumda günceller.
 */
import 'dotenv/config'
import { prisma } from '../../src/lib/prisma'
import { entitySetleri } from '../../src/lib/rapor/ifs-metadata'
import type { EtkilesimliIcerik, VeriSetiTanim } from '../../src/lib/rapor/tipler'
import type { Prisma } from '../../src/generated/prisma'

const VERI_SETI_AD = 'acik_siparis'
const SABLON_KOD = 'SAT-001'

/** EntityType → hangi projeksiyonda aranacak. İlk eşleşen kullanılır. */
const ARANACAK: { entity: string; projeksiyonlar: string[] }[] = [
  { entity: 'CustomerOrderLine', projeksiyonlar: ['CustomerOrderHandling', 'CustomerOrdersHandling'] },
  { entity: 'CustomerOrder', projeksiyonlar: ['CustomerOrderHandling', 'CustomerOrdersHandling'] },
  { entity: 'InventoryPart', projeksiyonlar: ['InventoryPartHandling'] },
]

interface Coz { entity: string; projeksiyon: string; entitySet: string }

async function entitySetCoz(): Promise<Record<string, Coz>> {
  const out: Record<string, Coz> = {}
  for (const { entity, projeksiyonlar } of ARANACAK) {
    for (const p of projeksiyonlar) {
      let esleme: Map<string, string[]>
      try {
        esleme = await entitySetleri(p)
      } catch (e) {
        // fetch'in "fetch failed" mesajı tek başına hiçbir şey anlatmıyor; asıl sebep
        // cause zincirinde (ENOTFOUND / ECONNREFUSED / sertifika / token ucu).
        const hata = e as Error & { cause?: unknown }
        const sebep = hata.cause instanceof Error
          ? ` · sebep: ${hata.cause.message}${(hata.cause as { code?: string }).code ? ` (${(hata.cause as { code?: string }).code})` : ''}`
          : hata.cause ? ` · sebep: ${String(hata.cause)}` : ''
        console.warn(`  ${p}: $metadata okunamadı — ${hata.message}${sebep}`)
        continue
      }
      const setler = esleme.get(entity)
      if (setler?.length) {
        // Birden fazla set varsa en kısası ana koleksiyondur (CustomerOrderLineSet vs
        // CustomerOrderLineHistorySet gibi türevler daha uzundur).
        const set = [...setler].sort((a, b) => a.length - b.length)[0]
        out[entity] = { entity, projeksiyon: p, entitySet: set }
        console.log(`  ${entity} → ${p} / ${set}${setler.length > 1 ? `  (adaylar: ${setler.join(', ')})` : ''}`)
        break
      }
    }
    if (!out[entity]) throw new Error(`${entity} için EntitySet bulunamadı (bakılan: ${projeksiyonlar.join(', ')})`)
  }
  return out
}

function tanimKur(c: Record<string, Coz>): VeriSetiTanim {
  return {
    kaynaklar: [
      {
        ad: 'satir',
        tip: 'ifs-odata',
        projeksiyon: c.CustomerOrderLine.projeksiyon,
        entitySet: c.CustomerOrderLine.entitySet,
        select: [
          'OrderNo', 'LineNo', 'RelNo', 'LineItemNo', 'Contract',
          'CatalogNo', 'PartNo', 'CatalogDesc', 'CustomerPartNo', 'CustomersPONo',
          'RevisedQtyDue', 'QtyShipped', 'QtyToShip', 'QtyAssigned',
          'PlannedDueDate', 'PromisedDeliveryDate', 'Objstate', 'ShipAddrNo', 'CustomerNo',
        ],
        // qty_ordered − qty_shipped > 0  →  QtyToShip gt 0 (IFS bu farkı kendi tutuyor).
        // due_date between @Basl,@Bitis  →  PlannedDueDate aralığı.
        filtre: 'Contract eq {p.contract} and QtyToShip gt 0 and PlannedDueDate ge {p.baslangic} and PlannedDueDate le {p.bitis}',
        orderby: 'PlannedDueDate',
        top: 5000,
      },
      {
        ad: 'siparis',
        tip: 'ifs-odata',
        projeksiyon: c.CustomerOrder.projeksiyon,
        entitySet: c.CustomerOrder.entitySet,
        select: ['OrderNo', 'CustomerName', 'CustomerNo', 'DateEntered', 'CustomerPoNo'],
        filtre: 'Contract eq {p.contract}',
        top: 5000,
      },
      {
        ad: 'stok',
        tip: 'ifs-odata',
        projeksiyon: c.InventoryPart.projeksiyon,
        entitySet: c.InventoryPart.entitySet,
        select: ['Contract', 'PartNo', 'OnHandQty', 'Description'],
        filtre: 'Contract eq {p.contract}',
        top: 5000,
      },
    ],
    birlestir: [
      { sol: 'satir.OrderNo', sag: 'siparis.OrderNo', tip: 'left' },
      // Stok eşleşmesi CatalogNo üzerinden: satırın PartNo alanı IFS'te boş kalabiliyor
      // (08.10.2026 ölçümü: Stok kolonu boş geliyordu), satış kalemi CatalogNo'da duruyor.
      // Site ayrımı gerekmiyor — stok kaynağı zaten aynı Contract'a süzülü.
      { sol: 'satir.CatalogNo', sag: 'stok.PartNo', tip: 'left' },
    ],
    alanlar: {
      siparisNo: 'satir.OrderNo',
      satirNo: 'satir.LineNo',
      sevkNo: 'satir.RelNo',
      kalemNo: 'satir.LineItemNo',
      firmaAdi: 'siparis.CustomerName',
      musteriNo: 'satir.CustomerNo',
      sevkAdresi: 'satir.ShipAddrNo',
      stokKodu: 'satir.CatalogNo',
      stokAdi: 'satir.CatalogDesc',
      musteriMalzemeNo: 'satir.CustomerPartNo',
      musteriSiparisNo: 'satir.CustomersPONo',
      siparisTarihi: 'siparis.DateEntered',
      sevkTarihi: 'satir.PlannedDueDate',
      sozVerilenTarih: 'satir.PromisedDeliveryDate',
      siparisMiktari: 'satir.RevisedQtyDue',
      sevkMiktari: 'satir.QtyShipped',
      netSiparis: 'satir.QtyToShip',
      rezerveMiktar: 'satir.QtyAssigned',
      durum: 'satir.Objstate',
      stokMiktari: 'stok.OnHandQty',
      site: 'satir.Contract',

      // ── Syteline özel alanları: IFS'te CF henüz açılmadı (07.10.2026 katalog ölçümü) ──
      // Kaynak satırda bu anahtar yoksa veri-seti.ts · alanlariEsle null döndürür, hata
      // VERMEZ → kolon boş görünür. $select'e EKLENMEDİ: olmayan bir alanı $select'e
      // yazmak IFS'ten 400 döndürür, boş değil.
      // CF'ler açılınca yapılacak tek iş: adları ilgili kaynağın select dizisine eklemek.
      siparisTipi: 'siparis.Cf_SiparisTipi', // Syteline co.uf_SiparisTipi
      gercekTarih: 'satir.Cf_GercekTarih', // Syteline coitem.Uf_GercekTarih
      isMerkezi: 'stok.Cf_IsMerkezi', // Syteline TR_IM.wc (malzeme → iş merkezi tablosu)
    },
  }
}

const icerik: EtkilesimliIcerik = {
  tur: 'etkilesimli',
  baslik: 'Açık Sipariş Listesi',
  kategori: 'Satınalma',
  altBaslik: 'Sevk tarihi aralığındaki açık müşteri sipariş satırları',
  teknikAciklama:
    'Syteline TR_Acik_Siparis1_SL9 karşılığı. IFS: CustomerOrderLine ⟕ CustomerOrder ⟕ InventoryPart. ' +
    'Açıklık ölçütü QtyToShip > 0 (Syteline qty_ordered − qty_shipped > 0).',
  parametreler: [
    { ad: 'contract', tip: 'metin', etiket: 'IFS Site', zorunlu: true },
    { ad: 'baslangic', tip: 'tarih', etiket: 'Sevk tarihi (başlangıç)', zorunlu: true },
    { ad: 'bitis', tip: 'tarih', etiket: 'Sevk tarihi (bitiş)', zorunlu: true },
  ],
  gorunum: {
    kolonlar: [
      { alan: 'firmaAdi', baslik: 'Firma', gorunur: true },
      { alan: 'siparisNo', baslik: 'Sipariş No', gorunur: true },
      { alan: 'satirNo', baslik: 'Satır', gorunur: true },
      { alan: 'stokKodu', baslik: 'Stok Kodu', gorunur: true },
      { alan: 'stokAdi', baslik: 'Stok Adı', gorunur: true },
      { alan: 'durum', baslik: 'Durum', gorunur: true },
      { alan: 'siparisMiktari', baslik: 'Sipariş Mik.', gorunur: true, toplam: 'topla', bicim: '#.##0,00' },
      { alan: 'sevkMiktari', baslik: 'Sevk Mik.', gorunur: true, toplam: 'topla', bicim: '#.##0,00' },
      { alan: 'netSiparis', baslik: 'Net Sipariş', gorunur: true, toplam: 'topla', bicim: '#.##0,00' },
      { alan: 'stokMiktari', baslik: 'Stok', gorunur: true, bicim: '#.##0,00' },
      { alan: 'stokFarki', baslik: 'Stok Farkı', gorunur: true, bicim: '#.##0,00' },
      { alan: 'rezerveMiktar', baslik: 'Rezerve', gorunur: true, toplam: 'topla', bicim: '#.##0,00' },
      { alan: 'sevkTarihi', baslik: 'Sevk Tarihi', gorunur: true, bicim: 'gg.aa.yyyy' },
      { alan: 'siparisTarihi', baslik: 'Sipariş Tarihi', gorunur: true, bicim: 'gg.aa.yyyy' },
      { alan: 'musteriSiparisNo', baslik: 'Müşteri Sip. No', gorunur: true },
      // CF'ler IFS'te açılana kadar boş gelir — kolonlar şimdiden dursun ki
      // alan açıldığında rapora dokunmaya gerek kalmasın.
      { alan: 'siparisTipi', baslik: 'Sipariş Tipi', gorunur: true },
      { alan: 'isMerkezi', baslik: 'İş Merkezi', gorunur: true },
      { alan: 'gercekTarih', baslik: 'Gerçek Tarih', gorunur: true, bicim: 'gg.aa.yyyy' },
      { alan: 'musteriMalzemeNo', baslik: 'Müşteri Malzeme No', gorunur: false },
      { alan: 'sozVerilenTarih', baslik: 'Söz Verilen Tarih', gorunur: false, bicim: 'gg.aa.yyyy' },
      { alan: 'sevkAdresi', baslik: 'Sevk Adresi', gorunur: false },
      { alan: 'musteriNo', baslik: 'Müşteri No', gorunur: false },
      { alan: 'sevkNo', baslik: 'Sevk No', gorunur: false },
      { alan: 'kalemNo', baslik: 'Kalem No', gorunur: false },
      { alan: 'site', baslik: 'Site', gorunur: false },
    ],
    gruplar: ['firmaAdi'],
    siralama: { alan: 'sevkTarihi', yon: 1 },
    filtreler: {},
    grafik: null,
    // Syteline raporundaki "KalanStokMiktar" malzeme bazında yürüyen bakiyeydi (imleçle
    // satır satır düşülüyordu). Görünüm motoru satır-satır birikim yapamadığı için burada
    // satır bazlı fark veriliyor: stok − bu satırın net siparişi.
    hesaplananAlanlar: [{ ad: 'stokFarki', ifade: '{stokMiktari} - {netSiparis}', bicim: '#.##0,00' }],
  },
}

/**
 * Durum (Objstate) değerlerinin Türkçe karşılıkları. Rapor motoru etiketleri
 * rapor_katalog_deger'den okur (veri-seti-alanlar.ts · projeksiyonDegerEtiketleri):
 * kaynakAd = PROJEKSİYON, alan adı; entity okumada dikkate alınmaz.
 * Etiket YALNIZ gösterimdir — ham değer ve süzgeçler değişmez.
 */
const DURUM_ETIKET: Record<string, string> = {
  Planned: 'Planlandı',
  Released: 'Serbest Bırakıldı',
  Reserved: 'Rezerve Edildi',
  Picked: 'Toplandı',
  PartiallyDelivered: 'Kısmi Sevk Edildi',
  Delivered: 'Sevk Edildi',
  Invoiced: 'Faturalandı',
  Cancelled: 'İptal Edildi',
  Blocked: 'Bloke',
}

async function durumEtiketleriYaz(projeksiyon: string) {
  for (const [deger, etiket] of Object.entries(DURUM_ETIKET)) {
    for (const entity of ['CustomerOrderLine', 'CustomerOrder']) {
      await prisma.raporKatalogDeger.upsert({
        where: { kaynakAd_entity_alan_deger: { kaynakAd: projeksiyon, entity, alan: 'Objstate', deger } },
        create: { kaynakAd: projeksiyon, entity, alan: 'Objstate', deger, etiket, kaynak: 'ENUM' },
        update: { etiket },
      })
    }
  }
  // Etiketi olmayan değer kaldıysa göster — IFS'te listede olmayan bir durum varsa
  // ekranda İngilizce kalır, buradan görülür.
  const eksik = await prisma.raporKatalogDeger.findMany({
    where: {
      kaynakAd: projeksiyon,
      alan: 'Objstate',
      etiket: null,
      // YALNIZ bu raporun kullandığı iki entity. Projeksiyonun tamamına bakmak
      // 140 alakasız satır basıyordu (CcCaseTask, SalesRegion…).
      entity: { in: ['CustomerOrderLine', 'CustomerOrder'] },
    },
    select: { entity: true, deger: true },
  })
  console.log(`Durum etiketleri yazıldı (${Object.keys(DURUM_ETIKET).length} değer × 2 entity).`)
  if (eksik.length) {
    console.log(`  Etiketsiz kalan: ${eksik.map((e) => `${e.entity}.${e.deger}`).join(', ')}`)
  }
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue

const ACIKLAMA = 'Sevk tarihi aralığındaki açık müşteri sipariş satırları: net sipariş, stok ve rezerve'

async function main() {
  console.log('EntitySet çözümleniyor (IFS $metadata):')
  const c = await entitySetCoz()

  const tanim = tanimKur(c)
  const veriSeti = await prisma.raporVeriSeti.upsert({
    where: { ad: VERI_SETI_AD },
    create: { ad: VERI_SETI_AD, aciklama: 'IFS müşteri sipariş satırı ⟕ sipariş başlığı ⟕ stok', tanim: json(tanim), onbellekSn: 300, aktif: true },
    update: { aciklama: 'IFS müşteri sipariş satırı ⟕ sipariş başlığı ⟕ stok', tanim: json(tanim), aktif: true },
  })

  const sablon = await prisma.raporSablon.upsert({
    where: { kod: SABLON_KOD },
    create: { kod: SABLON_KOD, ad: 'Açık Sipariş Listesi', aciklama: ACIKLAMA, veriSetiId: veriSeti.id, icerik: json(icerik), durum: 'TASLAK', izinAnahtari: null },
    update: { ad: 'Açık Sipariş Listesi', aciklama: ACIKLAMA, veriSetiId: veriSeti.id, icerik: json(icerik) },
  })

  await durumEtiketleriYaz(c.CustomerOrderLine.projeksiyon)

  console.log(`\nVeri seti: ${veriSeti.ad}  id=${veriSeti.id}`)
  console.log(`Şablon:    ${sablon.kod}  id=${sablon.id}  durum=${sablon.durum}  sürüm=${sablon.surum}`)
  console.log(`\nAç: /raporlar/${sablon.id}`)
  console.log('Durum TASLAK — doğruladıktan sonra tasarım ekranından "Yayında" yapın.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
