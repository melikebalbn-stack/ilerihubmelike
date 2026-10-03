import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// 🔴 Birim testleri bunu YAKALAMAZ: istemci ('use client') dosya, prisma/pg çeken bir sunucu
// modülünü DEĞER olarak import ederse Next derlemesi "Can't resolve 'fs'" ile patlar (500).
// Bu kez B2'de kapasite-gosterim.ts → kapasite.ts (→ prisma) ile yaşandı. İstemci dosyalar
// sunucu modüllerinden yalnız `import type` alabilir.
const KOK = join(__dirname, '..')
const LIB = join(__dirname, '../../../../lib')
const SUNUCU_KOKLERI = ['@/lib/prisma', '@/lib/audit-log', '@/lib/auth/require-permission', 'next/server']

// lib/servis-yonetimi altında prisma'ya (dolaylı olarak da) bağlanan modüller = sunucu modülü.
function sunucuModulleriBul(): Set<string> {
  const dizin = join(LIB, 'servis-yonetimi')
  const kaynak = new Map(
    readdirSync(dizin)
      .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
      .map((f) => [f.replace(/\.ts$/, ''), readFileSync(join(dizin, f), 'utf-8')] as const),
  )
  const sunucu = new Set<string>()
  let degisti = true
  while (degisti) {
    degisti = false
    for (const [ad, icerik] of kaynak) {
      if (sunucu.has(ad)) continue
      const importlar = icerik.split('\n').filter((s) => /^import\s/.test(s) && !/^import type\s/.test(s))
      const bagli = importlar.some(
        (s) =>
          SUNUCU_KOKLERI.some((k) => s.includes(`'${k}'`)) ||
          [...sunucu].some((m) => s.includes(`'./${m}'`) || s.includes(`'@/lib/servis-yonetimi/${m}'`)),
      )
      if (bagli) {
        sunucu.add(ad)
        degisti = true
      }
    }
  }
  return sunucu
}
const SUNUCU = sunucuModulleriBul()
const sunucuImportu = (satir: string) =>
  [...SUNUCU].some((m) => satir.includes(`'@/lib/servis-yonetimi/${m}'`)) ||
  SUNUCU_KOKLERI.some((k) => satir.includes(`'${k}'`))

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad)
    if (statSync(yol).isDirectory()) return dosyalar(yol)
    return /\.(ts|tsx)$/.test(ad) && !/\.test\.tsx?$/.test(ad) ? [yol] : []
  })
}

describe('servis-yonetimi istemci dosyaları sunucu modülünü değer olarak import etmez', () => {
  const tum = dosyalar(KOK)
  const istemci = tum.filter((f) => readFileSync(f, 'utf-8').trimStart().startsWith("'use client'"))
  // _lib yardımcıları istemci bileşenlerden import edilir; onlar da aynı kurala tabi.
  const ortak = tum.filter((f) => /[\\/]_lib[\\/]/.test(f) || /[\\/]_components[\\/]/.test(f))
  const hedefler = [...new Set([...istemci, ...ortak])]

  it('hedef dosya bulundu; kapasite.ts sunucu, kapasite-etiket istemci-güvenli', () => {
    expect(hedefler.length).toBeGreaterThan(5)
    expect(SUNUCU.has('kapasite')).toBe(true)
    expect(SUNUCU.has('kapasite-etiket')).toBe(false)
    expect(SUNUCU.has('tarih-kurallari')).toBe(false)
  })

  for (const dosya of hedefler) {
    it(dosya.replace(KOK, ''), () => {
      const ihlal = readFileSync(dosya, 'utf-8')
        .split('\n')
        .filter((s) => /^import\s/.test(s) && !/^import type\s/.test(s) && sunucuImportu(s))
      expect(ihlal).toEqual([])
    })
  }
})
