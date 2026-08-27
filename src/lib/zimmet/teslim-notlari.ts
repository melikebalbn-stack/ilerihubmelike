/**
 * Zimmet türüne göre standart teslim koşulları / notlar metinleri.
 *
 * Hem sihirbazın (useZimmetFormu.ts, tur değişince otomatik dolduran useEffect)
 * hem de sunucu tarafının (pdf/route.ts, onayla/imzala sayfaları) AYNI metinleri
 * kullanabilmesi için buraya taşındı. Syteline devrinden (kaynak: SYTELINE_DEVIR)
 * gelen ~116 kayıt hiç teslimNotu almamıştı (toplu aktarım sihirbazdan geçmedi) -
 * bu yüzden "Teslim Koşulları" kutusu bu kayıtlarda hep boş görünüyordu. DB'ye
 * geriye dönük yazmak yerine, teslimNotu null olduğunda türe göre varsayılanı
 * GÖSTERİM ANINDA hesaplıyoruz (bkz. bu dosyayı kullanan 3 yer).
 */

import type { ZimmetTuru } from '@/generated/prisma'
import { turkceNormalize } from './arama'
import { ZIMMET_YAZILIM_SECENEKLERI } from './tur'

export const DEFAULT_TESLIM_NOTU =
  'Cihaz hasarsız teslim edilmiştir, kullanım kurallarına uyulacaktır.'

// OFFICE_365 ile DIGER (bilinen yazılım/lisans türleri) AYNI lisans metnini
// paylaşır - tek sabitten okunur, iki yerde kopyalanmasın.
const LISANS_TESLIM_NOTU =
  'Bu lisans şirket kullanımı içindir, kişisel amaçla kullanılamaz ve başka bir kullanıcıya devredilemez. Lisans süresi dolduğunda veya kullanıcının görevi sona erdiğinde lisans Bilgi Teknolojileri departmanına iade edilmek/devredilmek zorundadır.'

// DIGER türünde turDiger BİLİNEN bir yazılım adıyla eşleşiyorsa lisans metni
// gösterilir - eşleşmiyorsa (ör. Syteline devrinden gelen "MAS Laptop",
// "Termal Yazıcı" gibi aslen DONANIM olan eski DIGER kayıtları) donanım
// odaklı DEFAULT_TESLIM_NOTU'nda kalınır. "Diğer" (serbest metin seçeneğinin
// KENDİSİ, gerçek bir yazılım adı değil) kasıtlı olarak listeden çıkarıldı.
const BILINEN_YAZILIM_ADLARI = ZIMMET_YAZILIM_SECENEKLERI.filter((ad) => ad !== 'Diğer')

function bosluklariSikilastir(metin: string): string {
  return metin.trim().replace(/\s+/g, ' ')
}

// Büyük/küçük harf ve fazla boşluğa duyarsız karşılaştırma - "LOGO  Bordro
// Plus" (çift boşluk, DB'deki gerçek yazımla birebir) gibi varyantlar da
// yakalanabilsin diye.
function bilinenYazilimMi(turDiger: string | null | undefined): boolean {
  const deger = turDiger?.trim()
  if (!deger) return false
  const normalizeEdilmis = turkceNormalize(bosluklariSikilastir(deger))
  return BILINEN_YAZILIM_ADLARI.some(
    (ad) => turkceNormalize(bosluklariSikilastir(ad)) === normalizeEdilmis
  )
}

