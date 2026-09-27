import {
  ArrowDownUp,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Forklift,
  PackageMinus,
  PackageSearch,
  Send,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Depo el terminali modül yardım metinleri — TEK KAYNAK.
 * "Nasıl kullanılır?" rehberi (yardim/_client.tsx) ve ana menü "?" hızlı yardımı (_client.tsx) buradan okur.
 * Metinler depo ekibinin verdiği hâliyle (sade, mavi yaka için); değiştirirken ikisi birden değişir.
 */

export interface ModulYardim {
  /** Ana menüdeki kart adı ve ikonu (sıra da ana menüyle aynı). */
  label: string
  Icon: LucideIcon
  /** Modül ekranı. */
  href: string
  /** Genel bakış kartının alt yazısı. */
  kisa: string
  /** Modül sayfası / panel başlığı. */
  baslik: string
  neZaman: string
  adimlar: string[]
  dikkat: string
}

export const MODULLER: ModulYardim[] = [
  {
    label: 'Stok Taşıma',
    href: '/terminal/depo/stok-tasima',
    Icon: ArrowDownUp,
    kisa: 'Bir malzemeyi bir raftan başka rafa taşırken',
    baslik: 'Stok Taşıma',
    neZaman: 'Bir malzemeyi bulunduğu raftan başka bir rafa koyacağın zaman.',
    adimlar: [
      'Malzemenin barkodunu okut.',
      'Nereden alacağını sistem gösterir.',
      'Miktarı gir.',
      'Koyacağın rafı okut, TAŞI\'ya bas.',
    ],
    dikkat: 'Rafı okutmadan malzemeyi yerleştirme; sistem malzemeyi eski yerinde sanır.',
  },
  {
    label: 'Malzeme Toplama',
    href: '/terminal/depo/toplama',
    Icon: ClipboardList,
    kisa: 'Üretime iş emri için malzeme hazırlarken',
    baslik: 'Malzeme Toplama',
    neZaman: 'Üretime bir iş emri için malzeme hazırlayacağın zaman.',
    adimlar: [
      'Listeden iş emrini seç ya da iş emri etiketini okut.',
      'Toplanacak malzemeyi ve gideceğin rafı görürsün.',
      'Rafa git, malzeme etiketini okut.',
      'Miktarı onayla.',
    ],
    dikkat: 'Gri görünen iş emirleri henüz serbest bırakılmamıştır, toplanamaz; planlamaya haber ver.',
  },
  {
    label: 'Stok Bilgisi',
    href: '/terminal/depo/stok-bilgisi',
    Icon: PackageSearch,
    kisa: 'Bir malzeme nerede, ne kadar var bakmak için',
    baslik: 'Stok Bilgisi',
    neZaman: 'Bir malzeme nerede, ne kadar var merak ettiğinde.',
    adimlar: [
      'Malzeme barkodunu, stok numarasını ya da raf etiketini okut.',
      'Hangi rafta ne kadar olduğunu görürsün.',
      'Detay için karta dokun.',
    ],
    dikkat: 'Bu ekran sadece bakmak içindir, hiçbir şeyi değiştirmez.',
  },
  {
    label: 'Taşıma Birimi',
    href: '/terminal/depo/tasima-birimi',
    Icon: Boxes,
    kisa: 'Palet hazırlarken, paleti taşırken',
    baslik: 'Taşıma Birimi (Palet)',
    neZaman: 'Palet hazırlarken, paleti bir yere taşırken ya da malzemeyi bir paletten diğerine aktarırken.',
    adimlar: [
      'Yeni palet için "Palet Oluştur"a bas, türünü seç; çıkan palet numarasını palete yaz/yapıştır.',
      '"Palet İçeriği"nden paleti okut, "Ekle" ile malzeme koy, "Çıkar" ile al.',
      'Paleti taşımak için "Palet Taşı": paleti okut, gideceği rafı okut.',
      'Aktarmak için "Palet Değiştir".',
    ],
    dikkat: 'Palet alanına okuttuğun numara her zaman palet sayılır; malzemeyi malzeme alanına okut.',
  },
  {
    label: 'Toplu Taşıma',
    href: '/terminal/depo/toplu-tasima',
    Icon: Forklift,
    kisa: 'Birçok malzemeyi aynı yere tek seferde taşırken',
    baslik: 'Toplu Taşıma',
    neZaman: 'Birçok malzemeyi aynı rafa tek seferde taşıyacağın zaman.',
    adimlar: [
      'Gideceğin rafı okut, "Yeni Fiş" aç.',
      'Her malzeme için: aldığın rafı okut, malzemeyi okut, miktarı gir, EKLE.',
      'Hepsi bitince TRANSFER ET.',
    ],
    dikkat: 'Fişe eklemek malzemeyi ayırmaz; TRANSFER ET\'e basana kadar başkası da o malzemeyi alabilir. Fişi uzun süre açık bırakma.',
  },
  {
    label: 'Transfer Talebi',
    href: '/terminal/depo/transfer-talebi',
    Icon: Send,
    kisa: 'Üretimin istediği malzemeyi götürürken',
    baslik: 'Transfer Talebi',
    neZaman: 'Üretim ya da başka bir birim sistemden malzeme istediğinde.',
    adimlar: [
      'Bekleyen talepler listesinden talebi seç.',
      'İstenen malzemeleri ve kalan miktarı görürsün.',
      'Malzemeye dokun, aldığın rafı ve malzemeyi okut, miktarı gir, EKLE.',
      'Tüm kalanlar sıfır olunca TRANSFER ET.',
    ],
    dikkat: 'Talep tamamlanmadan transfer yapılamaz; eksik malzeme varsa şefine haber ver.',
  },
  {
    label: 'Sevkiyat',
    href: '/terminal/depo/sevkiyat',
    Icon: Truck,
    kisa: 'Müşteriye gidecek ürünü hazırlarken',
    baslik: 'Sevkiyat',
    neZaman: 'Müşteriye gidecek ürünü hazırlayacağın zaman.',
    adimlar: [
      'Listeden sevkiyatı seç.',
      'Her ürün için sistemin gösterdiği rafa git.',
      'Kutuları tek tek okut, miktarı gir; okuttukların listede birikir.',
      'Hepsi bitince TOPLAMAYI BİTİR.',
    ],
    dikkat: 'Eksik toplarsan kalan miktar için sevkiyat yeniden hazırlanmalı; ekrandaki uyarıyı oku. İrsaliye ofiste kesilir.',
  },
  {
    label: 'Malzeme Talebi',
    href: '/terminal/depo/malzeme-talebi',
    Icon: PackageMinus,
    kisa: 'Eldiven, yağ gibi sarf malzeme verirken',
    baslik: 'Malzeme Talebi (Sarf)',
    neZaman: 'Eldiven, yağ, conta gibi sarf malzemeyi bir birime verdiğin zaman.',
    adimlar: [
      'Talep numarasını okut ya da hangi birim için olduğunu seçip "Yeni Talep" aç.',
      'Rafı ve malzemeyi okut, miktarı gir, EKLE.',
      'Yanlış eklediysen "Çıkar".',
      'TÜKET\'e bas; malzeme stoktan düşer.',
    ],
    dikkat: 'TÜKET\'e bastıktan sonra geri alınamaz; miktarı kontrol et.',
  },
  {
    label: 'Sayım',
    href: '/terminal/depo/sayim',
    Icon: ClipboardCheck,
    kisa: 'Rafları sayarken',
    baslik: 'Sayım',
    neZaman: 'Ofis bir sayım listesi açtığında, rafları saymak için.',
    adimlar: [
      'Listeden sayım raporunu seç.',
      'Saydığın rafı okut.',
      'Malzemeyi okut, saydığın miktarı gir, KAYDET.',
      'Rafın hepsi bitince sonraki rafa geç.',
    ],
    dikkat: 'Sistemdeki miktar sana gösterilmez; gördüğünü say, tahmin yazma. Farkları ofis onaylar.',
  },
]

/** Ana menü kartı → yardım (href eşleşmesi). */
export const yardimBul = (href: string | undefined) => MODULLER.find((m) => m.href === href)
