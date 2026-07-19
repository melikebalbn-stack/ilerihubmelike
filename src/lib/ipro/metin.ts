/**
 * IPRO metin normalizasyonu — TEK TANIM.
 *
 * Türkçe aksan katlaması + küçük harf + boşluk sadeleştirme. Arama ve eşleştirme
 * yapan her yer bunu kullanır; üç ayrı kopya tutulmaz.
 *
 * Kullanan yerler:
 *   - ifs-personel-sync.ts  ILERIHub bolum/gorev ↔ IFS org/pozisyon eşleştirmesi
 *   - OperatorEslemeleriClient  tezgah combobox araması
 *   - yonetim-service.personelAra  operatör eklerken personel araması
 *
 * `server-only` YOK — hem sunucu hem istemci tarafında kullanılıyor.
 *
 * Katlama bilinçli: "sasi" da "şasi" de ŞASİ KAYNAK'ı bulmalı, "celik" de
 * ÇELİK'i. Türkçe klavye kullanmayan kullanıcı sonuç bulamamazdı.
 */
export function iproNormalize(s: string): string {
  return s
    .replace(/[ıİi]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
