import type { ZimmetTuru } from '@/generated/prisma'
import { esitlikIcinNormalize } from './arama'

// ZimmetTanim'daki "Yazılım" kök kaydının adı - kod tarafında KORUMALI
// (silinemez/yeniden adlandırılamaz, bkz. TanimCombobox.tsx). DB'de özel bir
// bayrağı yok, sadece bu isimle var olması yeterli - tam eşleşmeyle kontrol
// edilir.
export const YAZILIM_KOK_ADI = 'Yazılım'

// "Yazılım" kökünün gerçek id'si (henüz) çözülemediğinde (ör. ZimmetTanim
// tablosunun migration'ı henüz uygulanmadı) alt-dal Combobox'ına `parentId`
// olarak geçirilen sentinel değer - gerçek bir kayıtla ASLA eşleşmez, ama
// `null` da DEĞİLDİR (TanimCombobox'ta parentId=null "kök seviyesi" anlamına
// gelir - burada bu anlamla KARIŞMASIN diye). Combobox yine de normal şekilde
// render olur (arama, "+ Yeni ekle"), sadece DB'den çekilen liste boş gelir -
// kullanıcı hiçbir zaman serbest metin input'una düşmez (bkz.
// ZimmetFormuStep1.tsx, ZimmetListesi.tsx).
export const YAZILIM_KOK_COZULEMEDI_PARENT_ID = '__yazilim-kok-cozulemedi__'

// DB'deki enum → gösterim etiketi. ZimmetTuru enum'una DOKUNULMADI (migration
// gerekmesin diye) - OFFICE_365 ve DIGER değerleri DB'de aynen duruyor,
// SADECE görüntüleme katmanında "Yazılım" adı altında birleştiriliyor.
// Monitör/Mikrofon (DB'de hiç kaydı yok, formda hiç seçenek olarak
// sunulmuyor) bu konsolidasyonun kapsamı dışında, kendi adlarıyla kalıyor.
export const ZIMMET_TUR_ETIKET: Record<ZimmetTuru, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  YAZICI: 'Yazıcı',
  MONITOR: 'Monitör',
  MIKROFON: 'Mikrofon',
  OFFICE_365: 'Yazılım',
  DIGER: 'Yazılım',
}

// Tek bir kaydın tam gösterimi: DIGER türünde turDiger doluysa (ör. "LOGO
// Tiger3", "AUTOCAD YAZILIMI") "Yazılım · <turDiger>" olarak gösterilir -
// hangi yazılım/lisans olduğu kaybolmasın. Liste, Zimmetlerim, Onayla, İmzala,
// export-excel, bildirim e-postaları ve PDF hepsi BU TEK fonksiyondan geçer -
// önceden her dosyada ayrı ayrı tanımlıydı (bazıları turDiger'ı hiç
// göstermiyordu, bazıları etiketin YERİNE geçiriyordu, bazıları önüne
// eklemiyordu) - tek kaynağa indirgendi.
//
// `bilinenOzelTurler` opsiyonel (ZimmetTanim'daki kök tanım adları, "Yazılım"
// HARİÇ) - DIGER + turDiger'ın YENİ bir özel tür kaydı mı (turDiger =
// "TürAdı" veya "TürAdı · AltDal", bkz. ozelTurKaydi) yoksa eski/yazılım
// kaydı mı (turDiger = çıplak yazılım adı) olduğunu ayırt etmek için.
// turDiger'ın " · " öncesi ilk parçası bu listeden biriyle eşleşirse, değer
// zaten "TürAdı[· AltDal]" içeriyor demektir - OLDUĞU GİBİ basılır, "Yazılım"
// öneki EKLENMEZ. Eşleşmezse bugünkü (legacy) davranış aynen sürer. Parametre
// verilmezse (mevcut TÜM eski çağıranlar) davranış HİÇ değişmez - geriye
// dönük uyumlu.
export function zimmetTurGosterim(
  zimmet: { tur: string; turDiger?: string | null },
  bilinenOzelTurler: readonly string[] = []
): string {
  const etiket = ZIMMET_TUR_ETIKET[zimmet.tur as ZimmetTuru] ?? zimmet.tur
  if (zimmet.tur === 'DIGER' && zimmet.turDiger?.trim()) {
    const deger = zimmet.turDiger.trim()
    const ilkParca = deger.split('·')[0].trim()
    const ozelTurMu = bilinenOzelTurler.some(
      (ad) => esitlikIcinNormalize(ad) === esitlikIcinNormalize(ilkParca)
    )
    if (ozelTurMu) return deger
    return `${etiket} · ${deger}`
  }
  return etiket
}

// Formda seçilebilir türler - Liste ekranının istatistik kartlarıyla BİREBİR
// aynı liste (Notebook/Desktop/Cep Telefonu/El Terminali/Yazıcı/Yazılım).
// "Yazılım" seçilince enum karşılığı DEFAULT olarak DIGER + turDiger olur
// (bkz. ZIMMET_SECENEK_TO_ENUM) - AMA "Office 365" özel durumu var, bkz.
// yazilimKaydi(): o durumda OFFICE_365 + turDiger:null yazılır (Melih'in
// kararı - prod'daki mevcut 25 OFFICE_365 kaydıyla AYNI standart, aynı bilgi
// DB'de iki farklı şekilde temsil edilmesin).
export const ZIMMET_TUR_SECENEKLERI = [
  'Notebook Bilgisayar',
  'Desktop Bilgisayar',
  'Cep Telefonu',
  'El Terminali',
  'Yazıcı',
  'Yazılım',
] as const

