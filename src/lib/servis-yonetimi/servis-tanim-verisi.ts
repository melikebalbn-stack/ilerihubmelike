/**
 * SERVİS TANIM VERİSİ — güzergâh + durak listesi (tek kaynak)
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
// 🔴 AÇIK MADDELER — İdari İşler'e soruldu, cevap BEKLENİYOR
// ----------------------------------------------------------------------------
//
// Bu maddeler paketin ŞEKLİNİ değiştirmiyor, yalnız birkaç satırını.
// Hiçbirine varsayılan UYDURULMADI. Cevap gelince ilgili güzergâhın
// `duraklar` dizisine eklenir/düzeltilir ve buradan silinir.
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
