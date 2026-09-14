/**
 * FİF Ek-2 fotoğrafı (öncesi/sonrası) — URL ↔ disk yolu. rma-foto-dosya.ts deseni.
 * DEPOLAMA: public/uploads/fif/<fifId>/ (public/uploads = paylaşımlı dizine symlink,
 * swap'te kaybolmaz). Servis: /api/files/uploads/fif/<fifId>/<ad> (oturum kontrollü).
 * FifEk.dosyaYolu bu URL'i tutar (şema değişikliği YOK — yalnız dosyaYolu var).
 */
import { mkdir, unlink, realpath } from 'fs/promises'
import path from 'path'

export const FIF_FOTO_URL_ONEKI = '/api/files/uploads/fif/'
export const FIF_FOTO_MAX_BYTES = 5 * 1024 * 1024 // 5MB
const IZINLI_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function fifMimeGecerli(mime: string): boolean {
  return IZINLI_MIME.has(mime)
}

export function fifGuvenliDosyaAdi(orijinalAd: string): string {
  const ext = path.extname(orijinalAd) || ''
  const baseName = path.basename(orijinalAd, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
  return `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`
}

/** fifId'ye özel dizini oluştur, {absDir} döner. */
export async function fifFotoDizin(fifId: string): Promise<string> {
  const guvenliId = fifId.replace(/[^a-zA-Z0-9_-]/g, '')
  const absDir = path.join(process.cwd(), 'public', 'uploads', 'fif', guvenliId)
  await mkdir(absDir, { recursive: true })
  return absDir
}

export function fifFotoUrl(fifId: string, dosyaAdi: string): string {
  const guvenliId = fifId.replace(/[^a-zA-Z0-9_-]/g, '')
  return `${FIF_FOTO_URL_ONEKI}${guvenliId}/${dosyaAdi}`
}

/** Güvenli sil: yalnız uploads/fif tabanı altındaki dosyayı sil. */
export async function fifFotoSil(dosyaYolu: string): Promise<boolean> {
  if (!dosyaYolu.startsWith(FIF_FOTO_URL_ONEKI)) return false
  const rel = dosyaYolu.replace('/api/files/', '') // uploads/fif/<id>/<ad>
  const abs = path.join(process.cwd(), 'public', rel)
  try {
    const taban = await realpath(path.join(process.cwd(), 'public', 'uploads', 'fif'))
    const hedef = await realpath(abs).catch(() => abs)
    if (!hedef.startsWith(taban)) return false
    await unlink(abs)
    return true
  } catch {
    return false
  }
}
