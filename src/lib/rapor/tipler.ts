/**
 * Rapor tasarımcısı — veri seti tanımı tipleri (RaporVeriSeti.tanim JSON'unun şekli).
 */

/**
 * Kaynak özeti — satırlar çekildikten SONRA, birleştirmeden ÖNCE uygulanır: `grupla` alanlarının
 * her değer bileşimi için TEK satır kalır. 'enbuyuk'/'enkucuk' → `alan`ın en büyük/küçük olduğu
 * satır (argmax/argmin: satırın tüm kolonları korunur), 'ilk' → kaynaktan gelen ilk satır.
 * Eşitlikte ilk görülen satır kazanır; `alan` null/sayıya çevrilemez olan satırlar en sona düşer
 * (grupta yalnız onlar varsa ilki seçilir).
 */
export interface Ozet {
  /** Gruplama alanları (kaynağın kendi alan adları). Boş dizi = tüm satırlar tek grup. */
  grupla: string[]
  sec: 'enbuyuk' | 'enkucuk' | 'ilk'
  /** 'enbuyuk'/'enkucuk' için karşılaştırılacak alan; 'ilk' için kullanılmaz. */
  alan?: string
}

export interface KaynakIfs {
  /** Veri seti içinde bu kaynağa verilen takma ad (birleştirme/alan yollarında kullanılır). */
  ad: string
  tip: 'ifs-odata'
  /** Örn. 'ShopOrderHandling'. */
  projeksiyon: string
  /** Örn. 'ShopOrds'. */
  entitySet: string
  /** Çekilecek alanlar ($select). */
  select?: string[]
  /** OData $filter; `{p.ad}` yer tutucuları içerebilir. */
  filtre?: string
  /** OData $orderby (örn. 'QtyOnhand desc'); IFS tarafında sıralar. */
  orderby?: string
  /** Varsayılan 500, üst sınır 5000. */
  top?: number
  /** Çekim sonrası grup başına tek satıra indirger (bkz. Ozet). */
  ozet?: Ozet
}

export interface KaynakPostgres {
  ad: string
  tip: 'postgres'
  /** $1, $2 … parametreli SQL. */
  sorgu: string
  /** Sıra ile $1, $2 …'ye girecek rapor parametresi adları. */
  parametreler?: string[]
  /** Tasarım ekranı meta verisi (motor kullanmaz): tablo + seçili kolonlar + WHERE metni ({p.x} ile). */
  tasarim?: { tablo: string; alanlar: string[]; where?: string }
  /** Serbest SQL kaynağı meta'sı (motor kullanmaz): {p.x} yer tutuculu ham metin; sorgu/parametreler bundan türetilir. */
  sqlMetin?: string
  /** Çekim sonrası grup başına tek satıra indirger (bkz. Ozet). */
  ozet?: Ozet
}

export type Kaynak = KaynakIfs | KaynakPostgres

export interface Birlestirme {
  /** 'kaynakAd.alan' — daha önce birleşmiş bir kaynak. */
  sol: string
  /** 'kaynakAd.alan' — eklenecek kaynak. */
  sag: string
  tip: 'inner' | 'left'
}

export interface VeriSetiTanim {
  kaynaklar: Kaynak[]
  birlestir: Birlestirme[]
  /** Çıktı alanı → 'kaynakAd.alan'. Çıktı satırları yalnız bu anahtarları taşır. */
  alanlar: Record<string, string>
}

export type RaporParametreler = Record<string, unknown>

export interface KaynakIstatistik {
  ad: string
  satir: number
  sureMs: number
}

export interface VeriSetiSonuc {
  satirlar: Record<string, unknown>[]
  kaynakIstatistik: KaynakIstatistik[]
  toplamSureMs: number
}

// ── Şablon (RaporSablon.icerik JSON'unun şekli) ──────────────────────────

export type Bicim = '#.##0' | '#.##0,00' | '%0,0' | '%0,00' | 'gg.aa.yyyy' | 'gg.aa.yyyy ss:dd' | 'metin'

export interface KosulluBicim {
  /** İfade dili: '{verim} < 90'. */
  kosul: string
  renk?: 'kritik' | 'iyi' | 'uyari'
  kalin?: boolean
}

export type AltToplamFn = 'topla' | 'ortalama' | 'say' | 'enbuyuk' | 'enkucuk' | 'orani' | 'yok'

export interface Kolon {
  /** Satırdaki anahtar VEYA hesaplanan alan adı. */
  alan: string
  baslik: string
  /** Yüzde; verilmezse eşit dağıtılır. */
  genislik?: number
  /** Verilmezse: sayı/tarih → sag, diğer → sol. */
  hiza?: 'sol' | 'sag' | 'orta'
  bicim?: Bicim
  kosulluBicim?: KosulluBicim[]
  altToplam?: AltToplamFn
  /** altToplam='orani' → topla(oraniPay) / topla(oraniPayda) × 100. */
  oraniPay?: string
  oraniPayda?: string
}

