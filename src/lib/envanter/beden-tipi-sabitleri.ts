// Tek kaynak: geçerli beden tipleri + kullanıcıya gösterilecek etiketler.
// route.ts, page.tsx (liste dropdown + form Select) buradan beslenir.
// Yeni bir beden tipi eklenecekse SADECE burası güncellenir.

export const BEDEN_TIPI_SECENEKLERI = [
  { value: 'STANDART', label: 'Standart' },
  { value: 'UST_BEDEN', label: 'Üst Beden' },
  { value: 'ALT_BEDEN', label: 'Alt Beden' },
  { value: 'AYAKKABI_NO', label: 'Numara (Ayakkabı)' },
  { value: 'ELDIVEN_NO', label: 'Numara (Eldiven)' },
] as const

export const GECERLI_BEDEN_TIPLERI = BEDEN_TIPI_SECENEKLERI.map((s) => s.value)

export type BedenTipiDeger = (typeof BEDEN_TIPI_SECENEKLERI)[number]['value']
