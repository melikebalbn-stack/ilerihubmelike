import type { ZimmetTuru } from '@/generated/prisma'

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
export function zimmetTurGosterim(zimmet: { tur: string; turDiger?: string | null }): string {
  const etiket = ZIMMET_TUR_ETIKET[zimmet.tur as ZimmetTuru] ?? zimmet.tur
  if (zimmet.tur === 'DIGER' && zimmet.turDiger?.trim()) {
    return `${etiket} · ${zimmet.turDiger.trim()}`
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

// DB'deki mevcut turDiger değeri listede yoksa (ör. "MAS Laptop", "Termal
// Yazıcı" - eski Syteline verisinden, aslında yazılım değil donanım) "Diğer"
// seçili gelir, serbest metinde mevcut değer aynen görünür - veri
// KAYBOLMAZ/DEĞİŞMEZ, kullanıcı elle değiştirmedikçe.
// `tur` da alınır: OFFICE_365 kaydında turDiger HER ZAMAN null'dır (bkz.
// yazilimKaydi) - turDiger'a bakarak "Office 365" seçili göstermek mümkün
// değil, tur===OFFICE_365 doğrudan kontrol edilmeli.
export function yazilimSecimindenTuret(
  tur: string,
  turDiger: string | null | undefined
): ZimmetYazilimSecenegi | '' {
  if (tur === 'OFFICE_365') return 'Office 365'
  const deger = turDiger?.trim()
  if (!deger) return ''
  return (ZIMMET_YAZILIM_SECENEKLERI as readonly string[]).includes(deger)
    ? (deger as ZimmetYazilimSecenegi)
    : 'Diğer'
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
