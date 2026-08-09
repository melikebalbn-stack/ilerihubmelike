/**
 * Türkçe-duyarlı metin normalize — arama ve karşılaştırma için TEK KAYNAK.
 *
 * Kullananlar: Sidebar menü araması, TemplateSelector (ölçüm şablonu araması),
 * YetkisizErisim (ticket kategorisi ada göre eşleştirme).
 *
 * Adımlar:
 *  1) toLocaleLowerCase('tr-TR') — İ→i, I→ı eşlemesini Türkçe kurallarına göre yapar
 *     (varsayılan locale'de "İ" → "i̇" olur, sonda birleşik nokta kalır).
 *  2) ı→i — DİKKAT: noktasız ı (U+0131) AYRI bir harftir, NFD ile AYRIŞMAZ,
 *     dolayısıyla (3)'teki diakritik strip ona DOKUNMAZ. Bu satır silinirse
 *     "calisan"/"sizma"/"yangin" gibi aramalar "Çalışan"/"Sızma"/"Yangın" ile
 *     eşleşmez — gerçek verilerle doğrulandı.
 *  3) NFD + combining-mark strip — ç/ğ/ü/ş/ö ve diğer diakritikleri düşürür.
 *
 * Örnekler:
 *   normalizeTr('Erişim Talepleri') === normalizeTr('Erisim Talepleri')  // true
 *   normalizeTr('Ölçüm Şablonları') === 'olcum sablonlari'
 *   normalizeTr('İş Analizi')       === 'is analizi'
 */
export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
