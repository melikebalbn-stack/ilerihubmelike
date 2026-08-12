// İş başvuru formu — metin alanlarını BÜYÜK HARFE çevirme. TEK KAYNAK.
// Hem istemci (yazarken görsel geri bildirim) hem sunucu (asıl kapı, kayıt anı) bunu kullanır;
// iki tarafta ayrı liste tutulursa sapma olur.
//
// TÜRKÇE KURALI: `toLocaleUpperCase('tr-TR')` ZORUNLU. Düz `toUpperCase()` Türkçe'de
// bozar: "i" → "I" (doğrusu "İ"), "ı" → "I" değil "I" ama "i" hatalı eşlenir.
// Örn. "işletme" → düz: "ISLETME" (yanlış) / tr-TR: "İŞLETME" (doğru).

/** Tek metni Türkçe kurallarına göre büyüt. Boş/whitespace ise olduğu gibi döner. */
export function buyukHarfTr(v: string | null | undefined): string {
  if (typeof v !== 'string') return ''
  return v.toLocaleUpperCase('tr-TR')
}

/**
 * BÜYÜK HARFE ÇEVRİLMEYECEK alanlar — beyaz liste DEĞİL, KARA liste.
 * Yeni alan eklendiğinde varsayılan davranış "büyüt" olur; buraya eklenmeyen bir
 * teknik alan bozulabilir, o yüzden liste bilinçli olarak AÇIK ve gerekçeli.
 */
export const BUYUK_HARF_HARIC = new Set<string>([
  // Kimlik / iletişim — teknik biçim
  'email',
  'tcKimlikNo',
  'mobilePhone',
  'workPhone',
  'homePhone',
  // Tarihler — ISO yyyy-MM-dd
  'birthDate',
  'militaryPostponeDate',
  'driverLicenseDate',
  'availableStartDate',
  'signatureDate',
  // Sayısal
  'numberOfChildren',
  'height',
  'weight',
  'expectedSalary',
  'shoeSize',
  // İkili/dosya — büyütmek anlamsız ya da BOZAR
  'digitalSignature', // base64 PNG dataURL — büyük/küçük harf duyarlı, bozulur
  'photo',
  'declarationAccepted',
  'preferredContactGsm',
  'preferredContactEmail',
  // Enum / seçim değerleri — sabit listeden gelir, dokunulmaz
  'gender',
  'bloodType',
  'militaryStatus',
  'maritalStatus',
  'educationLevel',
  'referralSource',
  'hasDriverLicense',
  'hasCriminalRecord',
  'hasConviction',
  'hasOngoingCase',
  'hasTravelRestriction',
  'canWorkShifts',
  'previouslyWorkedHere',
  'hasRelativesInCompany',
  'spouseWorking',
  'canContactLastEmployer',
  // Beden select'leri sabit listeden gelir (UST_BEDENLER / AYAKKABI_NOLARI /
  // altBedenSecenekleri) — büyütmek listeyle eşleşmeyi bozar.
  'clothingSizeUpper',
  'clothingSizeLower',
  // İç içe satır alanları (eğitim/kurs/iş tecrübesi) — yıl ya da MM/YYYY metni
  'startDate',
  'endDate',
  'attendanceDate',
])

/** Bu alan büyük harfe çevrilmeli mi? */
export function buyutulsunMu(alan: string): boolean {
  return !BUYUK_HARF_HARIC.has(alan)
}

/**
 * Alan adına göre koşullu büyütme — çağıranlar kendi listesini tutmasın diye.
 * Hariç listedeki alan DEĞİŞMEDEN döner.
 */
export function alanBuyut(alan: string, deger: string | null | undefined): string {
  const s = typeof deger === 'string' ? deger : ''
  return buyutulsunMu(alan) ? buyukHarfTr(s) : s
}
