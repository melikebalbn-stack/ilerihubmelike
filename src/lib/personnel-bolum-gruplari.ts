/**
 * GMY personel tablosu — bölüm eşleme haritası (TEK KAYNAK).
 *
 * GMY'nin takip ettiği tabloda sütun başlıkları ILERIHub'daki
 * DepartmentDefinition adlarıyla birebir aynı değil (ör. "CNC VE MATKAP" =
 * "Talaşlı İmalat", "DEPOLAR" = dört ayrı depo bölümü). Eşleme burada tutulur;
 * bölüm adı değişirse YALNIZ bu dosya güncellenir.
 *
 * Kaynak alan: Personnel.bolum (serbest metin). 22.09.2026 ölçümünde bu alan
 * DepartmentDefinition.name ile 186/186 birebir örtüşüyor — yine de eşleşmeyen
 * bir ad çıkarsa satır sessizce DÜŞMEZ, "DİĞER" sütununda toplanır.
 *
 * Yaka ayrımı tabloya göredir, haritaya değil:
 *   - İmalat tablosu  → MAVİ + GRİ yakalılar
 *   - Ofis tablosu    → BEYAZ yakalılar
 * Bu yüzden "Kalite Müdürlüğü" iki tabloda da görünür: imalatta
 * "KALİTE KONTROL" (mavi+gri), ofiste "KALİTE" (beyaz).
 */

/** Haritada karşılığı olmayan bölümlerin toplandığı sütun. */
export const DIGER_SUTUN = 'DİĞER'

/**
 * Grup tanımı. Başlıklar mail ve ekranda AYNI — mail tablosu 23.09.2026'da
 * döndürüldüğü için (satır = bölüm) tam adlar tek satıra sığıyor, kısaltma yok.
 */
export interface BolumGrubu { baslik: string; bolumler: string[] }

/** İmalat tablosu (mavi + gri yaka): sütun başlığı → DepartmentDefinition adları. */
export const IMALAT_GRUPLARI: BolumGrubu[] = [
  { baslik: 'LAZER', bolumler: ['Lazer & Daire Testere'] },
  { baslik: 'PRESHANE', bolumler: ['Preshane'] },
  { baslik: 'CNC VE MATKAP', bolumler: ['Talaşlı İmalat'] },
  { baslik: 'KAYNAKHANE', bolumler: ['Kaynakhane'] },
  { baslik: 'MEKANİK MONTAJ', bolumler: ['Mekanik Montaj'] },
  { baslik: 'PLASTİK ENJEKSİYON', bolumler: ['Plastik Enjeksiyon'] },
  { baslik: 'PAKETLEME & DİREKSİYON', bolumler: ['Paketleme & Direksiyon'] },
  { baslik: 'DEPOLAR', bolumler: ['Yarı Mamul ve Hammadde Depo', 'Tesellüm Depo', 'Mamul Depo', 'Sarf Depo'] },
  { baslik: 'KALİTE KONTROL', bolumler: ['Kalite Müdürlüğü'] },
  { baslik: 'KALIPHANE', bolumler: ['Kalıphane'] },
  { baslik: 'AR-GE', bolumler: ['Prototip Atölye'] },
  { baslik: 'İDARİ İŞLER', bolumler: ['İdari İşler'] },
  { baslik: 'BAKIMHANE', bolumler: ['Bakımhane'] },
  { baslik: 'ASANSÖR MÜDÜRLÜĞÜ', bolumler: ['Asansör Müdürlüğü'] },
]

/**
 * Ofis tablosu (beyaz yaka): sütun başlığı → DepartmentDefinition adları.
 *
 * NOT: "Lojistik" ve "Planlama" ayrı bölüm olarak TANIMLI DEĞİL; GMY tablosunda
 * ayrı başlık olsalar da ILERIHub'da Fabrika Müdürlüğü altındalar → FABRİKA MÜDÜRLÜĞÜ
 * sütununa girerler. (23.09.2026 ölçümü: 10 beyaz yakalının bolumDetay kırılımı
 * FABRİKAMÜDÜRLÜĞÜ 2 · ÜRETİM 1 · ÜRETİM PLANLAMA 4 · LOJİSTİK 3 — ayrıştırmak
 * istenirse eşleme bolumDetay'a da bakmalı; şu an yalnız Personnel.bolum kullanılıyor.)
 * İmalat bölümlerinde çalışan beyaz yakalılar (Kalıphane, Prototip Atölye, İdari İşler)
 * GMY kararıyla KENDİ bölüm adlarıyla ayrı sütunda gösterilir.
 */
export const OFIS_GRUPLARI: BolumGrubu[] = [
  { baslik: 'FABRİKA MÜDÜRLÜĞÜ', bolumler: ['Fabrika Müdürlüğü'] },
  { baslik: 'SATINALMA', bolumler: ['Satınalma Müdürlüğü'] },
  { baslik: 'SATIŞ PAZARLAMA', bolumler: ['Satış & Pazarlama Müdürlüğü', 'Asansör Satış Pazarlama'] },
  { baslik: 'MUHASEBE', bolumler: ['Finans-Muhasebe Müdürlüğü'] },
  { baslik: 'MÜHENDİSLİK', bolumler: ['Mühendislik Müdürlüğü'] },
  { baslik: 'İNSAN KAYNAKLARI', bolumler: ['İnsan Varlıkları Müdürlüğü'] },
  { baslik: 'KALİTE', bolumler: ['Kalite Müdürlüğü'] },
  { baslik: 'STRATEJİK SEKTÖRLER', bolumler: ['Stratejik Sektörler'] },
  { baslik: 'YÖNETİM', bolumler: ['Yönetim'] },
  { baslik: 'SİSTEM GELİŞTİRME', bolumler: ['Sistem Geliştirme Müdürlüğü'] },
  { baslik: 'YENİ İŞ GELİŞTİRME', bolumler: ['Yeni İş Geliştirme'] },
  // NOT: 'Asansör Müdürlüğü' ofis tablosunda YOK — orada beyaz yakalı bulunmuyor
  // (5 mavi + 1 gri, hepsi imalat tablosunda). Beyaz yakalı atanırsa DİĞER'de
  // görünür, sessizce düşmez; o zaman buraya sütun eklenir.
  // İmalat bölümlerinin beyaz yakalıları — kendi adlarıyla
  { baslik: 'KALIPHANE', bolumler: ['Kalıphane'] },
  { baslik: 'PROTOTİP ATÖLYE', bolumler: ['Prototip Atölye'] },
  { baslik: 'İDARİ İŞLER', bolumler: ['İdari İşler'] },
]

/** bölüm adı → sütun başlığı ters indeksi (aynı bölüm iki sütuna verilemez). */
function tersIndeks(gruplar: BolumGrubu[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const g of gruplar) {
    for (const b of g.bolumler) {
      const onceki = m.get(b)
      if (onceki && onceki !== g.baslik) {
        throw new Error(`Bölüm eşlemesi çakışıyor: '${b}' hem '${onceki}' hem '${g.baslik}' sütununda`)
      }
      m.set(b, g.baslik)
    }
  }
  return m
}

export const IMALAT_INDEKS = tersIndeks(IMALAT_GRUPLARI)
export const OFIS_INDEKS = tersIndeks(OFIS_GRUPLARI)

/** Bölüm adını sütun başlığına çevirir; haritada yoksa DİĞER. */
export function sutunBul(indeks: Map<string, string>, bolum: string | null | undefined): string {
  if (!bolum) return DIGER_SUTUN
  return indeks.get(bolum.trim()) ?? DIGER_SUTUN
}
