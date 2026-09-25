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
 *
 * `bolumDetaylari` verilirse grup, o bölümün YALNIZ bu alt kırılımını alır
 * (25.09.2026: Fabrika Müdürlüğü üçe, Satış & Pazarlama ikiye bölündü).
 * Süzgeç bölüme BAĞLIDIR, genel değildir: aynı `bolumDetay` metni başka bölümde
 * de geçebiliyor — ölçüm, "MALİYET ANALİZ"in hem Satış & Pazarlama'da (2 beyaz)
 * hem Mekanik Montaj'da (1 mavi) kullanıldığını gösterdi. Genel bir detay
 * indeksi kurulsaydı mavi yakalı montajcı ofis tablosuna sızardı.
 */
export interface BolumGrubu {
  baslik: string
  bolumler: string[]
  /** Yalnız bu grubun `bolumler`i içinde geçerli alt kırılım süzgeci. */
  bolumDetaylari?: string[]
}

/** bolumDetay serbest metin — karşılaştırma öncesi Türkçe büyük harfe normalize edilir. */
function detayNormalize(d: string | null | undefined): string {
  return (d ?? '').trim().toLocaleUpperCase('tr')
}

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
 * NOT: "Lojistik" ve "Planlama" ayrı bölüm olarak TANIMLI DEĞİL — ILERIHub'da
 * Fabrika Müdürlüğü altındalar. 25.09.2026'dan beri eşleme `bolumDetay`a da
 * baktığı için GMY tablosundaki gibi ayrı sütunlarda gösteriliyorlar.
 * İmalat bölümlerinde çalışan beyaz yakalılar (Kalıphane, Prototip Atölye, İdari İşler)
 * GMY kararıyla KENDİ bölüm adlarıyla ayrı sütunda gösterilir.
 */
export const OFIS_GRUPLARI: BolumGrubu[] = [
  // Fabrika Müdürlüğü ÜÇE bölündü (25.09.2026 GMY isteği) — kırılım bolumDetay'dan.
  // 25.09.2026 ölçümü: FABRİKAMÜDÜRLÜĞÜ 2 · ÜRETİM 1 · ÜRETİM PLANLAMA 4 · LOJİSTİK 3.
  { baslik: 'ÜRETİM', bolumler: ['Fabrika Müdürlüğü'], bolumDetaylari: ['FABRİKAMÜDÜRLÜĞÜ', 'ÜRETİM'] },
  // NOT: Fatih Kaya (ILR-00580) bu sütunda ama görevi "İÇ LOJİSTİK SORUMLUSU".
  // bolumDetay'ı ÜRETİM PLANLAMA olduğu için burada sayılıyor; İV bolumDetay'ı
  // LOJİSTİK'e çekerse kişi kendiliğinden LOJİSTİK sütununa geçer, kod değişmez.
  { baslik: 'ÜRETİM PLANLAMA', bolumler: ['Fabrika Müdürlüğü'], bolumDetaylari: ['ÜRETİM PLANLAMA'] },
  { baslik: 'LOJİSTİK', bolumler: ['Fabrika Müdürlüğü'], bolumDetaylari: ['LOJİSTİK'] },
  { baslik: 'SATINALMA', bolumler: ['Satınalma Müdürlüğü'] },
  // Maliyet analiz ayrı başlık (25.09.2026) — bolumDetay'da zaten ayrı değer olarak
  // duruyordu (AYGÜL ÖZGÜR, ÖMER FARUK ÜNSAL). Kalan Satış & Pazarlama kişileri
  // bölüm düzeyinde eşleşir; detay eşleşmesi bölüm eşleşmesinden ÖNCE gelir.
  { baslik: 'MALİYET ANALİZ', bolumler: ['Satış & Pazarlama Müdürlüğü'], bolumDetaylari: ['MALİYET ANALİZ'] },
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
  // İmalat bölümlerinin beyaz yakalıları — kendi adlarıyla.
  // Kalıphane (1) ve Prototip Atölye (1) 25.09.2026'da TEK başlıkta birleştirildi;
  // ikisi de tek kişilik sütundu. İMALAT tablosunda AYRI kalmaya devam ediyorlar
  // (orada KALIPHANE ve AR-GE olarak, mavi+gri kadroları ayrı takip ediliyor).
  { baslik: 'KALIPHANE VE PROTOTİP ATÖLYE', bolumler: ['Kalıphane', 'Prototip Atölye'] },
  { baslik: 'İDARİ İŞLER', bolumler: ['İdari İşler'] },
]

/**
 * İKİ KATMANLI ters indeks.
 *   detay : `bölüm|BOLUMDETAY` → sütun başlığı   (öncelikli)
 *   bolum : `bölüm`            → sütun başlığı   (geri düşüş)
 *
 * Çakışma kuralları:
 *   · Aynı bölüm+detay ikilisi iki sütuna verilemez.
 *   · Aynı bölüm iki kez BÖLÜM DÜZEYİNDE (detaysız) verilemez.
 *   · Aynı bölümün detaylı ve detaysız grupta bulunması SERBEST — detaylı grup
 *     alt kırılımı alır, detaysız grup kalanı toplar (Satış & Pazarlama deseni).
 */
export interface BolumIndeksi {
  detay: Map<string, string>
  bolum: Map<string, string>
}

function detayAnahtar(bolum: string, detay: string): string {
  return `${bolum.trim()}|${detayNormalize(detay)}`
}

function tersIndeks(gruplar: BolumGrubu[]): BolumIndeksi {
  const detay = new Map<string, string>()
  const bolum = new Map<string, string>()
  for (const g of gruplar) {
    for (const b of g.bolumler) {
      if (g.bolumDetaylari?.length) {
        for (const d of g.bolumDetaylari) {
          const k = detayAnahtar(b, d)
          const onceki = detay.get(k)
          if (onceki && onceki !== g.baslik) {
            throw new Error(`Bölüm eşlemesi çakışıyor: '${b}' / '${d}' hem '${onceki}' hem '${g.baslik}' sütununda`)
          }
          detay.set(k, g.baslik)
        }
      } else {
        const onceki = bolum.get(b.trim())
        if (onceki && onceki !== g.baslik) {
          throw new Error(`Bölüm eşlemesi çakışıyor: '${b}' hem '${onceki}' hem '${g.baslik}' sütununda`)
        }
        bolum.set(b.trim(), g.baslik)
      }
    }
  }
  return { detay, bolum }
}

export const IMALAT_INDEKS = tersIndeks(IMALAT_GRUPLARI)
export const OFIS_INDEKS = tersIndeks(OFIS_GRUPLARI)

/**
 * Bölüm (+ alt kırılım) adını sütun başlığına çevirir.
 * Sıra: bölüm+detay → bölüm → DİĞER. Haritada olmayan satır sessizce DÜŞMEZ.
 */
export function sutunBul(
  indeks: BolumIndeksi,
  bolum: string | null | undefined,
  bolumDetay?: string | null,
): string {
  if (!bolum) return DIGER_SUTUN
  const b = bolum.trim()
  const dEslesme = indeks.detay.get(detayAnahtar(b, bolumDetay ?? ''))
  if (dEslesme) return dEslesme
  return indeks.bolum.get(b) ?? DIGER_SUTUN
}
