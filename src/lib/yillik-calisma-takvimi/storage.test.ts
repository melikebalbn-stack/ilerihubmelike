import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStorageKey, readStoredFile, removeStoredFile, resolveStoragePath, validateAttachment, writeStoredFile } from './storage'

let root: string
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'yct-storage-')); vi.stubEnv('YILLIK_TAKVIM_STORAGE_ROOT', root) })
afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }) })
describe('Yıllık Takvim storage', () => {
  it('magic-byte, MIME ve uzantıyı birlikte doğrular', () => {
    const pdf = Buffer.from('%PDF-1.7 test')
    expect(validateAttachment('rapor.pdf', 'application/pdf', pdf)).toMatchObject({ extension: '.pdf', displayName: 'rapor.pdf' })
    expect(() => validateAttachment('zararli.pdf', 'application/pdf', Buffer.from('MZ executable'))).toThrow()
    expect(() => validateAttachment('script.js', 'text/javascript', Buffer.from('alert(1)'))).toThrow()
  })
  it('traversal adını yalnız görüntüleme adı olarak sanitize eder ve storage keyi server üretir', () => {
    expect(validateAttachment('../../rapor.pdf', 'application/pdf', Buffer.from('%PDF-x')).displayName).toBe('rapor.pdf')
    const key = createStorageKey('kayit-1', '.pdf'); expect(key).toMatch(/^kayit-1\/[0-9a-f-]{36}\.pdf$/)
    expect(() => resolveStoragePath('../outside/file.pdf')).toThrow()
  })
  it('temp root içinde yazma, okuma ve silme yapar', async () => {
    const key = createStorageKey('kayit-1', '.pdf'); const bytes = Buffer.from('%PDF-data')
    await writeStoredFile(key, bytes); expect(await readStoredFile(key)).toEqual(bytes)
    await removeStoredFile(key); await expect(readStoredFile(key)).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('production root tanımlı değilse yazılabilir yol üretmez', () => {
    vi.stubEnv('YILLIK_TAKVIM_STORAGE_ROOT', ''); vi.stubEnv('NODE_ENV', 'production')
    expect(() => resolveStoragePath('kayit-1/file.pdf')).toThrow(/YILLIK_TAKVIM_STORAGE_ROOT/)
  })
})
