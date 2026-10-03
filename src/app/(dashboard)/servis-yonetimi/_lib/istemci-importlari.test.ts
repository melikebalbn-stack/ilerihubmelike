import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// 🔴 Birim testleri bunu YAKALAMAZ: bir istemci ('use client') dosyanın import ZİNCİRİ
// prisma/pg/fs/next/server gibi sunucu modüllerine ulaşırsa Next derlemesi patlar
// ("Can't resolve 'fs'", sayfa ve API 500). B2'de kapasite-gosterim.ts → kapasite.ts (→ prisma)
// ile yaşandı. Bu test servis-yonetimi altındaki TÜM 'use client' dosyaların TRANSİTİF import
// zincirini tarar; `import type` ve tamamı `type` olan adlandırılmış import'lar derlemede silinir,
// sayılmaz.
const SRC = resolve(__dirname, '../../../..')
const KOK = resolve(__dirname, '..')

const YASAK = [
  /^@\/lib\/prisma$/, /^@\/generated(\/|$)/, /^@prisma\//, /^pg$/, /^server-only$/,
  /^next\/server$/, /^next\/headers$/, /^next-auth$/, /^next-auth\/next$/, /^node:/, /^fs(\/|$)/,
  /^@\/lib\/audit-log$/, /^@\/lib\/auth\/require-permission$/, /^@\/lib\/auth\/auth-options$/,
]

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad)
    if (statSync(yol).isDirectory()) return dosyalar(yol)
    return /\.(ts|tsx)$/.test(ad) && !/\.test\.tsx?$/.test(ad) ? [yol] : []
  })
}

export function degerImportlari(kaynak: string): string[] {
  const sonuc: string[] = []
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;'"]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  for (const m of kaynak.matchAll(re)) {
    if (m[5]) { sonuc.push(m[5]); continue }
    if (m[2]) continue // import type / export type
    const ad = m[3].trim()
    const parantez = ad.match(/^\{([\s\S]*)\}$/)
    if (parantez) {
      const parcalar = parantez[1].split(',').map((p) => p.trim()).filter(Boolean)
      if (parcalar.length > 0 && parcalar.every((p) => p.startsWith('type '))) continue
    }
    sonuc.push(m[4])
  }
  return sonuc
}

function coz(spec: string, kimden: string): string | null {
  let taban: string
  if (spec.startsWith('@/')) taban = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) taban = resolve(dirname(kimden), spec)
  else return null // npm paketi — yalnız YASAK listesine bakılır
  for (const ek of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const yol = taban + ek
    if (existsSync(yol) && statSync(yol).isFile()) return yol
  }
  return null
}

/** Dosyadan başlayarak ilk yasak import yolunu (zincir) döndürür; yoksa null. */
export function yasakZincir(dosya: string, ziyaret = new Set<string>(), iz: string[] = []): string[] | null {
  if (ziyaret.has(dosya)) return null
  ziyaret.add(dosya)
  for (const spec of degerImportlari(readFileSync(dosya, 'utf-8'))) {
    if (YASAK.some((y) => y.test(spec))) return [...iz, dosya.replace(SRC, 'src'), `→ ${spec}`]
    const hedef = coz(spec, dosya)
    if (hedef) {
      const bulunan = yasakZincir(hedef, ziyaret, [...iz, dosya.replace(SRC, 'src')])
      if (bulunan) return bulunan
    }
  }
  return null
}

describe('değerImportlari ayrıştırıcısı', () => {
  it('import type, tamamı type olan adlandırılmış import ve export type SAYILMAZ', () => {
    const s = [
      "import type { A } from '@/lib/prisma'",
      "import { type B, type C } from '@/lib/prisma'",
      "export type { D } from '@/lib/prisma'",
      "import { E, type F } from './x'",
      "import {\n  G,\n  type H,\n} from './y'",
      "import './yan-etki'",
      "export { I } from './z'",
    ].join('\n')
    expect(degerImportlari(s)).toEqual(['./x', './y', './yan-etki', './z'])
  })

  it('yasak zincir yakalanır (sentetik dosya)', () => {
    // kapasite.ts prisma'ya bağlı: sunucu modülü
    const f = join(SRC, 'lib/servis-yonetimi/kapasite.ts')
    expect(yasakZincir(f)?.at(-1)).toContain('prisma')
  })
})

describe("servis-yonetimi 'use client' dosyaları: import zinciri sunucu modülüne ULAŞMAZ", () => {
  const tum = dosyalar(KOK)
  const istemci = tum.filter((f) => readFileSync(f, 'utf-8').trimStart().startsWith("'use client'"))
  // 'use client' olmayan ama istemciden import edilen ortak yardımcılar zincirle zaten taranır;
  // ayrıca _lib/_components altı her zaman istemci-güvenli kalmalı.
  const ortak = tum.filter((f) => /[\\/](_lib|_components)[\\/]/.test(f))
  const hedefler = [...new Set([...istemci, ...ortak])]

  it('taranan dosya sayısı makul (use client ≥ 15)', () => {
    expect(istemci.length).toBeGreaterThanOrEqual(15)
  })

  for (const dosya of hedefler) {
    it(dosya.replace(KOK, ''), () => {
      expect(yasakZincir(dosya)).toBeNull()
    })
  }
})
