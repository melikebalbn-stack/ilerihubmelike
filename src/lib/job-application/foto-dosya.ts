// Başvuru fotoğrafı — URL ↔ disk yolu çözümü ve güvenli silme. TEK KAYNAK.
//
// YOL MODELİ (elle string concat YOK, hepsi path.join):
//   yazma  : path.join(process.cwd(), 'public', 'uploads', 'job-applications', <YYYY/MM>, <ad>)
//            (api/job-application/route.ts)
//   DB     : /api/files/uploads/job-applications/<YYYY/MM>/<ad>
//   okuma  : path.join(process.cwd(), 'public', <relativePath>)
//            (api/files/[...path]/route.ts — bu dosya AYNI eşlemeyi kullanır)
//
// `public/uploads` gerçekte /home/rokunet/shared/uploads'a SYMLINK'tir. Bu yüzden hedef
// yol `realpath` ile çözülür; kapsam kontrolü de taban dizinin realpath'ine göre yapılır —
// böylece sabit "/home/rokunet/shared/..." yolu koda gömülmez ve symlink değişse de çalışır.

import { realpath, unlink } from 'fs/promises'
import path from 'path'

/** DB'de saklanan foto URL'inin zorunlu ön eki. */
export const FOTO_URL_ONEKI = '/api/files/uploads/job-applications/'

/** `/api/files/...` → servis ucunun kullandığı göreli yol (`uploads/job-applications/...`). */
const API_FILES_ONEKI = '/api/files/'

export type FotoSilmeSonucu =
  | { silindi: true; yol: string }
  | { silindi: false; sebep: 'url-yok' | 'bicim-disi' | 'dosya-yok' | 'kapsam-disi' | 'hata'; detay?: string }

/** Fotoğraf dosyasının bulunması gereken taban dizin (symlink çözülmüş). */
async function tabanDizin(): Promise<string> {
  return realpath(path.join(process.cwd(), 'public', 'uploads', 'job-applications'))
}

/**
 * photoUrl'e karşılık gelen dosyayı siler.
 *
 * SÖZLEŞME — çağıran DB silmesini GERİ ALMAZ:
 *  - dosya yoksa       → { silindi:false, sebep:'dosya-yok' }  (sessiz, hata değil)
 *  - kapsam dışındaysa → { silindi:false, sebep:'kapsam-disi' } (SİLİNMEZ, loglanır)
 *  - beklenmedik hata  → { silindi:false, sebep:'hata' }        (yutulur, loglanır)
 * Hiçbir durumda throw ETMEZ.
 */
export async function fotoDosyasiniSil(photoUrl: string | null | undefined): Promise<FotoSilmeSonucu> {
  if (!photoUrl) return { silindi: false, sebep: 'url-yok' }

  // Yalnız bu modülün ürettiği biçim kabul edilir; '..' içeren hiçbir şey geçmez.
  if (!photoUrl.startsWith(FOTO_URL_ONEKI) || photoUrl.includes('..')) {
    return { silindi: false, sebep: 'bicim-disi', detay: photoUrl }
  }

  const rel = photoUrl.slice(API_FILES_ONEKI.length) // uploads/job-applications/...
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
  // realpath sonrası karşılaştırma — symlink ile dışarı çıkma denemesi de burada yakalanır.
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
