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
