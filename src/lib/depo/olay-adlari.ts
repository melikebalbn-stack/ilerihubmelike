/**
 * Depo hareket olaylarının ekran adları (istemci + sunucu ortak; server-only DEĞİL).
 * "Son İşlemlerim" listesi ve geri alma mesajlarında kullanılır.
 */
export const OLAY_ADLARI: Record<string, string> = {
  STOK_TASIMA: 'Stok taşıma',
  TOPLAMA_CIKIS: 'Malzeme toplama (iş emrine çıkış)',
  ETIKET_BASMA: 'Malzeme etiketi',
  MALZEME_TALEBI_OLUSTUR: 'Malzeme talebi açıldı',
  MALZEME_TALEBI_REZERV: 'Malzeme talebi — ekle (rezerv)',
  MALZEME_TALEBI_CIKAR: 'Malzeme talebi — çıkar',
  MALZEME_TALEBI_TUKET: 'Malzeme talebi — tüket',
  HU_OLUSTUR: 'Koli / palet oluşturuldu',
  HU_EKLE: 'Koli / palete malzeme ekleme',
  HU_CIKAR: 'Koli / paletten malzeme çıkarma',
  HU_TASI: 'Koli / palet taşıma',
  HU_DEGISTIR: 'Koliden koliye / paletten palete aktarma',
  HU_KOLI_EKLE: 'Palete koli ekleme',
  HU_KOLI_CIKAR: 'Paletten koli çıkarma',
  HU_ETIKET: 'Koli / palet etiketi',
  TOPLU_TASIMA_OLUSTUR: 'Toplu taşıma fişi açıldı',
  TOPLU_TASIMA_EKLE: 'Toplu taşıma — satır ekleme',
  TOPLU_TASIMA_SIL: 'Toplu taşıma — satır silme',
  TOPLU_TASIMA_TRANSFER: 'Toplu taşıma — transfer',
  TOPLU_TASIMA_IPTAL: 'Toplu taşıma fişi iptal',
  TRANSFER_TALEBI_BAGLA: 'Transfer talebi — stok bağlama',
  TRANSFER_TALEBI_KALDIR: 'Transfer talebi — stok kaldırma',
  TRANSFER_TALEBI_TRANSFER: 'Transfer talebi — transfer',
  SEVKIYAT_HAZIRLA: 'Sevkiyat hazırlama',
  SEVKIYAT_OKUT: 'Sevkiyat — okutma',
  SEVKIYAT_SIL: 'Sevkiyat — okutma silme',
  SEVKIYAT_TOPLA: 'Sevkiyat — toplama',
  SEVKIYAT_GERIAL: 'Sevkiyat — toplamayı geri alma',
  SAYIM_YAZ: 'Sayım',
  SAYIM_AYNI: 'Sayım (sistemdekiyle aynı)',
  GERI_AL: 'Geri alma',
}

export const olayAdi = (olay: string) => OLAY_ADLARI[olay] ?? olay
