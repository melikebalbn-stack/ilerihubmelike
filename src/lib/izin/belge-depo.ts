/**
 * İzin belgeleri dosya deposu (Faz 4) — SLOT DIŞI ortak dizin: IZIN_BELGE_DIR (varsayılan
 * /home/rokunet/shared/izin-rapor). Dizin 700, dosya 600; dosya adı SUNUCU üretir (talepId + rastgele), okuma
 * TEK yol segmenti doğrulamasıyla (zimmet deseni) — istemci yolu hiçbir zaman dosya sistemine gitmez.
 * public/ ASLA. Yedekleme kapsamına eklenmeli (deploy notu).
 * '@/lib/prisma' İMPORT ETMEZ (test edilebilir).
 */
import { createHash, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const IZIN_BELGE_DIR_VARSAYILAN = '/home/rokunet/shared/izin-rapor'
const AD = /^[a-z0-9]{8,40}-[a-f0-9]{16}\.(pdf|png|jpg)$/

export function belgeDizini(env: NodeJS.ProcessEnv = process.env): string {
  const d = env.IZIN_BELGE_DIR?.trim() || IZIN_BELGE_DIR_VARSAYILAN
  if (!path.isAbsolute(d)) throw new Error(`IZIN_BELGE_DIR mutlak yol olmalı: ${d}`)
  if (d.split(path.sep).includes('public')) throw new Error('IZIN_BELGE_DIR public/ altında olamaz')
  return path.resolve(d)
}

export function belgeYaz(talepId: string, icerik: Uint8Array, uzanti: string, dizin = belgeDizini()) {
  fs.mkdirSync(dizin, { recursive: true, mode: 0o700 })
  fs.chmodSync(dizin, 0o700)
  const dosyaAdi = `${talepId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)}-${randomBytes(8).toString('hex')}.${uzanti}`
  if (!AD.test(dosyaAdi)) throw new Error('belge adı üretilemedi')
  const yol = path.join(dizin, dosyaAdi)
  fs.writeFileSync(yol, icerik, { mode: 0o600, flag: 'wx' })
  fs.chmodSync(yol, 0o600)
  return { dosyaAdi, sha256: createHash('sha256').update(icerik).digest('hex'), boyut: icerik.length }
}

/** Yalnız sunucunun ürettiği biçimdeki TEK segment ad okunur; dizin dışına çıkış imkânsız. */
export function belgeYolu(dosyaAdi: string, dizin = belgeDizini()): string {
  if (!AD.test(dosyaAdi) || dosyaAdi !== path.basename(dosyaAdi)) throw new Error('geçersiz belge adı')
  const yol = path.join(dizin, dosyaAdi)
  if (path.dirname(yol) !== dizin) throw new Error('geçersiz belge yolu')
  return yol
}

export function belgeOku(dosyaAdi: string, dizin = belgeDizini()): Buffer {
  return fs.readFileSync(belgeYolu(dosyaAdi, dizin))
}

/** Yalnız talep oluşturma başarısız olursa yazılan dosyayı geri almak için. */
export function belgeGeriAl(dosyaAdi: string, dizin = belgeDizini()) {
  try {
    fs.unlinkSync(belgeYolu(dosyaAdi, dizin))
  } catch {
    /* yok say */
  }
}

/** Planlanan imha tarihi = yükleme + saklama yılı (izin_belge_saklama_yil, varsayılan 15). */
export function imhaTarihi(yukleme: Date, yil: number): Date {
  const d = new Date(yukleme)
  d.setUTCFullYear(d.getUTCFullYear() + (Number.isInteger(yil) && yil > 0 ? yil : 15))
  return d
}
