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
  parametreler?: SablonParametre[]
  hesaplananAlanlar?: HesaplananAlan[]
  /** Sıralı, en fazla 3 seviye. */
  gruplar?: GrupTanim[]
  kolonlar: Kolon[]
  /** Varsayılan true. */
  genelToplam?: boolean
  sayfaAlti?: { sol?: string; sag?: string }
}
