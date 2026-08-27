// Toplu Syteline devrinden gelen kayıtların açıklaması "[Syteline devri] ..."
// teknik damgasıyla başlıyor - kaynağı işaretlemek için DB'ye yazılmış, kullanıcıya/
// PDF'e gösterilecek bir şey değil. DB'YE DOKUNULMUYOR (veri kaybı riski, ayrıca
// kaynak izini kaybetmemek için) - sadece GÖSTERİM sırasında temizleniyor.
// Önceden zimmetlerim/ZimmetlerimListesi.tsx içinde yerel bir kopyası vardı
// (temizAciklama) - tüm gösterim noktalarının (Düzenle dialogu, Liste, detay/
// onay/imzala sayfaları, PDF) AYNI mantığı kullanması için buraya taşındı.
const SYTELINE_DEVIR_ONEKI = /^\s*\[Syteline devri\]\s*/

export function temizleAciklama(aciklama: string | null | undefined): string {
  if (!aciklama) return ''
  return aciklama.replace(SYTELINE_DEVIR_ONEKI, '').trim()
}
