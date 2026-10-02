/**
 * SERVİS TANIM VERİSİ — güzergâh + durak listesi (tek kaynak)
 *
 * VERİ KAYNAĞI İKİ KATMANLI:
 *   1. dev DB'den okunan yerleşmiş tanım verisi (9 güzergâh, 106 durak)
 *   2. İdari İşler eşleme tablosundan gelen YENİ duraklar (SIRASI GERÇEK DEĞİL,
 *      bkz. ilgili güzergâhın yorumu)
 *   Toplam ÖLÇÜLEN: 9 güzergâh, 138 durak (servis-tanim-verisi.test.ts sabitler).
 *   Eski başlıktaki "27 yeni durak → 133" sayısı sonradan eklenen duraklarla
 *   bayatlamıştı; kırılımı (106 + yeni) ayrıca ölçülmedi, yalnız toplam doğru.
 *
 * Buradan okuyanlar:
 *   - prisma/seed-servis-tanim.ts  (tanım paketini DB'ye yazar)
 *   - göç script'i (durak eşleştirmesi)
 *
 * Seed dosyası `main()`'i modül düzeyinde çağırdığı için veri ORADA
 * DURAMAZ: import eden her test seed'i çalıştırırdı. Veri burada,
 * seed yalnız yazma mantığını tutuyor.
 *
 * Durak kodu üretimi burada DEĞİL: servis-durak-kodu.ts (tek kaynak).
 */

export type DurakTanimi = { sira: number; ad: string }
export type GuzergahTanimi = { kod: string; ad: string; duraklar: DurakTanimi[] }

// ----------------------------------------------------------------------------
// VERİ — yerleşmiş kısım
// ----------------------------------------------------------------------------

