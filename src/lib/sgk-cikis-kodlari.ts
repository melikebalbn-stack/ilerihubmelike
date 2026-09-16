/**
 * SGK İşten Ayrılış Nedeni Kodları — TEK KAYNAK.
 *
 * Kaynak: Sosyal Sigorta İşlemleri Yönetmeliği Ek-14 "Sigortalı İşten Ayrılış Bildirgesi"
 * ekindeki "İşten Ayrılış Nedenleri" tablosu; son değişiklik SGK Genelgesi 2021/9
 * (01.04.2021, E-69053920-010.06.01-23171689): kod 29 kaldırıldı, 4857 SK 25/II alt
 * bentleri için 42–50 eklendi. 06, 07, 29 boş/kaldırılmış — listede YOK.
 * Doğrulama (16.09.2026): cottgroup.com ve muhasebetr.com güncel listeleriyle karşılaştırıldı.
 *
 * Kullanım: PersonnelExitModal seçim listesi + /api/personnel/[id] PATCH doğrulaması.
 * Eski EmploymentPeriod.exitCode kayıtları (İSTİFA, FESİH, …) serbest metin olarak KALIR;
 * geriye dönük doğrulama yapılmaz.
 */
export interface SgkCikisKodu {
  kod: string
  aciklama: string
  /** Kıdem tazminatı hakkı doğuran kodlar (bilgi amaçlı; iş kuralı değil). */
  kidem?: boolean
}

