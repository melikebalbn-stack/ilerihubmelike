// Tek kaynak: geçerli varyant tipleri + kullanıcıya gösterilecek etiketler.
// Değerler prisma/schema.prisma'daki EnvanterVaryantTipi enum'uyla birebir olmalı.
// Yeni bir varyant tipi eklenecekse SADECE burası ve şema güncellenir.

export const VARYANT_TIPI_SECENEKLERI = [
  { value: 'YOK', label: 'Varyantsız' },
  { value: 'BEDEN', label: 'Beden' },
  { value: 'NUMARA', label: 'Numara' },
  { value: 'RENK', label: 'Renk' },
  { value: 'BEDEN_RENK', label: 'Beden + Renk' },
  { value: 'NUMARA_RENK', label: 'Numara + Renk' },
] as const

export const GECERLI_VARYANT_TIPLERI = VARYANT_TIPI_SECENEKLERI.map((s) => s.value)

export type VaryantTipiDeger = (typeof VARYANT_TIPI_SECENEKLERI)[number]['value']
