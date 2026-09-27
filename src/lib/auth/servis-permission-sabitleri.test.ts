import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
// Servis permission sabitleri — kaynak metin üzerinden sabitleme
// ============================================================================
//
// 🔴 NEDEN IMPORT DEĞİL, METİN OKUMA:
// prisma/seed-permissions.ts ve prisma/seed-servis-role-mapping.ts modül
// seviyesinde `main()` ÇAĞIRIYOR (dosya sonu). Bu dosyaları import etmek
// testin içinde SEED'İ ÇALIŞTIRIR — canlı DB'ye yazar. Bu yüzden sabitler
// import edilmez, kaynak metin okunur.
// Bunu "iyileştirip" import'a çevirmeyin; önce seed'lerin main() çağrısı
// `if (require.main === module)` benzeri bir korumaya alınmalı.
//
// Ders 82 notu: tek dosyada literal grep tek başına bir şey kanıtlamaz —
// bu yüzden anahtar kümesi İKİ dosyadan ayrı ayrı çıkarılıp karşılaştırılıyor
// (sözlük ile eşleme birbirini doğruluyor), sayı da ayrıca sabitleniyor.

const KOK = join(__dirname, '..', '..', '..')

function oku(gorece: string): string {
  return readFileSync(join(KOK, gorece), 'utf-8')
}

/** `'servis.x': ...` biçimindeki anahtarları bir bloktan çıkarır. */
function servisAnahtarlari(blok: string): string[] {
  return [...blok.matchAll(/'(servis\.[a-z.]+)'\s*:/g)].map(m => m[1])
}

function seedPermissionsSabiti(): string[] {
  const s = oku('prisma/seed-permissions.ts')
  const blok = s.split('const SERVIS_PERMISSIONS: Record<string, string> = {')[1].split('\n}')[0]
  return servisAnahtarlari(blok)
}

function roleMappingSabiti(): string[] {
  const s = oku('prisma/seed-servis-role-mapping.ts')
  const blok = s.split('const ROLE_MAPPING: Record<string, string[]> = {')[1].split('\n}')[0]
  return servisAnahtarlari(blok)
}

/** Başlıktaki matris tablosunun satırlarındaki anahtarlar. */
function matrisTablosu(): { anahtarlar: string[]; sayac: number } {
  const s = oku('prisma/seed-servis-role-mapping.ts')
  const m = /hedef tablosu \((\d+) anahtar\)/.exec(s)
  const anahtarlar = [...s.matchAll(/^\s*\*\s*\|\s*(servis\.[a-z.]+)\s*\|/gm)].map(x => x[1])
  return { anahtarlar, sayac: m ? Number(m[1]) : -1 }
}

const BEKLENEN = [
  'servis.view',
  'servis.create',
  'servis.edit',
  'servis.history',
  'servis.tanim.manage',
  'servis.sorumlu.manage',
  'servis.passive',
  'servis.restore',
  'servis.export',
  'servis.kvkk.view',
  'servis.liste.publish',
  'servis.sikayet.view',
  'servis.sikayet.manage',
]

describe('servis permission sabitleri', () => {
  it('🔴 servis.admin HİÇBİR sabitte yok (düşürüldü — tüketicisi yoktu, amacı tanımsızdı)', () => {
    expect(seedPermissionsSabiti()).not.toContain('servis.admin')
    expect(roleMappingSabiti()).not.toContain('servis.admin')
    expect(matrisTablosu().anahtarlar).not.toContain('servis.admin')
  })

  it('anahtar sayısı 13', () => {
    expect(seedPermissionsSabiti()).toHaveLength(13)
    expect(roleMappingSabiti()).toHaveLength(13)
  })

  it('SERVIS_PERMISSIONS tam olarak beklenen 13 anahtarı taşıyor', () => {
    expect(seedPermissionsSabiti().sort()).toEqual([...BEKLENEN].sort())
  })

  it('🔴 sözlük ile eşleme AYRIŞMIYOR — iki dosya aynı kümeyi taşır', () => {
    expect(new Set(roleMappingSabiti())).toEqual(new Set(seedPermissionsSabiti()))
  })

  it('başlıktaki matris tablosu da aynı küme ve sayaç 13', () => {
    const { anahtarlar, sayac } = matrisTablosu()
    expect(sayac).toBe(13)
    expect(new Set(anahtarlar)).toEqual(new Set(BEKLENEN))
    expect(anahtarlar).toHaveLength(13)
  })
})
