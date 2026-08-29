/**
 * Zimmet Formu modülü genelinde (liste, personel seçimi, vb.) kullanılan ortak
 * arama yardımcıları. DB'deki isimler LDAP/AD kaynaklı, genelde Türkçe
 * karaktersiz (örn. "Nurgul Tastan") - sadece toLocaleLowerCase('tr-TR') tek
 * başına yeterli değil, "taş" aratıp "Tastan"ı bulabilmek için Türkçe
 * karakterleri Latin karşılığına katlamak (ş→s, ğ→g, ü→u, ö→o, ç→c, ı→i)
 * gerekiyor.
 */

export function turkceNormalize(metin: string): string {
  return metin
    .toLocaleLowerCase('tr-TR')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
}

export function metinEslesiyorMu(hedefMetin: string, aranan: string): boolean {
  if (!aranan.trim()) return true
  return turkceNormalize(hedefMetin).includes(turkceNormalize(aranan))
}

export function cokluAlandaAra(alanlar: (string | null | undefined)[], aranan: string): boolean {
  if (!aranan.trim()) return true
  return alanlar.some((alan) => alan && metinEslesiyorMu(alan, aranan))
}

// Eşitlik/tekilleştirme karşılaştırması için - turkceNormalize'a EK olarak
// fazla boşluğu da katlar ("LOGO  Bordro Plus" çift boşluklu DB yazımı ile
// tek boşluklu bir varyantın AYNI değer sayılması gerektiği yerlerde, ör.
// teslim-notlari.ts bilinenYazilimMi ve yazılım dropdown listesi tekilleştirme).
export function esitlikIcinNormalize(metin: string): string {
  return turkceNormalize(metin.trim().replace(/\s+/g, ' '))
}