export interface HesaplananAlan { ad: string; ifade: string; bicim?: Bicim }

export interface GrupTanim {
  alan: string
  /** İfade; verilmezse alanın ham değeri. */
  baslik?: string
  yeniSayfa?: boolean
}

export interface SablonParametre {
  ad: string
  tip: 'metin' | 'sayi' | 'tarih' | 'liste'
  etiket: string
  zorunlu?: boolean
}

// ── Tuval (serbest yerleşim) belge tasarımı ──────────────────────────────
//
// Crystal tarzı bant modeli. `yerlesim` yoksa 'liste' sayılır → mevcut kolon/grup tabanlı
// belge şablonları (URT-001) aynen çalışır.

export type TuvalBantId = 'rb' | 'sb' | 'gb' | 'dt' | 'gs' | 'rs' | 'sa'

export const BANT_ADI: Record<TuvalBantId, string> = {
  rb: 'Rapor Başlığı', sb: 'Sayfa Başlığı', gb: 'Grup Başı', dt: 'Detay (her satır)',
  gs: 'Grup Sonu', rs: 'Rapor Sonu', sa: 'Sayfa Altı',
}

export interface TuvalBant {
  id: TuvalBantId
  /** px (tuval birimi); 640px = sayfa içi genişlik. */
  yukseklik: number
  /** Bant basılırken yeni sayfada başlasın (gb için tipik). */
  yeniSayfa?: boolean
}

export type TuvalHiza = 'sol' | 'orta' | 'sag'
export type TuvalDikeyHiza = 'ust' | 'orta' | 'alt'

/** Tüm öğelerin ortak alanları. Konum/boyut px (1px = TUVAL_MM_PX mm — yönden BAĞIMSIZ). */
export interface TuvalOgeOrtak {
  id: string
  bant: TuvalBantId
  x: number
  y: number
  w: number
  h: number
  /** Yazı boyutu (px, tuval ölçeğinde). */
  size?: number
  kalin?: boolean
  hiza?: TuvalHiza
  /** Dikey hizalama (varsayılan 'ust'). */
  dikeyHiza?: TuvalDikeyHiza
  /** Yazı rengi (#1B4F72 gibi); çizgi/kutu için çizgi rengi. */
  renk?: string
  /** Arka plan rengi; yoksa saydam. Kutu öğesinde dolgu rengidir. */
  zemin?: string
}

export type TuvalOge =
  /** metin: {alan}, {p.param}, {sayfa}, {toplamSayfa}, {bugun}, {calistiran}, {rapor.ad} yer tutucuları. */
  | (TuvalOgeOrtak & { tip: 'metin'; metin: string })
  | (TuvalOgeOrtak & { tip: 'alan'; alan: string; bicim?: Bicim; kosulluBicim?: KosulluBicim[] })
  | (TuvalOgeOrtak & { tip: 'toplam'; fn: AltToplamFn; alan: string; oraniPay?: string; oraniPayda?: string; bicim?: Bicim; kosulluBicim?: KosulluBicim[] })
  /** gorsel: 'logo' → kurum logosu (sunucu çözer); 'yukleme' → url ile yüklenmiş görsel. */
  | (TuvalOgeOrtak & { tip: 'gorsel'; kaynak: 'logo' | 'yukleme'; url?: string; dosyaId?: string; oraniKoru?: boolean })
  | (TuvalOgeOrtak & { tip: 'cizgi'; kalinlik?: number })
  | (TuvalOgeOrtak & { tip: 'kutu'; kalinlik?: number })
  | (TuvalOgeOrtak & { tip: 'tablo'; kolonlar: { alan: string; baslik: string; genislik: number }[] })
  | (TuvalOgeOrtak & { tip: 'grafik'; grafikTipi: 'sutun'; grupla: string; deger: string; fn: 'topla' | 'ortalama' })

export interface TuvalTasarim {
  sayfa: { boyut: 'A4'; yon: 'dikey' | 'yatay'; kenar: [number, number, number, number] }
  bantlar: TuvalBant[]
  ogeler: TuvalOge[]
  /** Tek seviye gruplama (gb/gs bantları için); 2. seviye sonraki faz. */
  grup?: { alan: string; baslik?: string }
}

/** A4 kâğıt (mm). */
export const A4_MM = { g: 210, y: 297 } as const

/**
 * Tuval birimi MUTLAKTIR: 1px = 0,28125 mm. (Dikey A4 + 15mm kenar → 180mm = 640px.)
 * Yön/kenar değiştiğinde px→mm ölçeği DEĞİŞMEZ, tuvalin genişliği değişir; ekran ile baskı
 * birebir örtüşsün diye (eskiden 640px "sayfa genişliği ne ise o" demekti → yatayda kayıyordu).
 */
export const TUVAL_MM_PX = 180 / 640