export const GUZERGAHLAR: GuzergahTanimi[] = [
  {
    kod: 'ARAPCESME',
    ad: 'Arapçeşme',
    duraklar: [
      { sira: 1, ad: 'Cezaevi' },
      { sira: 2, ad: 'Kaşkar Fırın' },
      { sira: 3, ad: 'Hal Yolu' },
      { sira: 4, ad: 'Meslek Lisesi' },
      { sira: 5, ad: 'Belediye Karşısı' },
      { sira: 6, ad: 'Gümüştaş Fırın' },
      { sira: 7, ad: 'Akse Sapağı' },
      { sira: 8, ad: 'Çetinkaya' },
      { sira: 9, ad: 'Adliye' },
      { sira: 10, ad: 'Mezarlık Işıklar' },
      { sira: 11, ad: 'Merkez Prime' },
      { sira: 12, ad: 'M. Migros' },
      { sira: 13, ad: 'Yapı Kredi / Mutlukent' },
      { sira: 14, ad: 'Shell Benzinlik' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (4 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (14) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 15, ad: 'MUTLUKENT' },
      { sira: 16, ad: 'ANADOLU LİSESİ' },
      { sira: 17, ad: 'ARAP ÇEŞME SEHLL PETROL' },
      { sira: 18, ad: 'İLBEYOĞLU' },
      // 🔴 A8 — Personnel'de 'GÜNSAŞ FIRIN' geçiyor (dev'deki 'Kaşkar Fırın'
      // farklı bir durak). Elif kararı (2026-09-29): Personnel metni esas
      // alınır, TEYİT BEKLİYOR (bkz. TEYIT_BEKLIYOR sabiti, madde A8).
      // Sıra GEÇİCİ: güzergâhtaki gerçek fiziksel sırası bilinmiyor, mevcut
      // max'tan devam ettirildi.
      { sira: 19, ad: 'GÜNSAŞ FIRIN' },
    ],
  },
  {
    kod: 'AYDOS_KURTKOY',
    ad: 'Aydos-Kurtköy',
    duraklar: [
      { sira: 1, ad: 'AYDOS' },
      { sira: 2, ad: 'Sülüntepe' },
      { sira: 3, ad: 'Kurtköy' },
      { sira: 4, ad: 'Viaport' },
      { sira: 5, ad: 'Şekerpınar' },
      { sira: 6, ad: 'Yakacık Yeni Mah.' },
      // 🔴 A6/A7 — ŞEKERPINAR: İdari İşler 1. turda "tek durak mı iki mi"
      // çelişkisi vardı; Elif kararı (2026-09-29): Personnel'deki iki metin
      // İKİ AYRI durak olarak kalır, TEYİT BEKLİYOR. Sıra GEÇİCİ.
      { sira: 7, ad: 'ŞEKERPINAR TOKİ' },
      { sira: 8, ad: 'ŞEKERPINAR KÖY İÇİ' },
    ],
  },
  {
    kod: 'BEYLIKBAGI_GUZELTEPE',
    ad: 'Beylikbağı-Güzeltepe',
    duraklar: [
      { sira: 1, ad: 'B. Park' },
      { sira: 2, ad: 'Trafo' },
      { sira: 3, ad: 'Adem Yavuz Kapalı Pazar' },
      { sira: 4, ad: 'Erbalcılar' },
      { sira: 5, ad: 'Sır Market' },
      { sira: 6, ad: 'Madra Cami' },
      { sira: 7, ad: 'Özgür İpek Park' },
      { sira: 8, ad: 'Geri Dönüşümcüler' },
      { sira: 9, ad: 'Çayırova Koop.' },
      { sira: 10, ad: 'Çağdaşkent' },
      { sira: 11, ad: 'Feniş Işıklar' },
      { sira: 12, ad: 'Erişler' },
      { sira: 13, ad: 'Çiçekçiler' },
      { sira: 14, ad: 'Mandıra' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (1 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (14) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 15, ad: 'YAVUZ SELİM DURAĞI' },
      // 🔴 A4/A5 — GÜL PASTANESİ ve KARAKOL: İdari İşler cevap vermedi; Elif
      // kararı (2026-09-29): Personnel metni kendi durağı sayılır, TEYİT
      // BEKLİYOR. Sıra GEÇİCİ.
      { sira: 16, ad: 'GÜL PASTANESİ' },
      { sira: 17, ad: 'KARAKOL' },
    ],
  },
  {
    kod: 'BEYLIKBAGI_ULASTEPE',
    ad: 'Beylikbağı-Ulaştepe',
    duraklar: [
      { sira: 1, ad: 'Sarı Cami' },
      { sira: 2, ad: 'Bebek Market' },
      { sira: 3, ad: '23 Nisan Cd. Hakmar' },
      { sira: 4, ad: 'Ulaştepe' },
      { sira: 5, ad: 'Yavuz Selim' },
      { sira: 6, ad: 'Kadir Bakkal' },
      { sira: 7, ad: 'Yıldız Bakkal' },
      { sira: 8, ad: 'Aşık Mahsuni Parkı' },
      { sira: 9, ad: 'Can Emlak' },
      { sira: 10, ad: 'Emek' },
      { sira: 11, ad: 'Ocak Market' },
      { sira: 12, ad: 'Zirve Market' },
      { sira: 13, ad: 'Tahsin Tarhan Ort.Ok' },
      { sira: 14, ad: 'Mahsuni Şerif Parkı' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (5 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (14) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 15, ad: 'YAVUZ SELİM DURAĞI' },
      { sira: 16, ad: '23 NİSAN CAD. HAKMAR' },
      { sira: 17, ad: 'SARI CAMİİ' },
      { sira: 18, ad: 'ULAŞTEPE ZİRVE MARKET' },
      { sira: 19, ad: 'YILDIZ MARKET' },
    ],
  },
  {
    kod: 'DARICA',
    ad: 'Darıca',
    duraklar: [
      { sira: 1, ad: 'Battı Çıktı' },
      { sira: 2, ad: '60. yıl orta okulu' },
      { sira: 3, ad: 'Mehmet Akif' },
      { sira: 4, ad: 'Moda Durak' },
      { sira: 5, ad: 'Garanti Bank.' },
      { sira: 6, ad: 'Eriş' },
      { sira: 7, ad: 'Eriş Durağı' },
      { sira: 8, ad: 'Mehmet Akif' },
      { sira: 9, ad: 'Mezarlık Opet Önü' },
      { sira: 10, ad: 'Tuzla Cad. Remax Önü' },
      { sira: 11, ad: 'Cumhuriyet Meydan' },
      { sira: 12, ad: 'Mezbahane Ediş Yapı' },
      { sira: 13, ad: 'M. Taşlı' },
      { sira: 14, ad: 'Unteks' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (4 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (14) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 15, ad: 'İTFAİYE' },
      { sira: 16, ad: 'DARICA EMNİYET MÜDÜRLÜĞÜ' },
      { sira: 17, ad: 'SULTAN PASTANESİ ÜST YOL' },
      { sira: 18, ad: 'UNTEX' },
    ],
  },
  {
    kod: 'GEBZE_DEVELI',
    ad: 'Gebze-Develi',
    duraklar: [
      { sira: 1, ad: 'Osman Yılmaz (Fevzi Çakmak Cad.)' },
      { sira: 2, ad: 'M. Paşa (Hakmar)' },
      { sira: 3, ad: 'Sistem Elektrik (Develi)' },
      { sira: 4, ad: 'Köşklü Çeşme Bim Karşısı' },
      { sira: 5, ad: 'Garanti Bankası' },
      { sira: 6, ad: 'Gaziler Mah. (Bim Önü)' },
      { sira: 7, ad: 'Eşref Bitlis Parkı (A101 önü)' },
      { sira: 8, ad: 'Akse Sapağı Durak Pastanesi' },
      { sira: 9, ad: 'Eğitim Uygulama Okulu' },
      { sira: 10, ad: 'Eşref Bitlis Bim Önü' },
    ],
  },
  {
    kod: 'KAVACIK_BEYKOZ',
    ad: 'Kavacık-Beykoz',
    duraklar: [
      { sira: 1, ad: 'Dedeoğlu' },
      { sira: 2, ad: 'Çubuklu' },
      { sira: 3, ad: 'Ozanlar' },
      { sira: 4, ad: 'Ziraat Bankası' },
      { sira: 5, ad: 'Rüzgarlıbahçe' },
      { sira: 6, ad: 'Küçüksu' },
      { sira: 7, ad: 'Şok Market' },
      { sira: 8, ad: 'İstikbal Önü' },
      { sira: 9, ad: 'Garanti Bankası' },
      { sira: 10, ad: 'Tekke Şok' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (1 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (10) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 11, ad: 'ANADOLU HİSARI' },
    ],
  },
  {
    kod: 'KAYNARCA_KARTAL',
    ad: 'Kaynarca-Kartal',
    duraklar: [
      { sira: 1, ad: 'Beton Yol' },
      { sira: 2, ad: 'Kurtfalı Üst Geçit' },
      { sira: 3, ad: 'Çamçeşme Park' },
      { sira: 4, ad: 'Çamçeşme' },
      { sira: 5, ad: 'Tepebaşı Cami' },
      { sira: 6, ad: 'Aydıntepe Köp.' },
      { sira: 7, ad: 'İçmeler Köp.' },
      { sira: 8, ad: 'İçmeler Durağı' },
      { sira: 9, ad: 'Şişecam' },
      { sira: 10, ad: 'Tel Boyu' },
      { sira: 11, ad: 'Turgut Özal Cd.' },
      { sira: 12, ad: 'Tel Boyu Şifa' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (10 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (12) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 13, ad: 'İÇMELER KÖPRÜSÜ' },
      { sira: 14, ad: 'KARTAL BETON YOL' },
      { sira: 15, ad: 'ŞİFA TEL BOYU' },
      { sira: 16, ad: 'AYDINTEPE METRO' },
      { sira: 17, ad: 'ADNAN KAHVECİ' },
      { sira: 18, ad: 'ESENYALI' },
      { sira: 19, ad: 'ASSAN ÜST GEÇİDİ' },
      { sira: 20, ad: 'AYTEMİZ PETROL' },
      { sira: 21, ad: 'EROL GÜNGÖR İÖÖ' },
      { sira: 22, ad: 'TOPSELVİ' },
    ],
  },
  {
    kod: 'USKUDAR',
    ad: 'Üsküdar-Zeynepkamil',
    duraklar: [
      { sira: 1, ad: 'Bağlarbaşı' },
      { sira: 2, ad: 'Üsküdar' },
      { sira: 3, ad: 'Zeynep Kamil Kavşak' },
      { sira: 4, ad: 'Üsküdar' },
      { sira: 5, ad: 'Kozyatağı Metro' },
      { sira: 6, ad: 'Aydınevler' },
      { sira: 7, ad: 'Huzurevi' },
      { sira: 8, ad: 'Esenkent Metro' },
      { sira: 9, ad: 'Maltepe' },
      { sira: 10, ad: 'Mavi Evler' },
      { sira: 11, ad: 'Plaza Esenkent' },
      { sira: 12, ad: 'Fsm Köprüsü' },
      // 🔴 İdari İşler eşleme tablosundan gelen YENİ duraklar (2 adet).
      //    SIRA GERÇEK DEĞİL: güzergâhtaki fiziksel sırası bilinmiyor,
      //    mevcut max'tan (12) devam ettirildi. TODO(elif): gerçek sıra.
      { sira: 13, ad: 'MAVİEVLER-KÜÇÜKYALI' },
      { sira: 14, ad: 'ÇEKMEKÖY' },
    ],
  },
]

/**
 * TOSB — Elif'in kararı: personelsiz güzergâh olarak TANIMLI KALACAK.
 * Göç sözlüğü 'TOSB SERVİS' → 'TOSB' bekliyor; güzergâh yoksa o satırlar
 * --apply'da hata verir.
 *
 * TODO(idari-isler): TOSB'un durak listesi alınmadı. Şu an duraksız
 * tanımlanıyor — güzergâh var, durağı yok. Personeli olmadığı için göçü
 * etkilemiyor; durak listesi gelince buraya eklenecek.
 */
export const TOSB: GuzergahTanimi = { kod: 'TOSB', ad: 'TOSB Servisi', duraklar: [] }

export const TUM_GUZERGAHLAR: GuzergahTanimi[] = [...GUZERGAHLAR, TOSB]

// ----------------------------------------------------------------------------
// DURAK EŞLEME TABLOSU — İdari İşler teyidi
// ----------------------------------------------------------------------------
//
// `hamMetin` = Personnel kaydındaki serbest metin. EŞLEŞTİRME ANAHTARIDIR,
// asla değiştirilmez. `hedef` = o metnin bağlanacağı durağın adı.
// Aynı hedefi taşıyan satırlar aynı durağa gider (51 satır → 44 ayrı hedef).
//
// Bu tablo şimdilik KODDA. Kalıcı yeri bir alias tablosudur (öneri verildi,
// enum'a DURAK_ALIAS eklemek migration gerektiriyor — Melih).
//
// 🔴 10 satırda İdari İşler anahtar sütununu üzerine yazmıştı; buradaki
// `hamMetin` ORİJİNAL değerdir, satır numarasıyla geri eşleştirildi.
export type DurakEsleme = {
  /** tablodaki satır numarası — geri izlenebilirlik için */
  satir: number
  guzergah: string
  /** Personnel'deki ham metin — eşleştirme anahtarı, DEĞİŞTİRİLMEZ */
  hamMetin: string
  kisi: number
  hedef: string
}

export const DURAK_ESLEME: DurakEsleme[] = [
  // ARAPCESME
  { satir: 1, guzergah: 'ARAPCESME', hamMetin: 'H. YOLU', kisi: 1, hedef: 'Hal Yolu' },
  { satir: 2, guzergah: 'ARAPCESME', hamMetin: 'CEZAEVİ KAPISI', kisi: 3, hedef: 'Cezaevi' },
  { satir: 3, guzergah: 'ARAPCESME', hamMetin: 'MUTLUKENT', kisi: 1, hedef: 'MUTLUKENT' },
  { satir: 4, guzergah: 'ARAPCESME', hamMetin: 'YENİKENT MUTLUKENT', kisi: 1, hedef: 'MUTLUKENT' },
  { satir: 5, guzergah: 'ARAPCESME', hamMetin: 'ANADOLU LİSESİ', kisi: 1, hedef: 'ANADOLU LİSESİ' },
  { satir: 7, guzergah: 'ARAPCESME', hamMetin: 'ARAP ÇEŞME SEHLL PETROL', kisi: 1, hedef: 'ARAP ÇEŞME SEHLL PETROL' },
  { satir: 8, guzergah: 'ARAPCESME', hamMetin: 'İLBEYOĞLU', kisi: 1, hedef: 'İLBEYOĞLU' },
  // BEYLIKBAGI_GUZELTEPE
  { satir: 11, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'FENİŞ IŞIK', kisi: 1, hedef: 'Feniş Işıklar' },
  { satir: 12, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'ADEM YAVUZ TRAFO', kisi: 4, hedef: 'Trafo' },
  { satir: 13, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'ÇİÇEKÇİLER Y.SULTAN SELİM DURAĞI', kisi: 1, hedef: 'Çiçekçiler' },
  { satir: 16, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'YAVUZ SULTAN SELİM DURAĞI', kisi: 1, hedef: 'YAVUZ SELİM DURAĞI' },
  // BEYLIKBAGI_ULASTEPE
  { satir: 17, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: 'YAVUZ SELİM DURAĞI', kisi: 2, hedef: 'YAVUZ SELİM DURAĞI' },
  { satir: 18, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: '23 NİSAN CAD. HAKMAR', kisi: 1, hedef: '23 NİSAN CAD. HAKMAR' },
  { satir: 19, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: 'SARI CAMİİ', kisi: 1, hedef: 'SARI CAMİİ' },
  { satir: 20, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: 'BEYLİKBAĞI HAKMAR', kisi: 1, hedef: '23 NİSAN CAD. HAKMAR' },
  { satir: 21, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: 'ULAŞTEPE ZİRVE MARKET', kisi: 1, hedef: 'ULAŞTEPE ZİRVE MARKET' },
  { satir: 22, guzergah: 'BEYLIKBAGI_ULASTEPE', hamMetin: 'YILDIZ MARKET', kisi: 1, hedef: 'YILDIZ MARKET' },
  // DARICA
  { satir: 23, guzergah: 'DARICA', hamMetin: 'CUMHURİYET MEYDANI', kisi: 3, hedef: 'Cumhuriyet Meydan' },
  { satir: 24, guzergah: 'DARICA', hamMetin: '60. YIL İÖÖ', kisi: 2, hedef: '60. yıl orta okulu' },
  { satir: 25, guzergah: 'DARICA', hamMetin: 'GARANTİ', kisi: 1, hedef: 'Garanti Bank.' },
  { satir: 26, guzergah: 'DARICA', hamMetin: 'TUZLA CAD', kisi: 1, hedef: 'Tuzla Cad. Remax Önü' },
  { satir: 30, guzergah: 'DARICA', hamMetin: 'İTFAİYE', kisi: 2, hedef: 'İTFAİYE' },
  { satir: 32, guzergah: 'DARICA', hamMetin: 'BAYRAMOĞLU KARAKOL', kisi: 1, hedef: 'DARICA EMNİYET MÜDÜRLÜĞÜ' },
  { satir: 35, guzergah: 'DARICA', hamMetin: 'SULTAN PASTANESİ ÜST YOL', kisi: 1, hedef: 'SULTAN PASTANESİ ÜST YOL' },
  { satir: 36, guzergah: 'DARICA', hamMetin: 'UNTEX', kisi: 1, hedef: 'UNTEX' },
  // GEBZE_DEVELI
  { satir: 37, guzergah: 'GEBZE_DEVELI', hamMetin: 'K.ÇEŞME BİM KARŞISI', kisi: 2, hedef: 'Köşklü Çeşme Bim Karşısı' },
  { satir: 39, guzergah: 'GEBZE_DEVELI', hamMetin: 'EŞREF BİTLİS PARKI (A101)', kisi: 1, hedef: 'Eşref Bitlis Parkı (A101 önü)' },
  { satir: 40, guzergah: 'GEBZE_DEVELI', hamMetin: 'SİSTEM ELEKTRİK', kisi: 1, hedef: 'Sistem Elektrik (Develi)' },
  { satir: 41, guzergah: 'GEBZE_DEVELI', hamMetin: 'KÖŞKLÜÇEŞME', kisi: 5, hedef: 'Köşklü Çeşme Bim Karşısı' },
  { satir: 44, guzergah: 'GEBZE_DEVELI', hamMetin: 'FEVZİ ÇAKMAK CAD.', kisi: 1, hedef: 'Osman Yılmaz (Fevzi Çakmak Cad.)' },
  { satir: 45, guzergah: 'GEBZE_DEVELI', hamMetin: 'EŞREF BİTLİS BİM ÖNÜ', kisi: 1, hedef: 'Eşref Bitlis Parkı (A101 önü)' },
  // KAVACIK_BEYKOZ
  { satir: 46, guzergah: 'KAVACIK_BEYKOZ', hamMetin: 'ANADOLU HİSARI', kisi: 1, hedef: 'ANADOLU HİSARI' },
  // KAYNARCA_KARTAL
  { satir: 47, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'İÇMELER KÖPRÜSÜ', kisi: 2, hedef: 'İÇMELER KÖPRÜSÜ' },
  { satir: 48, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'KARTAL BETON YOL', kisi: 1, hedef: 'KARTAL BETON YOL' },
  { satir: 49, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'ŞİFA TEL BOYU', kisi: 4, hedef: 'ŞİFA TEL BOYU' },
  { satir: 50, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'TEPE BAŞI', kisi: 2, hedef: 'Tepebaşı Cami' },
  { satir: 51, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'AYDINTEPE METRO', kisi: 1, hedef: 'AYDINTEPE METRO' },
  { satir: 52, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'ADNAN KAHVECİ', kisi: 2, hedef: 'ADNAN KAHVECİ' },
  { satir: 53, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'ADNAN KAHVECİ KÖPRÜSÜ', kisi: 1, hedef: 'ADNAN KAHVECİ' },
  { satir: 54, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'ESENYALI', kisi: 2, hedef: 'ESENYALI' },
  { satir: 55, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'ASSAN ÜST GEÇİDİ', kisi: 1, hedef: 'ASSAN ÜST GEÇİDİ' },
  { satir: 56, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'AYTEMİZ PETROL', kisi: 1, hedef: 'AYTEMİZ PETROL' },
  { satir: 57, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'EROL GÜNGÖR İÖÖ', kisi: 1, hedef: 'EROL GÜNGÖR İÖÖ' },
  { satir: 58, guzergah: 'KAYNARCA_KARTAL', hamMetin: 'TOPSELVİ', kisi: 1, hedef: 'TOPSELVİ' },
  // USKUDAR
  { satir: 59, guzergah: 'USKUDAR', hamMetin: 'KOZYATAĞI', kisi: 1, hedef: 'Kozyatağı Metro' },
  { satir: 60, guzergah: 'USKUDAR', hamMetin: 'ZEYNEP KAMİL', kisi: 1, hedef: 'Zeynep Kamil Kavşak' },
  { satir: 61, guzergah: 'USKUDAR', hamMetin: 'MAVİEVLER-KÜÇÜKYALI', kisi: 3, hedef: 'MAVİEVLER-KÜÇÜKYALI' },
  { satir: 62, guzergah: 'USKUDAR', hamMetin: 'RİTİM - ESENKENT', kisi: 1, hedef: 'Esenkent Metro' },
  { satir: 63, guzergah: 'USKUDAR', hamMetin: 'RİTİM ESENKENT', kisi: 1, hedef: 'Esenkent Metro' },
  { satir: 64, guzergah: 'USKUDAR', hamMetin: 'ZEYNEP KAMİL / ECZANE ÖNÜ', kisi: 1, hedef: 'Zeynep Kamil Kavşak' },
  { satir: 65, guzergah: 'USKUDAR', hamMetin: 'ÇEKMEKÖY', kisi: 1, hedef: 'ÇEKMEKÖY' },
  // ----------------------------------------------------------------------
  // 🔴 Elif kararı (2026-09-29) — İdari İşler'in 1. tur ACIK_MADDELER'ine
  // (A1-A8) karşılık, TEYIT_BEKLIYOR ile işaretli. Bkz. o sabit.
  // ----------------------------------------------------------------------
  // A3 — ERİŞ kümesi -> ERİŞ DURAĞI (madde 5 kapandı): DARICA ERİŞ DURAĞI
  // zaten mevcut "Eriş Durağı" (sıra 7) durağına karşılık geliyor.
  { satir: 27, guzergah: 'DARICA', hamMetin: 'DARICA ERİŞ DURAĞI', kisi: 1, hedef: 'Eriş Durağı' },
  // A1 — MEZBAHANE -> MEZBAHANE DURAĞI (madde 3 kapandı): ikisi de mevcut
  // "Mezbahane Ediş Yapı" (sıra 12) durağına karşılık geliyor.
  { satir: 28, guzergah: 'DARICA', hamMetin: 'MEZBAHANE DURAĞI', kisi: 1, hedef: 'Mezbahane Ediş Yapı' },
  { satir: 34, guzergah: 'DARICA', hamMetin: 'MEZBAHANE EDİŞ YAPI', kisi: 1, hedef: 'Mezbahane Ediş Yapı' },
  // A2 — AKSE üçlüsü -> DURAK PASTANESİ (madde 4 kapandı): üçü de mevcut
  // "Akse Sapağı Durak Pastanesi" (sıra 8) durağına karşılık geliyor.
  { satir: 38, guzergah: 'GEBZE_DEVELI', hamMetin: 'AKSE SAP DURAK PASTA', kisi: 1, hedef: 'Akse Sapağı Durak Pastanesi' },
  { satir: 42, guzergah: 'GEBZE_DEVELI', hamMetin: 'AKSE SAPAĞI', kisi: 1, hedef: 'Akse Sapağı Durak Pastanesi' },
  { satir: 43, guzergah: 'GEBZE_DEVELI', hamMetin: 'DURAK PASTANESİ', kisi: 1, hedef: 'Akse Sapağı Durak Pastanesi' },
  // A8 — GÜNSAŞ FIRIN: Personnel metni kendi (yeni) durağı.
  { satir: 6, guzergah: 'ARAPCESME', hamMetin: 'GÜNSAŞ FIRIN', kisi: 1, hedef: 'GÜNSAŞ FIRIN' },
  // A6/A7 — ŞEKERPINAR: iki metin, iki ayrı (yeni) durak.
  { satir: 9, guzergah: 'AYDOS_KURTKOY', hamMetin: 'ŞEKERPINAR TOKİ', kisi: 4, hedef: 'ŞEKERPINAR TOKİ' },
  { satir: 10, guzergah: 'AYDOS_KURTKOY', hamMetin: 'ŞEKERPINAR KÖY İÇİ', kisi: 1, hedef: 'ŞEKERPINAR KÖY İÇİ' },
  // A4/A5 — GÜL PASTANESİ, KARAKOL: Personnel metni kendi (yeni) durağı.
  { satir: 14, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'GÜL PASTANESİ', kisi: 2, hedef: 'GÜL PASTANESİ' },
  { satir: 15, guzergah: 'BEYLIKBAGI_GUZELTEPE', hamMetin: 'KARAKOL', kisi: 1, hedef: 'KARAKOL' },
  // A5 — ERİŞ DURAĞI (İdari İşler 1. tur cevabı): 2026-09-28 tarihli formda bu
  // üç metin "ERİŞ DURAĞI" olarak yazılmıştı. Hedef mevcut "Eriş Durağı" (sıra 7).
  // Hamlar Personnel'deki TAM metindir (Türkçe karakterli, değiştirilmedi).
  // Üçü de A5 formRef'iyle TEYIT_BEKLIYOR (madde A3) kapsamında kalır.
  { satir: 29, guzergah: 'DARICA', hamMetin: 'TAKSİ DURAĞI', kisi: 1, hedef: 'Eriş Durağı' },
  { satir: 31, guzergah: 'DARICA', hamMetin: 'BAĞLARBAŞI PETROL OFİSİ DARICA', kisi: 1, hedef: 'Eriş Durağı' },
  { satir: 33, guzergah: 'DARICA', hamMetin: 'MARAŞ DONDURMA', kisi: 1, hedef: 'Eriş Durağı' },
]

// ----------------------------------------------------------------------------
// 🔴 EŞLEMESİ AÇIK SATIRLAR — hedef VERİLMEDİ, uydurulmadı
// ----------------------------------------------------------------------------
//
// Şu an 0 satır: DARICA'daki son üç açık satır (TAKSİ DURAĞI, BAĞLARBAŞI
// PETROL OFİSİ DARICA, MARAŞ DONDURMA) İdari İşler cevabıyla "Eriş Durağı"na
// bağlandı ve DURAK_ESLEME'ye taşındı. Yeni açık satır çıkarsa buraya eklenir;
// göç script'i bunları durağa BAĞLAMAZ, eşleşmeyen listesinde bırakır.
export const ESLEME_ACIK: readonly {
  satir: number
  guzergah: string
  hamMetin: string
  kisi: number
}[] = []

// ----------------------------------------------------------------------------
// 🔴 OLASI YİNELENEN ÇİFTLER — KARAR TABANI, birleştirme YAPILMADI
// ----------------------------------------------------------------------------
//
// 133 durak adının HEPSİ ikişerli karşılaştırıldı (yalnız yeni eklenenler
// değil). Üç bağımsız yöntem, hepsi Türkçe normalize sonrası:
//   1. Levenshtein  — yazım hatası      (Unteks / UNTEX)
//   2. Jaccard, SIRA BAĞIMSIZ kelime kümesi — sıra değişimi
//                                        (Tel Boyu Şifa / ŞİFA TEL BOYU)
//   3. ön ek / kısaltma                  (Köp. / KÖPRÜSÜ, Cd. / CAD.)
// Yöntem bilinen pozitiflerde (SARI CAMİİ/Sarı Cami, ŞİFA TEL BOYU/
// Tel Boyu Şifa, UNTEX/Unteks) doğrulandı; negatif kontrol temiz.
// Farklı güzergâhtaki aynı adlar KAPSAM DIŞI (ör. 'Garanti Bankası' iki
// güzergâhta normaldir).
//
// `grup` neden önemli:
//   ESKI    — iki ad da referans verisinden. İdari İşler'in yazdığı bir
//             şeyden GELMİYOR; referans verisinin kendi sorunu.
//   KARISIK — biri referans verisinden, biri İdari İşler hedefinden.
//   YENI    — ikisi de İdari İşler hedefinden. (Bugün hiç yok.)
//
// `kanaat` ÖLÇÜM DEĞİL, yorumdur. `skor` ölçümdür.
//
// TODO(elif): her çift için karar.
//   'aynı yer'  → ikinci durak silinir, ham metinler ilkine bağlanır
//   'farklı yer'→ satır bu listeden düşer
// Karar gelene kadar hiçbir şey birleştirilmedi.
export type YinelenenCift = {
  grup: 'ESKI' | 'KARISIK' | 'YENI'
  guzergah: string
  a: { sira: number; ad: string }
  b: { sira: number; ad: string }
  tur: string
  /** 0–1, ölçüm */
  skor: number
  /** true ise güçlü eşiğin altında kaldı, bilgi için listede */
  esikAlti: boolean
  kanaat: 'aynı yer' | 'muhtemelen aynı' | 'belirsiz' | 'farklı yer'
  gerekce: string
}

export const OLASI_YINELENEN_CIFTLER: YinelenenCift[] = [
  // ---- ESKI ----
  {
    grup: 'ESKI',
    guzergah: 'DARICA',
    a: { sira: 3, ad: 'Mehmet Akif' },
    b: { sira: 8, ad: 'Mehmet Akif' },
    tur: 'yazım yakın + kelime kümesi',
    skor: 1.0,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      'Aynı ad iki sırada. Gidiş/dönüş aynı nokta mı, iki ayrı yer mi veriden anlaşılmıyor.',
  },
  {
    grup: 'ESKI',
    guzergah: 'USKUDAR',
    a: { sira: 2, ad: 'Üsküdar' },
    b: { sira: 4, ad: 'Üsküdar' },
    tur: 'yazım yakın + kelime kümesi',
    skor: 1.0,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      'Aynı ad iki sırada. Gidiş/dönüş aynı nokta mı, iki ayrı yer mi veriden anlaşılmıyor.',
  },
  {
    grup: 'ESKI',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 10, ad: 'Tel Boyu' },
    b: { sira: 12, ad: 'Tel Boyu Şifa' },
    tur: 'kelime kümesi',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      '\'Şifa\' ayrı bir noktayı mı niteliyor, yoksa aynı durağın uzun adı mı. ŞİFA TEL BOYU (15) ile birlikte çözülmeli.',
  },
  {
    grup: 'ESKI',
    guzergah: 'BEYLIKBAGI_ULASTEPE',
    a: { sira: 8, ad: 'Aşık Mahsuni Parkı' },
    b: { sira: 14, ad: 'Mahsuni Şerif Parkı' },
    tur: 'kelime kümesi',
    skor: 0.5,
    esikAlti: false,
    kanaat: 'farklı yer',
    gerekce:
      'Aynı kişinin adını taşıyan iki ayrı park. Adlar birbirinin yazım varyantı değil.',
  },
  {
    grup: 'ESKI',
    guzergah: 'DARICA',
    a: { sira: 6, ad: 'Eriş' },
    b: { sira: 7, ad: 'Eriş Durağı' },
    tur: 'kelime kümesi',
    skor: 0.5,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      'Ardışık sıra. Açık maddelerdeki ERİŞ kümesiyle aynı konu, İdari İşler cevabı bekliyor.',
  },
  {
    grup: 'ESKI',
    guzergah: 'GEBZE_DEVELI',
    a: { sira: 7, ad: 'Eşref Bitlis Parkı (A101 önü)' },
    b: { sira: 10, ad: 'Eşref Bitlis Bim Önü' },
    tur: 'kelime kümesi',
    skor: 0.5,
    esikAlti: false,
    kanaat: 'farklı yer',
    gerekce:
      'Ortak kısım park adı; ayırt edici kısım farklı (A101 / BİM).',
  },
  {
    grup: 'ESKI',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 3, ad: 'Çamçeşme Park' },
    b: { sira: 4, ad: 'Çamçeşme' },
    tur: 'kelime kümesi',
    skor: 0.5,
    esikAlti: false,
    kanaat: 'farklı yer',
    gerekce:
      'Ardışık sıra. Park, semtten ayrı bir duruş noktası olabilir.',
  },
  // ---- KARISIK ----
  {
    grup: 'KARISIK',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 12, ad: 'Tel Boyu Şifa' },
    b: { sira: 15, ad: 'ŞİFA TEL BOYU' },
    tur: 'kelime sırası farklı',
    skor: 1.0,
    esikAlti: false,
    kanaat: 'aynı yer',
    gerekce:
      'Aynı üç kelime, yalnız sıra farklı.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'BEYLIKBAGI_ULASTEPE',
    a: { sira: 3, ad: '23 Nisan Cd. Hakmar' },
    b: { sira: 16, ad: '23 NİSAN CAD. HAKMAR' },
    tur: 'yazım yakın + kelime kümesi',
    skor: 0.94,
    esikAlti: false,
    kanaat: 'aynı yer',
    gerekce:
      '\'Cd.\' ve \'CAD.\' aynı kısaltma; geri kalan birebir aynı.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'BEYLIKBAGI_ULASTEPE',
    a: { sira: 1, ad: 'Sarı Cami' },
    b: { sira: 17, ad: 'SARI CAMİİ' },
    tur: 'kısaltma + yazım yakın',
    skor: 0.9,
    esikAlti: false,
    kanaat: 'aynı yer',
    gerekce:
      'Tek fark \'cami/camii\' imlası.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 7, ad: 'İçmeler Köp.' },
    b: { sira: 13, ad: 'İÇMELER KÖPRÜSÜ' },
    tur: 'kısaltma',
    skor: 0.9,
    esikAlti: false,
    kanaat: 'muhtemelen aynı',
    gerekce:
      'Kısaltmanın açılmış hâli. Ancak aynı güzergâhta \'İçmeler Durağı\' (8) da var; köprü ile durak ayrı noktalar olabilir.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'DARICA',
    a: { sira: 14, ad: 'Unteks' },
    b: { sira: 18, ad: 'UNTEX' },
    tur: 'yazım yakın',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'aynı yer',
    gerekce:
      'Firma adı, biri yanlış yazılmış (2 harf).',
  },
  {
    grup: 'KARISIK',
    guzergah: 'BEYLIKBAGI_ULASTEPE',
    a: { sira: 5, ad: 'Yavuz Selim' },
    b: { sira: 15, ad: 'YAVUZ SELİM DURAĞI' },
    tur: 'kelime kümesi',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'muhtemelen aynı',
    gerekce:
      '\'Durağı\' ayırt edici bilgi taşımıyor.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'BEYLIKBAGI_ULASTEPE',
    a: { sira: 12, ad: 'Zirve Market' },
    b: { sira: 18, ad: 'ULAŞTEPE ZİRVE MARKET' },
    tur: 'kelime kümesi',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'muhtemelen aynı',
    gerekce:
      '\'Ulaştepe\' güzergâhın kendi adı, ayırt edici değil. Ancak aynı güzergâhta \'Ulaştepe\' (4) adlı ayrı bir durak var.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 1, ad: 'Beton Yol' },
    b: { sira: 14, ad: 'KARTAL BETON YOL' },
    tur: 'kelime kümesi',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      '\'Kartal\' ilçe öneki mi, yoksa ayrı bir noktayı mı gösteriyor.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'KAYNARCA_KARTAL',
    a: { sira: 10, ad: 'Tel Boyu' },
    b: { sira: 15, ad: 'ŞİFA TEL BOYU' },
    tur: 'kelime kümesi',
    skor: 0.67,
    esikAlti: false,
    kanaat: 'belirsiz',
    gerekce:
      'Üçüncü çiftin aynısı. Üç ad (Tel Boyu, Tel Boyu Şifa, ŞİFA TEL BOYU) birlikte çözülmeli.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'ARAPCESME',
    a: { sira: 13, ad: 'Yapı Kredi / Mutlukent' },
    b: { sira: 15, ad: 'MUTLUKENT' },
    tur: 'ZAYIF ortak kelime',
    skor: 0.33,
    esikAlti: true,
    kanaat: 'muhtemelen aynı',
    gerekce:
      '\'Mutlukent\' tam olarak geçiyor; \'Yapı Kredi\' aynı noktanın ikinci tarifi olabilir. Kelime kümesi eşiğinin ALTINDA.',
  },
  {
    grup: 'KARISIK',
    guzergah: 'USKUDAR',
    a: { sira: 10, ad: 'Mavi Evler' },
    b: { sira: 13, ad: 'MAVİEVLER-KÜÇÜKYALI' },
    tur: 'ZAYIF dizge içerme',
    skor: 0.4,
    esikAlti: true,
    kanaat: 'muhtemelen aynı',
    gerekce:
      'Normalize edilince biri diğerinin ön eki; \'-Küçükyalı\' semt eki. Kelime kümesi eşiğinin ALTINDA.',
  },
]


// ----------------------------------------------------------------------------
// 🔴 AÇIK MADDELER — İdari İşler'e soruldu, cevap BEKLENİYOR
// ----------------------------------------------------------------------------
//
// Bu maddeler paketin ŞEKLİNİ değiştirmiyor, yalnız birkaç satırını.
// Hiçbirine varsayılan UYDURULMADI. Cevap gelince ilgili güzergâhın
// `duraklar` dizisine eklenir/düzeltilir ve buradan silinir.
//
// 🔴 İKİ LİSTE VAR, KARIŞTIRMA:
//   - ACIK_MADDELER (burası) = SORU düzeyi, 6 soru. Her birinin NE olduğunu
//     (çelişki mi, anlaşılmadı mı, ad teyidi mi) söyler.
//   - ESLEME_ACIK = SATIR düzeyi. Göç script'inin fiilen eşleştiremeyeceği
//     satırlar bunlardır (şu an boş).
// Bir soru birden çok ham metni kapsayabilir; eşleme tablosunda 6 soruda adı
// geçmeyen satırlar da vardı (TAKSİ DURAĞI, BAĞLARBAŞI PETROL OFİSİ DARICA,
// MARAŞ DONDURMA) — bunlar A5 cevabıyla Eriş Durağı'na bağlandı.
//
// Dışa açık, çünkü test bu listenin boşalmadığını (ve boşaldığında
// hatırlatıldığını) kontrol edebilsin.
export const ACIK_MADDELER = [
  // TODO(idari-isler) 1 — GÜL PASTANESİ (2 kişi) ve KARAKOL (1 kişi), Beylikbağı-Güzeltepe: cevap gelmedi.
  { no: 1, guzergah: 'BEYLIKBAGI_GUZELTEPE', konu: 'GÜL PASTANESİ + KARAKOL', kisi: 3, durum: 'cevapsız' },
  // TODO(idari-isler) 2 — ŞEKERPINAR: sayfa 1 iki ad veriyor, sayfa 2 "tek durak" diyor. Çelişki.
  { no: 2, guzergah: 'AYDOS_KURTKOY', konu: 'ŞEKERPINAR TOKİ / KÖY İÇİ — tek durak mı iki mi', kisi: 5, durum: 'çelişki' },
  // TODO(idari-isler) 3 — MEZBAHANE: "FARKLI AD" yazılmış, ne kastedildiği anlaşılmadı.
  { no: 3, guzergah: 'DARICA', konu: 'MEZBAHANE DURAĞI / MEZBAHANE EDİŞ YAPI', kisi: 2, durum: 'anlaşılmadı' },
  // TODO(idari-isler) 4 — AKSE üçlüsü: kanonik ad hangisi.
  { no: 4, guzergah: 'GEBZE_DEVELI', konu: 'AKSE SAPAĞI / AKSE SAP DURAK PASTA / DURAK PASTANESİ', kisi: 3, durum: 'kanonik ad belirsiz' },
  // TODO(idari-isler) 5 — ERİŞ kümesi: 5 metin kaç ayrı durağa denk geliyor.
  { no: 5, guzergah: 'DARICA', konu: 'ERİŞ DURAĞI / DARICA ERİŞ DURAĞI + 3 varyant', kisi: 5, durum: 'kaç durak belirsiz' },
  // TODO(idari-isler) 6 — GÜNSAŞ FIRIN: ad teyidi (dev\'de "Kaşkar Fırın" var).
  { no: 6, guzergah: 'ARAPCESME', konu: 'GÜNSAŞ FIRIN — ad teyidi', kisi: 1, durum: 'teyit bekliyor' },
] as const

// ----------------------------------------------------------------------------
// 🔴 BELİRSİZ DURAK ÇİFTLERİ — ayrı konu, İdari İşler maddelerinden DEĞİL
// ----------------------------------------------------------------------------
//
// Bu iki ad kendi güzergâhında İKİ KEZ geçiyor. Kod eşleştirmesi için sorun
// değil (kod `<güzergâh>-<sıra>`, yani hâlâ benzersiz); METİN eşleştirmesi
// için belirsiz — göç script'i bir ada baktığında hangi sırayı seçeceğini
// bilemez.
//
// Ölçüldü: dev'de `Personnel` tablosu boş olduğu için bu belirsizliğin
// bugün kaç kişiyi etkilediği ÖLÇÜLEMEDİ. Teorik mi gerçek mi, prod
// verisi görülmeden bilinmiyor.
//
// TODO(elif): gidiş/dönüş aynı durak mı, yoksa iki ayrı yer mi?
//   - Aynı yerse: ikinci sıra silinir, sıralar kaydırılır.
//   - Ayrı yerse: adlar ayrıştırılır (ör. "Mehmet Akif Giriş" / "Mehmet Akif Çıkış").
// Karar gelene kadar veri OLDUĞU GİBİ bırakıldı — uydurma ayrım yapılmadı.
export const BELIRSIZ_DURAKLAR = [
  { guzergah: 'DARICA', ad: 'Mehmet Akif', siralar: [3, 8] },
  { guzergah: 'USKUDAR', ad: 'Üsküdar', siralar: [2, 4] },
] as const

// ----------------------------------------------------------------------------
// 🔴 TEYIT_BEKLIYOR — Elif kararı (2026-09-29): tanım paketi İdari İşler
// cevaplarını BEKLEMEDEN sonlandırıldı. Bu sabit, resmi teyit yerine geçen
// PRATİK kararların TEK, birleşik envanteri — göç raporunda ve (ServisDurak'ta
// not alanı olmadığı için, bkz. seed başlığı) seed özetinde ayrı bir liste
// olarak basılır. Migration YOK, DB'ye "TEYİT BEKLİYOR" yazılmaz.
//
// 1. tur (A1-A8) = ACIK_MADDELER'in (6 soru) alt-kararlara bölünmüş hâli:
//   A1-A3: kanonik ada karar verildi, mevcut duraklara bağlandı (DURAK_ESLEME).
//   A4-A8: Personnel metni kendi durağı sayıldı, YENİ durak (GUZERGAHLAR),
//          sırası GEÇİCİ (güzergâhın mevcut max'ından devam).
// 2. tur (B1-B18) = OLASI_YINELENEN_CIFTLER'in kendisi (18 kayıt).
//   🔴 Talimatta "B1-B13" deniyordu; ölçülen gerçek sayı 18 (16 güçlü + 2
//   eşik altı) — muhtemelen ilk turun güçlü-çift sayısına (16'ya yakın bir
//   ara ölçüm) atıfta bulunuyordu. B1-B18 olarak numaralandırıldı, hiçbiri
//   dışarıda bırakılmadı.
export interface TeyitBekleyenKarar {
  madde: string
  formRef: string
  guzergah: string
  konu: string
  durum: 'yeni durak (geçici sıra)' | 'mevcut durağa bağlandı' | 'iki kayıt korunur, birleştirilmedi'
}

// 🔴 FORM_REF_ESLEME — İdari İşler'in resmi form numaraları (Elif, 2026-09-29)
// bu dosyanın kendi `madde` (A1-A8/B1-B18) numaralarıyla BİREBİR ÖRTÜŞMÜYOR:
// resmi taraf bazı maddeleri TEK numarada birleştiriyor (ör. resmi A1 = GÜL
// PASTANESİ + KARAKOL = burada ayrı A4 + A5; resmi B1 = Tel Boyu üçlüsü =
// burada ayrı B3 + B8 + B16) ve B sırası tamamen farklı numaralandırılmış.
// Eşleme, her resmi maddenin konu metniyle OLASI_YINELENEN_CIFTLER'daki
// içerik karşılaştırılarak çıkarıldı — uydurma YOK, birebir metin eşleşmesi.
// Not: Eriş(6)/Eriş Durağı(7) çifti (buradaki hem A3 hem B5) resmi tarafta
// TEK maddeye (A5) bağlanıyor; bu satır aşağıda ayrıca belirtildi.
const FORM_REF_ESLEME: Record<string, string> = {
  A1: 'A3', A2: 'A4', A3: 'A5', A4: 'A1', A5: 'A1', A6: 'A2', A7: 'A2', A8: 'A6',
  B1: 'A7', B2: 'A8', B3: 'B1', B4: 'B2', B5: 'A5', B6: 'B3', B7: 'B4', B8: 'B1',
  B9: 'B5', B10: 'B6', B11: 'B7', B12: 'B8', B13: 'B9', B14: 'B10', B15: 'B11',
  B16: 'B1', B17: 'B12', B18: 'B13',
}

const TEYIT_BEKLIYOR_HAM: Omit<TeyitBekleyenKarar, 'formRef'>[] = [
  // --- 1. tur — A1-A8 ---
  { madde: 'A1', guzergah: 'DARICA', konu: 'MEZBAHANE DURAĞI / MEZBAHANE EDİŞ YAPI → "Mezbahane Ediş Yapı" (mevcut, sıra 12)', durum: 'mevcut durağa bağlandı' },
  { madde: 'A2', guzergah: 'GEBZE_DEVELI', konu: 'AKSE SAPAĞI / AKSE SAP DURAK PASTA / DURAK PASTANESİ → "Akse Sapağı Durak Pastanesi" (mevcut, sıra 8)', durum: 'mevcut durağa bağlandı' },
  { madde: 'A3', guzergah: 'DARICA', konu: 'ERİŞ kümesi + TAKSİ DURAĞI / BAĞLARBAŞI PETROL OFİSİ DARICA / MARAŞ DONDURMA → "Eriş Durağı" (mevcut, sıra 7)', durum: 'mevcut durağa bağlandı' },
  { madde: 'A4', guzergah: 'BEYLIKBAGI_GUZELTEPE', konu: 'GÜL PASTANESİ — Personnel metni kendi durağı', durum: 'yeni durak (geçici sıra)' },
  { madde: 'A5', guzergah: 'BEYLIKBAGI_GUZELTEPE', konu: 'KARAKOL — Personnel metni kendi durağı', durum: 'yeni durak (geçici sıra)' },
  { madde: 'A6', guzergah: 'AYDOS_KURTKOY', konu: 'ŞEKERPINAR TOKİ — iki metinden biri, ayrı durak', durum: 'yeni durak (geçici sıra)' },
  { madde: 'A7', guzergah: 'AYDOS_KURTKOY', konu: 'ŞEKERPINAR KÖY İÇİ — iki metinden biri, ayrı durak', durum: 'yeni durak (geçici sıra)' },
  { madde: 'A8', guzergah: 'ARAPCESME', konu: 'GÜNSAŞ FIRIN — Personnel metni esas, dev\'deki "Kaşkar Fırın" değil', durum: 'yeni durak (geçici sıra)' },
  // --- 2. tur — B1-B18 (OLASI_YINELENEN_CIFTLER'in kendisi, birleştirme yok) ---
  ...OLASI_YINELENEN_CIFTLER.map((c, i) => ({
    madde: `B${i + 1}`,
    guzergah: c.guzergah,
    konu: `${c.a.ad} (sıra ${c.a.sira}) / ${c.b.ad} (sıra ${c.b.sira}) — kanaat: ${c.kanaat}`,
    durum: 'iki kayıt korunur, birleştirilmedi' as const,
  })),
]

export const TEYIT_BEKLIYOR: TeyitBekleyenKarar[] = TEYIT_BEKLIYOR_HAM.map((t) => ({
  ...t,
  formRef: FORM_REF_ESLEME[t.madde],
}))

// ----------------------------------------------------------------------------
// 🔴 ARAÇLAR — dev DB'den ölçüldü (2026-09-29): 9 araç, plaka benzersiz.
// ----------------------------------------------------------------------------
//
// ŞOFÖR EKLENMEDİ (kişisel veri, git'e girmez — Elif kararı, 2026-09-29).
// Idempotent anahtar `kod` DEĞİL `plaka` (ServisArac'ta kod alanı yok, plaka
// UNIQUE) — talimattaki "kod ile idempotent" ifadesi burada plaka karşılığı.
//
// 🔴 FİRMA — dev'de araçlar TEK firmaya değil İKİ firmaya bağlı (ölçüldü):
// 8 araç "Taşeron Firma A (Genel)", 1 araç (34LYL484) "Taşeron Firma B
// (Kaynarca-Kartal)". Seed script'in --firma-ad parametresi TEK firma alır
// (yerleşke/firma başlığındaki tasarım). Araç verisi bu yüzden kendi
// firmaAd'ını taşır; seed bunu ayrı, plaka'dan bağımsız bir find-or-create
// ile çözer (aynı idempotent desen, --firma-ad akışından BAĞIMSIZ). Firma
// adlarının kendisi de PLACEHOLDER (İdari İşler'den gerçek ad bekleniyor) —
// bu metin YENİ bir placeholder İCAT ETMİYOR, dev DB'de zaten var olan
// metnin birebir kopyası.
export interface AracTanimi {
  plaka: string
  kapasite: number
  firmaAd: string
}

export const ARACLAR: AracTanimi[] = [
  { plaka: '34LAC828', kapasite: 15, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '34LDP316', kapasite: 27, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '34LUU645', kapasite: 15, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '34LYL484', kapasite: 27, firmaAd: 'Taşeron Firma B (PLACEHOLDER - Kaynarca-Kartal) - gerçek ad bekleniyor' },
  { plaka: '41P0145', kapasite: 15, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '41P0327', kapasite: 15, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '41P4607', kapasite: 27, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '41P5093', kapasite: 15, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
  { plaka: '41P5573', kapasite: 27, firmaAd: 'Taşeron Firma A (PLACEHOLDER - Genel) - gerçek ad bekleniyor' },
]

// ----------------------------------------------------------------------------
// 🔴 SEFER DİLİMLERİ — dev DB'den ölçüldü (2026-09-29): 2 dilim.
// ----------------------------------------------------------------------------
export interface SeferDilimiTanimi {
  kod: string
  ad: string
  yon: 'GIDIS' | 'DONUS'
  grupKodu: string
  sira: number
}

export const SEFER_DILIMLERI: SeferDilimiTanimi[] = [
  { kod: 'SABAH_GIDIS', ad: 'Sabah Servisi', yon: 'GIDIS', grupKodu: 'GUNDUZ', sira: 1 },
  { kod: 'AKSAM_DONUS', ad: 'Akşam Servisi', yon: 'DONUS', grupKodu: 'GUNDUZ', sira: 2 },
]

// ----------------------------------------------------------------------------
// 🔴 GÜZERGÂH → ARAÇ ANA VARSAYILAN ATAMASI — BOŞ (Elif kararı, 2026-09-29)
// ----------------------------------------------------------------------------
//
// Ölçüldü: dev'de servis_guzergah_arac_varsayilan şu an 0 satır. Elif
// güzergah/plaka listesini AYRICA iletecek; liste gelene kadar bu dizi
// BOŞ kalır ve seed hiçbir atama YAZMAZ.
//
// 🔴 DİLİM ZORUNLU ALAN: servis_guzergah_arac_varsayilan.dilimId NOT NULL
// (FK → servis_sefer_dilimi). Liste yalnız güzergah+plaka içeriyorsa, HANGİ
// dilime (SABAH_GIDIS mi, AKSAM_DONUS mu, ikisi birden mi — iki ayrı satır
// gerekir) yazılacağı liste ile birlikte AYRICA belirtilmeli; varsayım
// (örn. "ikisine de yaz") YAPILMADI. Ayrıca rol (ANA/YEDEK — burada yalnız
// ANA bekleniyor), baslangicTarihi ve createdById (User FK) de zorunlu;
// bunlar da liste ile birlikte netleşmeden seed yazamaz.
export interface GuzergahAracAnaAtamasi {
  guzergahKod: string
  plaka: string
  dilimKod: string
}

export const GUZERGAH_ARAC_ANA_ATAMA: GuzergahAracAnaAtamasi[] = []