export const ZIMMET_TESLIM_NOTLARI: Partial<Record<ZimmetTuru, string>> = {
  NOTEBOOK_BILGISAYAR: `Markası, modeli, kullanıcı tanımlı programları liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Notebook bilgisayar eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili bilgisayar bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili bilgisayarın (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen bilgisayar satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Bilgisayarlarda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  DESKTOP_BILGISAYAR: `Markası, modeli, kullanıcı tanımlı programları liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Desktop bilgisayar eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili bilgisayar bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili bilgisayarın (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen bilgisayar satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Bilgisayarlarda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  CEP_TELEFONU: `1-) Aşağıda marka ve modeli yazılı cep telefonu, batarya ve şarj aleti, hasarsız ve tam olarak teslim edilmiştir.

2-) İş bu belge gereği bu cep telefonu satılmaz, kiralanmaz veya takas edilmez.

3-) Bu telefon ve ekipmanlarının minimum kullanma süresi 3 yıldır. Bu süreden önce üretici firma tarafından belirtilen garanti şartları dışında kalan durumlarda, oluşabilecek maddi ödemelerden kullanıcı sorumludur. ILERI GROUP bu süre içerisinde kullanıcı kaynaklı arızalanan telefonları yenilemekle mükellef değildir.

4-) Kullanıcıya teslim edilen telefon hattında, aşağıda belirtilen dakika ve data aşımı gerçekleşmesi halinde detaylı fatura incelenir. İş dışındaki kullanım tespitlerinde aşım bedeli kullanıcıdan tahsil edilecektir.`,

  EL_TERMINALI: `Tanımı ve özellikleri belirtilen endüstriyel el terminali birim sorumlusu olarak tarafınıza eksiksiz ve sağlam olarak teslim edilmiştir. Teslim edilen ürünler satılamaz, takas edilemez ve bir başka kullanıcıya devir edilemez. Bu ekipmanların minimum kullanım süresi 5 yıldır. Bu süreden önce üretici firma tarafından belirtilen garanti şartları dışında kalan durumlarda, oluşabilecek maddi ödemelerden kullanıcı sorumludur.

- El terminali veya ekipmanları üzerinde oluşabilecek hasar ve arızaları önce birim sorumlusuna, sonrasında Bilgi Teknolojileri departmanına bildirmekle sorumlusunuzdur.
- Hasar ve arıza bildirimi yapılmayan el terminalinin tespit edilmesi durumunda ilgili teknik servis raporuna göre belirlenen bedel, hasar şartları ağır ise, el terminalinin o güne ait sıfır cihaz bedeli zimmetlenen tutanak sahibinden tahsil edilir.
- İşten ayrılma, yıllık izin gibi durumlarda tutanak sahibi el terminalini Bilgi Teknolojileri bölümüne teslim etmek zorundadır.
- Bu sebeplerle şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.
- Birim sorumlusu yukarıda yazılı tüm şartları kabul etmiş sayılmakta olup ihlal durumlarında 5237 sayılı T.C.K. 151-153. maddelerine istinaden tüm sorumlulukları kabul etmiş sayılmaktadır.`,

  YAZICI: `Markası, modeli, IP adresi liste halinde ve ekipmanları işaretli olarak yazılı olan bir (1) adet Yazıcı eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili yazıcı bilgi teknolojileri departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mail msn gibi iletişim programları, Internet forumları, haber yorumları gibi benzer iletişim araçları ile hakaret ve sövme cürümlerinde, yasadışı yayınlarda TCK 125-200-426-427-480-490. Maddeleri gereğince,
- Şirket içi veya şirket dışındaki bilgisayar ve yazıcı sistemlerini ve servislerini yetkiniz dışında erişim ve dinleme halinde TCK 525. Madde gereğince;
- Amaç dışı kullanımlarda ve ilgili yazıcının (kullanıcı hatasından kaynaklanmayan donanım arızaları haricinde) zarar görmesi durumunda;

İş bu maddelerde yazılı kanun ve durumların ihlali halinde tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya aittir. Bu sebeple şirketin uğrayacağı her türlü zararın teslim edilen kullanıcı tarafından tazmin edileceği kayıtsız şartsız kabul ve taahhüt edilmiştir.

Teslim edilen yazıcı satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Yazıcıda lisansı olmayan hiçbir yazılım ve donanımın bulunmadığı kontrol edilerek teslim edilmiştir.`,

  MIKROFON: `Markası, modeli, seri numarası ve ekipmanları belirtilen bir (1) adet mikrofon bir (1) adet verici, eksiksiz ve sağlam olarak teslim edilmiştir.

İlgili mikrofon, Bilgi Teknolojileri Departmanı tarafından tarafınıza teslim edildikten sonra;

- Bilgi teknolojileri tarafından onaysız veya habersiz olarak yüklenen yazılımlarda 5864 nolu Fikir ve Sanat Eserleri kanunun gereğince,
- Mikrofonun; ses kayıtları, iletişim programları veya internet platformlarında yasa dışı yayınlarda kullanılması, TCK 125, 200, 426, 427, 480, 490. maddeleri gereğince hukuki ve cezai sorumluluk doğuracaktır.
- Şirket içi veya şirket dışındaki sistemlere yetkisiz erişim, ses kayıtlarının izinsiz dinlenmesi ve paylaşılması halinde, TCK 525. madde gereğince sorumluluk teslim edilen kullanıcıya ait olacaktır.
- Mikrofonun amacı dışında kullanılması ve kullanıcı hatasından kaynaklanan arızalar durumunda tüm sorumluluk kullanıcıya aittir.

Yukarıda belirtilen kanun ve kuralların ihlali halinde, meydana gelecek tüm maddi, hukuki ve cezai sorumluluk teslim edilen kullanıcıya ait olup, şirketin uğrayacağı zararlar eksiksiz olarak tazmin edileceği kabul ve taahhüt edilmiştir.

Teslim edilen mikrofon; satılamaz, takas edilemez ve bir başka kullanıcıya devredilemez. Mikrofon, lisansı olmayan herhangi bir yazılım veya donanım içermediği kontrol edilerek teslim edilmiştir.`,

  // NOT: Yüklenen Monitör_Zimmet_formu.docx içeriği, Mikrofon dosyasıyla birebir aynı metni içeriyor
  // (şirketin kendi şablonunda muhtemelen kopyala-yapıştır hatası — Monitör'e özgü ayrı bir metin yok).
  // Bu yüzden Monitör notu KISALTILMIŞ haliyle bırakıldı, YANLIŞLIKLA mikrofon metni kopyalanmadı.
  // Gerçek Monitör tutanağı metni netleşirse Melih üzerinden güncellenmeli.
  MONITOR: 'Teslim edilen monitör hasarsız ve eksiksiz olarak teslim alınmıştır. Amaç dışı kullanım veya kullanıcı hatasından kaynaklanan hasarlarda sorumluluk teslim alan kullanıcıya aittir.',

  OFFICE_365: LISANS_TESLIM_NOTU,
}

// DIGER, türe göre sabit bir metne bağlı DEĞİL - turDiger'ın bilinen bir
// yazılım adı olup olmadığına göre lisans metni ile donanım metni arasında
// seçim yapılır (yukarıdaki bilinenYazilimMi). Bu yüzden ZIMMET_TESLIM_NOTLARI
// sözlüğünde DIGER için ayrı bir girdi YOK - burada özel olarak ele alınıyor.
export function varsayilanTeslimNotu(
  tur: ZimmetTuru | null | undefined,
  turDiger?: string | null
): string {
  if (tur === 'DIGER') {
    return bilinenYazilimMi(turDiger) ? LISANS_TESLIM_NOTU : DEFAULT_TESLIM_NOTU
  }
  return (tur && ZIMMET_TESLIM_NOTLARI[tur]) || DEFAULT_TESLIM_NOTU
}
