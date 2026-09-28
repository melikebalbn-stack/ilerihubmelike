// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { IZIN_BELGE_DIR_VARSAYILAN, belgeDizini, belgeOku, belgeYaz, belgeYolu, imhaTarihi } from './belge-depo'

describe('izin belge deposu (Faz 4)', () => {
  it('dizin 700, dosya 600; ad sunucu üretimli; okunur', () => {
    const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'izin-belge-'))
    const dizin = path.join(kok, 'izin-rapor')
    fs.mkdirSync(dizin, { mode: 0o755 })
    const r = belgeYaz('cmtalep123', new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'pdf', dizin)
    expect(r.dosyaAdi).toMatch(/^cmtalep123-[a-f0-9]{16}\.pdf$/)
    expect(fs.statSync(dizin).mode & 0o777).toBe(0o700)
    expect(fs.statSync(path.join(dizin, r.dosyaAdi)).mode & 0o777).toBe(0o600)
    expect([...belgeOku(r.dosyaAdi, dizin)]).toEqual([0x25, 0x50, 0x44, 0x46])
    fs.rmSync(kok, { recursive: true, force: true })
  })
  it('istemci yolu / dizin dışı / biçim dışı ad reddedilir; public/ ve göreli dizin reddedilir', () => {
    for (const ad of ['../etc/passwd', 'a/b.pdf', 'x.pdf', 'cmtalep123-0123456789abcdef.exe']) expect(() => belgeYolu(ad, '/tmp/x')).toThrow()
    expect(belgeDizini({})).toBe(IZIN_BELGE_DIR_VARSAYILAN)
    expect(() => belgeDizini({ IZIN_BELGE_DIR: 'uploads/izin' })).toThrow(/mutlak/)
    expect(() => belgeDizini({ IZIN_BELGE_DIR: '/srv/app/public/izin' })).toThrow(/public/)
  })
  it('imha tarihi = yükleme + saklama yılı (varsayılan 15)', () => {
    expect(imhaTarihi(new Date('2026-09-28T10:00:00Z'), 15).toISOString()).toBe('2041-09-28T10:00:00.000Z')
    expect(imhaTarihi(new Date('2026-09-28T10:00:00Z'), 0).getUTCFullYear()).toBe(2041)
  })
})
