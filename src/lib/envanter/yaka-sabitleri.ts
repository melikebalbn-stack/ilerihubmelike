// Tek kaynak: gecerli hedef yaka degerleri + kullaniciya gosterilecek etiketler.
// Personnel.yakaRengi enumuyla birebir eslesir (MAVI/BEYAZ/GRI).
// Yeni bir yaka degeri eklenecekse SADECE burasi guncellenir.
export const HEDEF_YAKA_SECENEKLERI = [
  { value: 'MAVI', label: 'Mavi Yaka' },
  { value: 'BEYAZ', label: 'Beyaz Yaka' },
  { value: 'GRI', label: 'Gri Yaka' },
] as const
export const GECERLI_HEDEF_YAKALAR = HEDEF_YAKA_SECENEKLERI.map((s) => s.value)
export type HedefYakaDeger = (typeof HEDEF_YAKA_SECENEKLERI)[number]['value']