export const SGK_CIKIS_KODLARI: readonly SgkCikisKodu[] = [
  { kod: '01', aciklama: 'Deneme süreli iş sözleşmesinin işverence feshi' },
  { kod: '02', aciklama: 'Deneme süreli iş sözleşmesinin işçi tarafından feshi' },
  { kod: '03', aciklama: 'Belirsiz süreli iş sözleşmesinin işçi tarafından feshi (istifa)' },
  { kod: '04', aciklama: 'Belirsiz süreli iş sözleşmesinin işveren tarafından haklı sebep bildirilmeden feshi', kidem: true },
  { kod: '05', aciklama: 'Belirli süreli iş sözleşmesinin sona ermesi' },
  { kod: '08', aciklama: 'Emeklilik (yaşlılık) veya toptan ödeme nedeniyle', kidem: true },
  { kod: '09', aciklama: 'Malulen emeklilik nedeniyle', kidem: true },
  { kod: '10', aciklama: 'Ölüm', kidem: true },
  { kod: '11', aciklama: 'İş kazası sonucu ölüm', kidem: true },
  { kod: '12', aciklama: 'Askerlik', kidem: true },
  { kod: '13', aciklama: 'Kadın işçinin evlenmesi', kidem: true },
  { kod: '14', aciklama: 'Emeklilik için yaş dışında diğer şartların tamamlanması', kidem: true },
  { kod: '15', aciklama: 'Toplu işçi çıkarma', kidem: true },
  { kod: '16', aciklama: 'Sözleşme sona ermeden sigortalının aynı işverene ait diğer işyerine nakli' },
  { kod: '17', aciklama: 'İşyerinin kapanması', kidem: true },
  { kod: '18', aciklama: 'İşin sona ermesi', kidem: true },
  { kod: '19', aciklama: 'Mevsim bitimi (iş akdinin askıya alınması hâlinde kullanılır; tekrar başlatılmayacaksa 04 kullanılır)' },
  { kod: '20', aciklama: 'Kampanya bitimi (iş akdinin askıya alınması hâlinde kullanılır; tekrar başlatılmayacaksa 04 kullanılır)' },
  { kod: '21', aciklama: 'Statü değişikliği' },
  { kod: '22', aciklama: 'Diğer nedenler' },
  { kod: '23', aciklama: 'İşçi tarafından zorunlu nedenle fesih', kidem: true },
  { kod: '24', aciklama: 'İşçi tarafından sağlık nedeniyle fesih', kidem: true },
  { kod: '25', aciklama: 'İşçi tarafından işverenin ahlak ve iyi niyet kurallarına aykırı davranışı nedeni ile fesih', kidem: true },
  { kod: '26', aciklama: 'Disiplin kurulu kararı ile fesih' },
  { kod: '27', aciklama: 'İşveren tarafından zorunlu nedenlerle ve tutukluluk nedeniyle fesih', kidem: true },
  { kod: '28', aciklama: 'İşveren tarafından sağlık nedeni ile fesih', kidem: true },
  { kod: '30', aciklama: 'Vize süresinin bitimi (iş akdinin askıya alınması hâlinde kullanılır; tekrar başlatılmayacaksa 04 kullanılır)' },
  { kod: '31', aciklama: 'Borçlar Kanunu, Sendikalar Kanunu, Grev ve Lokavt Kanunu kapsamında kendi istek ve kusuru dışında fesih', kidem: true },
  { kod: '32', aciklama: '4046 sayılı Kanunun 21. maddesine göre özelleştirme nedeni ile fesih', kidem: true },
  { kod: '33', aciklama: 'Gazeteci tarafından sözleşmenin feshi' },
  { kod: '34', aciklama: 'İşyerinin devri, işin veya işyerinin niteliğinin değişmesi nedeniyle fesih', kidem: true },
  { kod: '35', aciklama: '6495 sayılı Kanun nedeniyle devlet memurluğuna geçiş', kidem: true },
  { kod: '36', aciklama: 'KHK ile işyerinin kapatılması', kidem: true },
  { kod: '37', aciklama: 'KHK ile kamu görevinden çıkarma' },
  { kod: '38', aciklama: 'Doğum nedeniyle işten ayrılma', kidem: true },
  { kod: '39', aciklama: '696 sayılı KHK ile kamu işçiliğine geçiş', kidem: true },
  { kod: '40', aciklama: '696 sayılı KHK ile kamu işçiliğine geçilememesi sebebiyle çıkış', kidem: true },
  { kod: '41', aciklama: "Re'sen işten ayrılış bildirgesi düzenlenenler" },
  { kod: '42', aciklama: '4857 SK 25/II-a: İş sözleşmesi yapılırken gerekli vasıf/şartlar kendisinde bulunmadığı hâlde bulunduğunu ileri sürerek ya da gerçeğe uygun olmayan bilgi/sözlerle işçinin işvereni yanıltması' },
  { kod: '43', aciklama: '4857 SK 25/II-b: İşçinin, işveren yahut aile üyelerinden birinin şeref ve namusuna dokunacak sözler sarf etmesi/davranışlarda bulunması ya da işveren hakkında şeref ve haysiyet kırıcı asılsız ihbar ve isnatlarda bulunması' },
  { kod: '44', aciklama: '4857 SK 25/II-c: İşçinin işverenin başka bir işçisine cinsel tacizde bulunması' },
  { kod: '45', aciklama: '4857 SK 25/II-d: İşçinin işverene/aile üyelerine/başka işçiye sataşması, işyerine sarhoş ya da uyuşturucu almış olarak gelmesi veya işyerinde bu maddeleri kullanması' },
  { kod: '46', aciklama: '4857 SK 25/II-e: İşçinin işverenin güvenini kötüye kullanmak, hırsızlık yapmak, meslek sırlarını ortaya atmak gibi doğruluk ve bağlılığa uymayan davranışlarda bulunması' },
  { kod: '47', aciklama: '4857 SK 25/II-f: İşçinin işyerinde yedi günden fazla hapisle cezalandırılan ve cezası ertelenmeyen bir suç işlemesi' },
  { kod: '48', aciklama: '4857 SK 25/II-g: İşçinin işverenden izin almaksızın veya haklı bir sebebe dayanmaksızın ardı ardına iki iş günü / bir ayda iki defa tatil sonrası iş günü / bir ayda üç iş günü işine devam etmemesi' },
  { kod: '49', aciklama: '4857 SK 25/II-h: İşçinin yapmakla ödevli bulunduğu görevleri kendisine hatırlatıldığı hâlde yapmamakta ısrar etmesi' },
  { kod: '50', aciklama: '4857 SK 25/II-ı: İşçinin kendi isteği veya savsaması yüzünden işin güvenliğini tehlikeye düşürmesi; işyerinin malı olan makine, tesisat veya eşyayı otuz günlük ücretiyle ödeyemeyecek derecede hasara/kayba uğratması', kidem: true },
] as const

const KOD_KUMESI = new Set(SGK_CIKIS_KODLARI.map((k) => k.kod))

/** Geçerli SGK kodu mu? Yalnız iki haneli kod kabul edilir ("02"); "2" veya kod+metin reddedilir. */
export function sgkCikisKoduGecerliMi(kod: string | null | undefined): kod is string {
  return typeof kod === 'string' && KOD_KUMESI.has(kod.trim())
}

export function sgkCikisKoduAciklamasi(kod: string): string | undefined {
  return SGK_CIKIS_KODLARI.find((k) => k.kod === kod)?.aciklama
}

/** Çıkış tarafı ve devir tipi sözlükleri (PersonnelExitModal ile aynı; sunucu da bunları doğrular). */
export const CIKIS_TARAFLARI = ['İŞÇİ', 'İŞVEREN', 'KARŞILIKLI'] as const
export const CIKIS_DEVIR_TIPLERI = ['İSTENEN', 'İSTENMEYEN'] as const
export type CikisTarafi = (typeof CIKIS_TARAFLARI)[number]
export type CikisDevirTipi = (typeof CIKIS_DEVIR_TIPLERI)[number]
