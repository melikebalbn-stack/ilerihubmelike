/**
 * Arşiv etiketlerinde kullanılan 6 standart renk paleti.
 * 25 bölüm, anlamsal kategorilerine göre 6 renge map'lenir.
 * (Bölümün renkHex alanı UI'da koli badge'leri için kullanılır;
 *  etiketlerde bu standart palet uygulanır.)
 */

export type EtiketRenk = {
  hex: string
  isim: string
  textHex: string
}

const PALET = {
  mavi: { hex: '#2563EB', isim: 'Mavi', textHex: '#FFFFFF' },
  yesil: { hex: '#16A34A', isim: 'Yeşil', textHex: '#FFFFFF' },
  amber: { hex: '#F59E0B', isim: 'Amber', textHex: '#1F2937' },
  mor: { hex: '#9333EA', isim: 'Mor', textHex: '#FFFFFF' },
  gri: { hex: '#64748B', isim: 'Gri', textHex: '#FFFFFF' },
  kirmizi: { hex: '#DC2626', isim: 'Kırmızı', textHex: '#FFFFFF' },
} as const

const BOLUM_RENK_MAP: Record<string, EtiketRenk> = {
  // Mavi — Üretim ve Operasyon
  FAB: PALET.mavi,
  MMT: PALET.mavi,
  KYN: PALET.mavi,
  TLI: PALET.mavi,
  BAK: PALET.mavi,
  KLP: PALET.mavi,
  PEN: PALET.mavi,
  PRS: PALET.mavi,
  LZR: PALET.mavi,
  PRT: PALET.mavi,
  PKD: PALET.mavi,
  MHN: PALET.mavi,
  ASN: PALET.mavi,
  DEP: PALET.mavi,
  ASP: PALET.mavi,
  // Yeşil — Kalite
  KAL: PALET.yesil,
  // Amber — Satış / Pazarlama
  SAT: PALET.amber,
  // Mor — İK / Yönetim
  IVK: PALET.mor,
  IDR: PALET.mor,
  GMD: PALET.mor,
  YAT: PALET.mor,
  YIG: PALET.mor,
  // Gri — Finans / Satınalma
  FMM: PALET.gri,
  SAR: PALET.gri,
  // Kırmızı — BGYS / Gizli evraklar (SGM)
  SGM: PALET.kirmizi,
}

export function getEtiketRenk(bolumKod: string): EtiketRenk {
  return BOLUM_RENK_MAP[bolumKod] ?? PALET.gri
}

/**
 * Alt koli harfine göre sequential renk.
 * Tasarım kararı: ana etikette her alt satırı ayrı renkle gösterilir
 * (A=Mavi, B=Yeşil, C=Amber, D=Mor, E=Gri, F=Kırmızı, sonra loop).
 * Alt etiket header'ında da alt'ın kendi rengi kullanılır.
 */
const SIRALI_PALET: EtiketRenk[] = [
  PALET.mavi,
  PALET.yesil,
  PALET.amber,
  PALET.mor,
  PALET.gri,
  PALET.kirmizi,
]

export function getAltKoliRenk(harf: string): EtiketRenk {
  const idx = harf.charCodeAt(0) - 'A'.charCodeAt(0)
  if (idx < 0) return PALET.mavi
  return SIRALI_PALET[idx % SIRALI_PALET.length]
}

export function gizlilikLabel(seviye: string): string {
  switch (seviye) {
    case 'KamuyaAcik':
      return 'Kamuya Açık'
    case 'SirketIci':
      return 'Şirket İçi'
    case 'Gizli':
      return 'Gizli'
    case 'CokGizli':
      return 'Çok Gizli'
    default:
      return seviye
  }
}
