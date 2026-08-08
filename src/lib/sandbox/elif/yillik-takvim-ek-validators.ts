export const ALLOWED_EK_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
] as const

export const MAX_EK_BOYUT = 15 * 1024 * 1024

export function ekTipiGecerliMi(mimeType: string): boolean {
  return (ALLOWED_EK_TYPES as readonly string[]).includes(mimeType)
}

export function ekBoyutuGecerliMi(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= MAX_EK_BOYUT
}