export type ZimmetTurSecenegi = (typeof ZIMMET_TUR_SECENEKLERI)[number]

export const ZIMMET_SECENEK_TO_ENUM: Record<ZimmetTurSecenegi, ZimmetTuru> = {
  'Notebook Bilgisayar': 'NOTEBOOK_BILGISAYAR',
  'Desktop Bilgisayar': 'DESKTOP_BILGISAYAR',
  'Cep Telefonu': 'CEP_TELEFONU',
  'El Terminali': 'EL_TERMINALI',
  Yazıcı: 'YAZICI',
  Yazılım: 'DIGER',
}

// "Yazılım" (DIGER) seçilince turDiger için gösterilen liste - gerçek
// Syteline verisinden çıkan en sık görülen yazılımlar. Sonda "Diğer" var -
// listede olmayan bir yazılım için seçilince serbest metin input'u açılır
// (turDiger tamamen serbest metinden kalkmadı, sadece son çare oldu).
// Formda (ZimmetFormuStep1.tsx) ve Düzenle dialogunda (ZimmetListesi.tsx)
// AYNI liste kullanılır.
// DİKKAT: "LOGO  Bordro Plus" (LOGO ile Bordro arasında İKİ boşluk) ve
// "AUTOCAD YAZILIMI" DB'deki gerçek turDiger yazımlarıyla BİREBİR eşleşsin
// diye kasıtlı olarak bu şekilde - normalize edilmedi (bkz. doluluk analizi).
export const ZIMMET_YAZILIM_SECENEKLERI = [
  'Office 365',
  'LOGO Tiger3',
  'LOGO Connect',
  'LOGO  Bordro Plus',
  'SOLIDWORKS',
  'AUTOCAD YAZILIMI',
  'Adobe Lisans',
  'E-Flow',
  'Diğer',
] as const

export type ZimmetYazilimSecenegi = (typeof ZIMMET_YAZILIM_SECENEKLERI)[number]

// Alt-dal (yazılım) Combobox'ının sabit fallback listesi - "Diğer" hariç (o
// zaten TanimCombobox'ın kendisinde sabit olarak var, bkz. TanimCombobox.tsx
// DIGER). ZimmetTanim'daki Yazılım kökünün altına DB'den gelen gerçek
// satırlarla BİRLEŞTİRİLİR (haricTutulacaklar ile mükerrer engellenir, bkz.
// ZimmetFormuStep1.tsx / ZimmetListesi.tsx) - migration henüz
// uygulanmamışsa (tablo yok) veya kök kayıt bulunamazsa bile bu 8 yazılım
// dropdown'da görünmeye devam eder (Melih'in kararı - eski davranış migration
// olmadan da korunsun).
export const YAZILIM_ALT_DAL_SABIT_SECENEKLERI = ZIMMET_YAZILIM_SECENEKLERI.filter(
  (ad) => ad !== 'Diğer'
)

// DB'deki mevcut turDiger değeri listede yoksa (ör. "MAS Laptop", "Termal
// Yazıcı" - eski Syteline verisinden, aslında yazılım değil donanım) "Diğer"
// seçili gelir, serbest metinde mevcut değer aynen görünür - veri
// KAYBOLMAZ/DEĞİŞMEZ, kullanıcı elle değiştirmedikçe.
// `tur` da alınır: OFFICE_365 kaydında turDiger HER ZAMAN null'dır (bkz.
// yazilimKaydi) - turDiger'a bakarak "Office 365" seçili göstermek mümkün
// değil, tur===OFFICE_365 doğrudan kontrol edilmeli.
//
// `bilinenListe` opsiyonel - dropdown artık sabit 8 seçenekle SINIRLI değil,
// /api/zimmet-formu/tanim?parentId=<Yazılım kökünün id'si>'nden dinamik olarak
// genişliyor (ZimmetTanim'da Yazılım kökünün altına eklenen yeni yazılımlar).
// Çağıran taraf o dinamik listeyi geçirirse, önceden "Diğer" olarak görünen
// bir DB değeri artık KENDİ ismiyle seçili gösterilebilir. Varsayılan
// (parametre verilmezse) sabit listedir - dönüş tipi artık `string` (dinamik
// değerler statik union'a sığmaz).
export function yazilimSecimindenTuret(
  tur: string,
  turDiger: string | null | undefined,
  bilinenListe: readonly string[] = ZIMMET_YAZILIM_SECENEKLERI
): string {
  if (tur === 'OFFICE_365') return 'Office 365'
  const deger = turDiger?.trim()
  if (!deger) return ''
  return bilinenListe.includes(deger) ? deger : 'Diğer'
}

