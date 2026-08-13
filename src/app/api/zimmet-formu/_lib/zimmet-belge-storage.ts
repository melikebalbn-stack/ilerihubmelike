import fs from 'fs/promises'
import path from 'path'

/**
 * Islak imza belgeleri KVKK kapsamında kişisel veri — public/ ALTINDA
 * TUTULMAZ (Next.js public/ içindeki her şeyi auth'suz statik servis eder).
 * Varsayılan konum proje kökü dışında; UPLOAD_DIR env'i ile override
 * edilebilir (.env dosyasına dokunmadan da çalışsın diye default var).
 */
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : '/home/rokunet/shared/zimmet-imza'

/**
 * zimmetId / dosyaAdi TEK bir path segmenti olmalı — path separator (/ veya \),
 * '.', '..' veya boş string İÇEREMEZ. path.basename() sonucu girdiyle birebir
 * aynı değilse (yani girdi zaten birden fazla segment veya '..' barındırıyorsa)
 * reddedilir. Bu, UPLOAD_ROOT prefix kontrolünden BAĞIMSIZ, birincil koruma —
 * "../" içermeyen ama separator içeren (örn. "/etc/passwd", "alt/dizin/x.pdf")
 * girdilerin sessizce normalize edilip kabul edilmesini engeller.
 */
function gecerliYolSegmenti(segment: string): boolean {
  if (!segment) return false
  if (segment === '.' || segment === '..') return false
  if (segment.includes('/') || segment.includes('\\')) return false
  if (path.basename(segment) !== segment) return false
  return true
}

export function getZimmetBelgeKlasoru(zimmetId: string): string {
  return path.join(UPLOAD_ROOT, zimmetId)
}

/**
 * zimmetId + dosyaAdi'nı UPLOAD_ROOT ile birleştirip normalize eder.
 * İKİ KATMANLI koruma:
 *   1) gecerliYolSegmenti — zimmetId/dosyaAdi tek segment olmalı (birincil).
 *   2) UPLOAD_ROOT prefix kontrolü — savunma katmanı (defense-in-depth),
 *      artık tek başına güvenilen katman DEĞİL.
 */
export function resolveGuvenliZimmetBelgeYolu(
  zimmetId: string,
  dosyaAdi: string
): string | null {
  if (!gecerliYolSegmenti(zimmetId) || !gecerliYolSegmenti(dosyaAdi)) {
    return null
  }

  const hedef = path.normalize(path.join(UPLOAD_ROOT, zimmetId, dosyaAdi))
  const kokleSonEk = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep
  if (hedef !== UPLOAD_ROOT && !hedef.startsWith(kokleSonEk)) {
    return null
  }
  return hedef
}

export async function zimmetBelgesiniKaydet(
  zimmetId: string,
  dosyaAdi: string,
  icerik: Buffer
): Promise<void> {
  const hedef = resolveGuvenliZimmetBelgeYolu(zimmetId, dosyaAdi)
  if (!hedef) throw new Error('Geçersiz dosya yolu')
  await fs.mkdir(getZimmetBelgeKlasoru(zimmetId), { recursive: true })
  await fs.writeFile(hedef, icerik)
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export function belgeMimeTuru(dosyaAdi: string): string {
  const ext = dosyaAdi.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}
