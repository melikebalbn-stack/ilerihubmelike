/**
 * Rapor tasarımcısı — veri seti tanımı tipleri (RaporVeriSeti.tanim JSON'unun şekli).
 */

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
  /** Varsayılan 500, üst sınır 5000. */
  top?: number
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

export interface SablonIcerik {
  baslik: string
  altBaslik?: string
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
