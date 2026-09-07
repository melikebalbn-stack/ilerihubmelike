// RMA/SMA fotoğrafı — URL ↔ disk yolu çözümü ve güvenli silme. TEK KAYNAK.
// Desen kaynağı: lib/job-application/foto-dosya.ts (birebir aynı sözleşme).
//
// YOL MODELİ (elle string concat YOK, hepsi path.join):
//   yazma  : path.join(process.cwd(), 'public', 'uploads', 'kalite', 'rma', <YYYY>, <MM>, <ad>)
//   DB     : /api/files/uploads/kalite/rma/<YYYY>/<MM>/<ad>   (RmaFoto.dosyaYolu)
//   okuma  : path.join(process.cwd(), 'public', <relativePath>)
//            (api/files/[...path]/route.ts — bu dosya AYNI eşlemeyi kullanır)
//
// `public/uploads` gerçekte /home/rokunet/shared/uploads'a SYMLINK'tir (her iki
// slotta da) — dosyalar blue-green swap'te kaybolmaz. Bu yüzden hedef yol
// `realpath` ile çözülür; kapsam kontrolü de taban dizinin realpath'ine göre
// yapılır, böylece sabit "/home/rokunet/shared/..." yolu koda gömülmez.

import { mkdir, realpath, unlink } from 'fs/promises'
import path from 'path'

/** DB'de saklanan foto URL'inin zorunlu ön eki. */
export const FOTO_URL_ONEKI = '/api/files/uploads/kalite/rma/'

/** `/api/files/...` → servis ucunun kullandığı göreli yol (`uploads/kalite/rma/...`). */
const API_FILES_ONEKI = '/api/files/'

/** Yükleme kapıları — tickets/upload deseni; RMA'da PDF YOK, yalnız görsel. */
export const MAX_BYTES = 10 * 1024 * 1024 // 10MB
export function mimeGecerli(mime: string): boolean {
  return mime.startsWith('image/')
}

export type FotoSilmeSonucu =
  | { silindi: true; yol: string }
  | { silindi: false; sebep: 'url-yok' | 'bicim-disi' | 'dosya-yok' | 'kapsam-disi' | 'hata'; detay?: string }

/** Fotoğrafların bulunması gereken taban dizin (symlink çözülmüş). */
async function tabanDizin(): Promise<string> {
  return realpath(path.join(process.cwd(), 'public', 'uploads', 'kalite', 'rma'))
}

/**
 * Bu ay için hedef dizini oluşturur ve {absDir, urlOnEki} döner.
 * Yıl/ay kırılımı: tek dizinde on binlerce dosya birikmesin (tickets deseni).
 */
export async function hedefDizinHazirla(now: Date = new Date()): Promise<{
  absDir: string
  yil: string
  ay: string
}> {
  const yil = String(now.getFullYear())
  const ay = String(now.getMonth() + 1).padStart(2, '0')
  const absDir = path.join(process.cwd(), 'public', 'uploads', 'kalite', 'rma', yil, ay)
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
export function fotoUrl(yil: string, ay: string, dosyaAdi: string): string {
  return `${FOTO_URL_ONEKI}${yil}/${ay}/${dosyaAdi}`
}

/**
 * dosyaYolu'na karşılık gelen dosyayı siler.
 *
 * SÖZLEŞME — çağıran DB silmesini GERİ ALMAZ:
 *  - dosya yoksa       → { silindi:false, sebep:'dosya-yok' }  (sessiz, hata değil)
 *  - kapsam dışındaysa → { silindi:false, sebep:'kapsam-disi' } (SİLİNMEZ, loglanır)
 *  - beklenmedik hata  → { silindi:false, sebep:'hata' }        (yutulur, loglanır)
 * Hiçbir durumda throw ETMEZ.
 */
export async function fotoDosyasiniSil(dosyaYolu: string | null | undefined): Promise<FotoSilmeSonucu> {
  if (!dosyaYolu) return { silindi: false, sebep: 'url-yok' }

  // Yalnız bu modülün ürettiği biçim kabul edilir; '..' içeren hiçbir şey geçmez.
  if (!dosyaYolu.startsWith(FOTO_URL_ONEKI) || dosyaYolu.includes('..')) {
    return { silindi: false, sebep: 'bicim-disi', detay: dosyaYolu }
  }

  const rel = dosyaYolu.slice(API_FILES_ONEKI.length) // uploads/kalite/rma/...
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
    // ENOENT — dosya zaten yok (elle silinmiş olabilir). Hata değil.
    return { silindi: false, sebep: 'dosya-yok' }
  }

  // PATH TRAVERSAL KORUMASI: hedef, taban dizinin ALTINDA olmalı.
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
