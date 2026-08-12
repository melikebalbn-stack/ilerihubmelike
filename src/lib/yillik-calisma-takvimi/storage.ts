import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
const ENV_NAME = 'YILLIK_TAKVIM_STORAGE_ROOT'
const TYPE_RULES = [
  { extensions: ['.pdf'], mimes: ['application/pdf'], magic: (b: Buffer) => b.subarray(0, 4).equals(Buffer.from('%PDF')) },
  { extensions: ['.jpg', '.jpeg'], mimes: ['image/jpeg'], magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extensions: ['.png'], mimes: ['image/png'], magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { extensions: ['.webp'], mimes: ['image/webp'], magic: (b: Buffer) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { extensions: ['.zip'], mimes: ['application/zip'], magic: zipMagic },
  { extensions: ['.docx'], mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: zipMagic },
  { extensions: ['.xlsx'], mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: zipMagic },
  { extensions: ['.doc'], mimes: ['application/msword'], magic: oleMagic },
  { extensions: ['.xls'], mimes: ['application/vnd.ms-excel'], magic: oleMagic },
] as const

function zipMagic(buffer: Buffer) { return buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]) }
function oleMagic(buffer: Buffer) { return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) }
function validSegment(value: string) { return !!value && value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\') && path.basename(value) === value }

export function getStorageRoot(): string {
  const configured = process.env[ENV_NAME]
  if (configured) return path.resolve(configured)
  if (process.env.NODE_ENV === 'production') throw new Error(`${ENV_NAME} production ortamında zorunludur`)
  return path.resolve(process.cwd(), '.local-storage', 'yillik-calisma-takvimi')
}

export function sanitizeDisplayName(value: string): string {
  const base = path.basename(value.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (base || 'dosya').slice(0, 200)
}

export function validateAttachment(name: string, mime: string, buffer: Buffer): { extension: string; mime: string; displayName: string } {
  if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_SIZE) throw new Error(`Dosya boyutu 0-${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB arasında olmalıdır`)
  const displayName = sanitizeDisplayName(name)
  const extension = path.extname(displayName).toLowerCase()
  const rule = TYPE_RULES.find(item => (item.extensions as readonly string[]).includes(extension))
  if (!rule || !(rule.mimes as readonly string[]).includes(mime.toLowerCase()) || !rule.magic(buffer)) throw new Error('Dosya uzantısı, MIME türü veya içeriği desteklenmiyor')
  return { extension, mime: mime.toLowerCase(), displayName }
}

export function createStorageKey(kayitId: string, extension: string): string {
  if (!validSegment(kayitId) || !/^\.[a-z0-9]{2,5}$/.test(extension)) throw new Error('Geçersiz storage anahtarı')
  return `${kayitId}/${randomUUID()}${extension}`
}

export function resolveStoragePath(storageKey: string): string {
  const parts = storageKey.split('/')
  if (parts.length !== 2 || !parts.every(validSegment)) throw new Error('Geçersiz storage yolu')
  const root = getStorageRoot()
  const resolved = path.resolve(root, ...parts)
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Storage kökü dışında dosya yolu')
  return resolved
}

export async function writeStoredFile(storageKey: string, buffer: Buffer): Promise<void> {
  const target = resolveStoragePath(storageKey)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, buffer, { flag: 'wx' })
}
export async function restoreStoredFile(storageKey: string, buffer: Buffer): Promise<void> {
  const target = resolveStoragePath(storageKey)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, buffer)
}
export async function readStoredFile(storageKey: string): Promise<Buffer> { return fs.readFile(resolveStoragePath(storageKey)) }
export async function removeStoredFile(storageKey: string): Promise<void> { await fs.unlink(resolveStoragePath(storageKey)) }
