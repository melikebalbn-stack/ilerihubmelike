import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// C7-8: "bugün" UTC'den üretilemez (UTC 21:00-24:00 = Türkiye ertesi gün). Tek kaynak: bugunTR() / bugunTRTarihi().
const KOKLER = [
  'src/lib/servis-yonetimi',
  'src/app/api/servis-yonetimi',
  'src/app/(dashboard)/servis-yonetimi',
]
const YASAK = /new Date\(\)\.toISOString\(\)\.(slice|split)|new Date\(Date\.now\(\)[^)]*\)\.toISOString\(\)\.(slice|split)/

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad)
    if (statSync(yol).isDirectory()) return dosyalar(yol)
    return /\.(ts|tsx)$/.test(ad) && !/\.test\./.test(ad) ? [yol] : []
  })
}

describe('C7-8 — UTC tabanlı "bugün" üretimi yasak', () => {
  it('servis kodunda new Date().toISOString().slice/split yok (bugunTR kullanılmalı)', () => {
    const ihlal = KOKLER.flatMap(dosyalar).filter((d) => YASAK.test(readFileSync(d, 'utf8')))
    expect(ihlal).toEqual([])
  })
})
