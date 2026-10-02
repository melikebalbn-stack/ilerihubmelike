// Uygunsuzluk döküman eki — URL ↔ disk yolu çözümü ve güvenli silme. TEK KAYNAK.
// Desen kaynağı: lib/quality/rma-foto-dosya.ts (birebir aynı sözleşme), FARK:
// RMA yalnız görsel kabul eder, burada genel döküman (pdf/görsel/word/excel) da kabul edilir.
//
// YOL MODELİ (elle string concat YOK, hepsi path.join):
//   yazma  : path.join(process.cwd(), 'public', 'uploads', 'kalite', 'uygunsuzluk', <YYYY>, <MM>, <ad>)
//   DB     : /api/files/uploads/kalite/uygunsuzluk/<YYYY>/<MM>/<ad>  (KaliteUygunsuzlukDosya.dosyaUrl)
//   okuma  : path.join(process.cwd(), 'public', <relativePath>) — api/files/[...path]/route.ts AYNI eşlemeyi kullanır.
//
// `public/uploads` gerçekte paylaşımlı bir dizine SYMLINK'tir (blue-green swap'te
// kaybolmaz) — hedef yol `realpath` ile çözülür, kapsam kontrolü taban dizinin
// realpath'ine göre yapılır.

import { mkdir, realpath, unlink } from 'fs/promises'
import path from 'path'

/** DB'de saklanan dosya URL'inin zorunlu ön eki. */
export const DOSYA_URL_ONEKI = '/api/files/uploads/kalite/uygunsuzluk/'

/** `/api/files/...` → servis ucunun kullandığı göreli yol. */
const API_FILES_ONEKI = '/api/files/'

export const MAX_BYTES = 10 * 1024 * 1024 // 10MB — rma-foto-dosya ile aynı sınır

const IZINLI_MIME = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export function mimeGecerli(mime: string): boolean {
  return IZINLI_MIME.some((p) => mime.startsWith(p))
}

export type DosyaSilmeSonucu =
  | { silindi: true; yol: string }
  | { silindi: false; sebep: 'url-yok' | 'bicim-disi' | 'dosya-yok' | 'kapsam-disi' | 'hata'; detay?: string }

async function tabanDizin(): Promise<string> {
  return realpath(path.join(process.cwd(), 'public', 'uploads', 'kalite', 'uygunsuzluk'))
}

/** Bu ay için hedef dizini oluşturur ve {absDir, urlOnEki} döner — yıl/ay kırılımı (rma deseni). */
export async function hedefDizinHazirla(now: Date = new Date()): Promise<{
  absDir: string
  yil: string
  ay: string
}> {
  const yil = String(now.getFullYear())
  const ay = String(now.getMonth() + 1).padStart(2, '0')
  const absDir = path.join(process.cwd(), 'public', 'uploads', 'kalite', 'uygunsuzluk', yil, ay)
  await mkdir(absDir, { recursive: true })
  return { absDir, yil, ay }
}

/** Güvenli dosya adı: kullanıcı adı sanitize + timestamp + rastgele son ek. */
export function guvenliDosyaAdi(orijinalAd: string): string {
  const ext = path.extname(orijinalAd) || ''
  const baseName = path
    .basename(orijinalAd, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50)
  return `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`
}

/** DB'ye yazılacak servis URL'i. */
export function dosyaUrl(yil: string, ay: string, dosyaAdi: string): string {
  return `${DOSYA_URL_ONEKI}${yil}/${ay}/${dosyaAdi}`
}

/**
 * dosyaUrl'e karşılık gelen dosyayı siler. Hiçbir durumda throw ETMEZ —
 * çağıran DB silmesini geri almaz (rma-foto-dosya ile aynı sözleşme).
 */
export async function dosyaSil(dosyaUrlDeger: string | null | undefined): Promise<DosyaSilmeSonucu> {
  if (!dosyaUrlDeger) return { silindi: false, sebep: 'url-yok' }

  if (!dosyaUrlDeger.startsWith(DOSYA_URL_ONEKI) || dosyaUrlDeger.includes('..')) {
    return { silindi: false, sebep: 'bicim-disi', detay: dosyaUrlDeger }
  }

  const rel = dosyaUrlDeger.slice(API_FILES_ONEKI.length)
  const aday = path.join(process.cwd(), 'public', rel)

  let taban: string
  let hedef: string
  try {
    taban = await tabanDizin()
  } catch (e) {
    return { silindi: false, sebep: 'hata', detay: `taban dizin cozulemedi: ${String(e)}` }
  }
  try {
    hedef = await realpath(aday)
  } catch {
    return { silindi: false, sebep: 'dosya-yok' }
  }

  if (hedef !== taban && !hedef.startsWith(taban + path.sep)) {
    return { silindi: false, sebep: 'kapsam-disi', detay: hedef }
  }

  try {
    await unlink(hedef)
    return { silindi: true, yol: hedef }
  } catch (e) {
    return { silindi: false, sebep: 'hata', detay: String(e) }
  }
}