/** Dikey A4 + 15mm kenar tuval genişliği — varsayılan/geri uyumluluk değeri. */
export const TUVAL_GENISLIK = 640

export type TuvalSayfa = TuvalTasarim['sayfa']

/** Sayfa içi genişlik (px, 2'lik ızgaraya yuvarlı). */
export function tuvalGenislik(sayfa: TuvalSayfa): number {
  const g = sayfa.yon === 'yatay' ? A4_MM.y : A4_MM.g
  const icerik = Math.max(20, g - (sayfa.kenar?.[3] ?? 0) - (sayfa.kenar?.[1] ?? 0))
  return Math.round(icerik / TUVAL_MM_PX / 2) * 2
}

/** Sayfa içi yükseklik (px) — bant bütçesini göstermek için. */
export function tuvalYukseklik(sayfa: TuvalSayfa): number {
  const y = sayfa.yon === 'yatay' ? A4_MM.g : A4_MM.y
  const icerik = Math.max(20, y - (sayfa.kenar?.[0] ?? 0) - (sayfa.kenar?.[2] ?? 0))
  return Math.round(icerik / TUVAL_MM_PX / 2) * 2
}

export interface SablonIcerik {
  baslik: string
  altBaslik?: string
  /**
   * TEKNİK açıklama (veri seti/kaynak detayı) — yalnız rapor.tasarla yetkisi olana gösterilir.
   * Kullanıcıya dönük sade açıklama DB'deki RaporSablon.aciklama alanıdır (liste + başlık altı).
   */
  teknikAciklama?: string
  /** 'liste' (varsayılan, mevcut kolon tabanlı) | 'tuval' (serbest yerleşim). */
  yerlesim?: 'liste' | 'tuval'
  tuval?: TuvalTasarim
  /** Liste sayfasında gruplama/filtre için serbest kategori (ör. 'Üretim'). Migration yok — JSON'da. */
  kategori?: string
  parametreler?: SablonParametre[]
  hesaplananAlanlar?: HesaplananAlan[]
  /** Sıralı, en fazla 3 seviye. */
  gruplar?: GrupTanim[]
  kolonlar: Kolon[]
  /** Varsayılan true. */
  genelToplam?: boolean
  sayfaAlti?: { sol?: string; sag?: string }
}

// ── Etkileşimli rapor görünümü (RaporSablon.icerik.tur = 'etkilesimli') ──
//
// Şablon içeriği iki türde olabilir:
//   { tur: 'etkilesimli', gorunum }  → ekranda kurgulanan, kullanıcı anında değiştirebilen görünüm
//   { tur: 'belge', ...SablonIcerik } → A4 basılı belge (raporRender)
// `tur` alanı OLMAYAN eski kayıtlar 'belge' sayılır (URT-001 gibi).

export type GorunumToplamFn = 'topla' | 'ortalama' | 'say' | 'enkucuk' | 'enbuyuk'

export interface GorunumKolon {
  alan: string
  /** Başlık; verilmezse alan adı (ya da katalog etiketi) kullanılır. */
  baslik?: string
  gorunur: boolean
  /** Grup/genel toplam satırında bu kolonda gösterilecek özet. */
  toplam?: GorunumToplamFn
  bicim?: Bicim
}

export interface GorunumGrafik {
  /** Kırılım alanı (metin kolonu). */
  grupla: string
  /** Ölçülen sayısal alan. */
  deger: string
  fn: 'topla' | 'ortalama'
}

export interface Gorunum {
  kolonlar: GorunumKolon[]
  /** Sıralı grup alanları — en fazla 2 seviye. */
  gruplar: string[]
  siralama?: { alan: string; yon: 1 | -1 } | null
  /** alan → süzgeç metni. Metin: içerir. Sayı: "< 90", ">= 10", "= 5", "90". */
  filtreler: Record<string, string>
  grafik?: GorunumGrafik | null
  /** Mevcut ifade motoru (ifade.ts) ile hesaplanan alanlar. */
  hesaplananAlanlar?: HesaplananAlan[]
}

export interface EtkilesimliIcerik {
  tur: 'etkilesimli'
  baslik: string
  altBaslik?: string
  /** Bkz. SablonIcerik.teknikAciklama — yalnız tasarımcıya görünür teknik satır. */
  teknikAciklama?: string
  kategori?: string
  parametreler?: SablonParametre[]
  gorunum: Gorunum
}

export type BelgeIcerik = SablonIcerik & { tur?: 'belge' }
export type SablonIcerikHer = EtkilesimliIcerik | BelgeIcerik

/** `tur` yoksa 'belge' — eski kayıtlar bozulmasın. */
export function icerikTuru(icerik: unknown): 'etkilesimli' | 'belge' {
  return (icerik as { tur?: string } | null)?.tur === 'etkilesimli' ? 'etkilesimli' : 'belge'
}

export function etkilesimliMi(icerik: unknown): icerik is EtkilesimliIcerik {
  return icerikTuru(icerik) === 'etkilesimli'
}
