/**
 * İkamet adresi değişim damgası — TEK KAYNAK (Melih kararı, 22.09.2026).
 *
 * Personnel.ikametAdresi'ni yazan HER yol (put-govde.ts, toplu Excel import,
 * personele-donustur.ts yeniden-işe-alım) bu yardımcıdan geçmeli — aksi
 * halde ikametAdresiDegisimTarihi bazı yollarda sessizce bayatlar ve
 * "adres değişmedi" diyen ama aslında değişmiş bir uyarı sistemi üretir
 * (yanlış-negatif, hiç olmayan uyarı sisteminden daha kötü).
 *
 * Yalnız GERÇEK değişiklikte (trim sonrası eski !== yeni) damga basılır;
 * no-op'ta dönen boş nesne spread edildiğinde hiçbir alanı DOKUNMAZ.
 */

/**
 * YALNIZ KARŞILAŞTIRMA İÇİN normalleştirme (Melih kararı, 25.09.2026).
 *
 * 🔴 Saklanan adres BUNDAN ETKİLENMEZ — DB'ye kullanıcının girdiği değer
 * aynen yazılır. Bu fonksiyonun çıktısı hiçbir yere kaydedilmez, yalnız
 * "değişti mi?" sorusunu yanıtlar. Amaç: yalnızca büyük/küçük harf ya da
 * fazladan boşluk farkı yüzünden sahte "adres değişti" damgası basılmasın.
 *
 * Türkçe'ye duyarlı büyütme (`tr-TR`) + çoklu boşluğu teke indirme.
 *
 * 🔴 KARAR — İ/I KATLAMASI YAPILMAZ (Melih, 25.09.2026).
 * `toLocaleUpperCase('tr-TR')` noktalı ve noktasız i'yi AYRI harfler olarak
 * korur ("İstiklal" → İSTİKLAL, "ISTIKLAL" → ISTIKLAL), dolayısıyla bu iki
 * yazım FARKLI sayılır ve damga BASILIR. Bu bir eksiklik değil, bilinçli
 * tercihtir:
 *
 *   Katlamasız hata YANLIŞ POZİTİFTİR — adres değişmediği hâlde damga
 *   atılır; görünür ve ucuzdur.
 *   Katlamalı hata YANLIŞ NEGATİFTİR — "iş" ile "ış" aynı sayılır, damga
 *   hiç atılmaz, kişi yanlış serviste kalır ve kimse fark etmez.
 *
 * Sessiz hata görünür hataya tercih edilmez. Bu yüzden buraya
 * `.replace(/[İIıi]/g, 'I')` benzeri bir katlama EKLENMESİN — karar
 * adres-damgasi.test.ts'te iki vakayla sabitlenmiştir.
 */
function karsilastirmaIcinNormalize(deger: string | null | undefined): string | null {
  if (typeof deger !== 'string') return null
  const sadelesmis = deger.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR')
  return sadelesmis === '' ? null : sadelesmis
}

export function adresDegisimDamgasi(
  eskiAdres: string | null | undefined,
  yeniAdres: string | null | undefined,
): { ikametAdresiDegisimTarihi: Date } | Record<string, never> {
  // yeniAdres === undefined = "alan hiç gönderilmedi/bilgi yok" (örn. toplu
  // Excel import'ta boş hücre) — null/''den FARKLI: null/'' "kullanıcı
  // BİLEREK boşalttı" anlamına gelir ve gerçek değişiklik sayılabilir,
  // undefined ise KARŞILAŞTIRMAYA BİLE GİRMEDEN her zaman no-op'tur. Bu
  // ayrım olmasa toplu import'ta boş bırakılan (doldurulmamış, silinmek
  // İSTENMEYEN) adres sütunları mevcut adresleri sessizce sıfırlar ve
  // sahte "değişti" damgası basardı (FAZ 1C göçü tam bu yoldan geçecek).
  if (yeniAdres === undefined) return {}
  if (karsilastirmaIcinNormalize(eskiAdres) === karsilastirmaIcinNormalize(yeniAdres)) return {}
  return { ikametAdresiDegisimTarihi: new Date() }
}