// Office 365 istisnası (Melih'in kararı): "Yazılım" seçilip "Office 365"
// işaretlenince/yazılınca DIGER+turDiger yerine doğrudan OFFICE_365 enum
// değerine (turDiger:null) yazılır - prod'daki mevcut 25 OFFICE_365 kaydıyla
// AYNI standart. Aynı bilgi DB'de iki farklı şekilde temsil edilmesin diye
// (raporlarda "OR unutma" riski) - Office 365 SADECE OFFICE_365 enum'unda
// yaşar, DIGER+"Office 365" hiç üretilmez. Diğer tüm yazılımlar (Diğer +
// serbest metin dahil) DIGER + turDiger olarak kalmaya devam eder.
//
// Girdi TEK bir metin (nihai turDiger string'i) - hangi UI yolundan geldiği
// (dropdown seçimi mi, "Diğer" serbest metni mi) önemli değil; kullanıcı
// "Diğer" seçip elle "Office 365" yazsa bile AYNI şekilde normalize edilir
// (tutarlılık - iki temsil asla oluşmaz). İstemci (wizard buildSubmitPayload,
// Düzenle dialogu) VE sunucu (route.ts create) HEPSİ bu TEK fonksiyondan
// geçer - biri unutulup diğeri unutulmasın.
export function yazilimKaydi(turDigerMetni: string): { tur: ZimmetTuru; turDiger: string | null } {
  const metin = turDigerMetni.trim()
  if (metin === 'Office 365') return { tur: 'OFFICE_365', turDiger: null }
  return { tur: 'DIGER', turDiger: metin || null }
}

// ── Yeni (DB'den eklenen) türler — hibrit çözüm ─────────────────────────────
// Enum'daki 6 sabit tür + Yazılım DEĞİŞMEDİ. Kullanıcı tür dropdown'undan
// tamamen YENİ bir tür (ör. "Tablet") eklerse, bu da yazılım gibi DIGER +
// turDiger deseniyle yazılır - Melih'in kararı: turDiger = "TürAdı" (alt-dal
// yoksa) veya "TürAdı · AltDal" (varsa). zimmetTurGosterim, turDiger'ın ilk
// parçasını bilinen özel tür adlarıyla karşılaştırıp bu kaydı YAZILIM'dan
// ayırt ediyor (yukarıda bkz.).
export function ozelTurKaydi(turAdi: string, altDal: string): { tur: ZimmetTuru; turDiger: string } {
  const ad = turAdi.trim()
  const alt = altDal.trim()
  return { tur: 'DIGER', turDiger: alt ? `${ad} · ${alt}` : ad }
}

// Var olan bir kaydın (tur, turDiger) ikilisinden TÜR dropdown'unun hangi
// seçeneği göstermesi gerektiğini türetir (Düzenle dialogu prefill).
// Sabit 6 tür ise direkt enum etiketi döner (altDal boş). OFFICE_365 ise
// "Yazılım" + altDal="Office 365". DIGER ise: turDiger'ın ilk parçası bilinen
// bir özel tür adıyla (ZimmetTanim kök listesi, "Yazılım" HARİÇ) eşleşiyorsa
// o türü + kalan kısmı (varsa) altDal olarak döner - eşleşmiyorsa "Yazılım"
// varsayılır (legacy/bilinmeyen DIGER kaydı davranışı, değişmedi).
export function turSecimindenTuret(
  tur: string,
  turDiger: string | null | undefined,
  bilinenOzelTurler: readonly string[] = []
): { turAdi: string; altDal: string } {
  if (tur === 'OFFICE_365') return { turAdi: YAZILIM_KOK_ADI, altDal: 'Office 365' }
  if (tur !== 'DIGER') {
    return { turAdi: ZIMMET_TUR_ETIKET[tur as ZimmetTuru] ?? tur, altDal: '' }
  }
  const deger = (turDiger ?? '').trim()
  if (!deger) return { turAdi: YAZILIM_KOK_ADI, altDal: '' }

  const parcalar = deger.split('·').map((p) => p.trim())
  const ilkParca = parcalar[0]
  const eslesenTur = bilinenOzelTurler.find(
    (ad) => esitlikIcinNormalize(ad) === esitlikIcinNormalize(ilkParca)
  )
  if (eslesenTur) {
    return { turAdi: eslesenTur, altDal: parcalar.slice(1).join(' · ') }
  }
  return { turAdi: YAZILIM_KOK_ADI, altDal: deger }
}

// Bir alt-dal Combobox'ının (Yazılım'ın çocukları VEYA yeni bir özel türün
// çocukları - ikisi de aynı ZimmetTanim tablosundan geliyor) mevcut değeri
// bilinen çocuklardan biriyle eşleşiyor mu diye bakar - eşleşmezse (boş
// değilse) "Diğer" döner, serbest metin aynen korunur.
export function altDalSecimindenTuret(deger: string, bilinenCocuklar: readonly string[]): string {
  const d = deger.trim()
  if (!d) return ''
  const eslesen = bilinenCocuklar.find((ad) => esitlikIcinNormalize(ad) === esitlikIcinNormalize(d))
  return eslesen ?? 'Diğer'
}
