// Toplu Syteline devrinden gelen kayıtların açıklaması "[Syteline devri] ..."
// teknik damgasıyla başlıyor - kaynağı işaretlemek için DB'ye yazılmış, kullanıcıya/
// PDF'e gösterilecek bir şey değil. DB'YE DOKUNULMUYOR (veri kaybı riski, ayrıca
// kaynak izini kaybetmemek için) - sadece GÖSTERİM sırasında temizleniyor.
// Önceden zimmetlerim/ZimmetlerimListesi.tsx içinde yerel bir kopyası vardı
// (temizAciklama) - tüm gösterim noktalarının (Düzenle dialogu, Liste, detay/
// onay/imzala sayfaları, PDF) AYNI mantığı kullanması için buraya taşındı.
// IT listesi aktarımının "[IT listesi 10.2026]" damgası da (tarih ne olursa olsun) aynı
// şekilde yalnız gösterimde temizlenir; baştaki birden fazla damga da atılır.
const TEKNIK_ONEK = /^\s*(?:\[Syteline devri\]|\[IT listesi [^\]]*\])\s*/

export function temizleAciklama(aciklama: string | null | undefined): string {
  if (!aciklama) return ''
  let s = aciklama
  while (TEKNIK_ONEK.test(s)) s = s.replace(TEKNIK_ONEK, '')
  return s.trim()
}
