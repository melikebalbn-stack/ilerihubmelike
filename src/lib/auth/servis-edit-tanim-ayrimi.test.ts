import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// ============================================================================
// servis.edit / servis.tanim.manage ANLAM AYRIMI (Melih kararı, 2026-09-27)
// ============================================================================
//
//   servis.edit         = OPERASYONEL kayıt düzenleme (personel atama, durum)
//   servis.tanim.manage = TANIM kaydı düzenleme (firma, yerleşke, güzergâh,
//                         durak, araç, şoför, sefer dilimi, varsayılanlar,
//                         sıra, saat)
//
// Bu test KOD DAVRANIŞINI DEĞİŞTİRMEZ — bugünkü durumu sabitler. Ayrım
// bugün yalnız BELGELEYİCİ: iki anahtarın rol kümesi şu an birebir aynı
// (super-admin, admin, hr-yoneticisi, idari-isler), yani erişim açısından
// fark üretmiyor. Sabitlemenin amacı, roller ileride ayrıştığında ayrımın
// sessizce kaymamış olması.
//
// 🔴 Route dosyaları IMPORT EDİLMEZ (prisma/next bağımlılıkları çeker);
// kaynak metin okunur. Desen: servis-permission-sabitleri.test.ts.

const API = join(__dirname, '..', '..', 'app', 'api', 'servis-yonetimi')

function tumRouteDosyalari(dizin = API): string[] {
  const cikti: string[] = []
  for (const ad of readdirSync(dizin)) {
    const tam = join(dizin, ad)
    if (statSync(tam).isDirectory()) cikti.push(...tumRouteDosyalari(tam))
    else if (ad === 'route.ts') cikti.push(tam)
  }
  return cikti
}

function anahtarlar(dosya: string): string[] {
  const s = readFileSync(dosya, 'utf-8')
  return [...s.matchAll(/'(servis\.[a-z.]+)'/g)].map(m => m[1])
}

const yol = (f: string) => relative(API, f).replace(/\\/g, '/')

/** servis.edit ile korunan uçlar — OPERASYONEL kayıtlar. */
const OPERASYONEL = ['guzergah-personel-atama/[id]/route.ts', 'personel-durum/[id]/route.ts']

/** servis.tanim.manage ile korunan uçlar — TANIM kayıtları. */
const TANIM = [
  'arac/[id]/route.ts', 'arac/route.ts',
  'durak/[id]/route.ts', 'durak/route.ts',
  'firma/[id]/route.ts', 'firma/route.ts',
  'yerleske/[id]/route.ts', 'yerleske/route.ts',
  'sofor/[id]/route.ts', 'sofor/route.ts',
  'sefer-dilimi/[id]/route.ts', 'sefer-dilimi/route.ts',
  'guzergah/[id]/route.ts', 'guzergah/route.ts',
  'guzergah/[id]/durak/route.ts',
  'guzergah/[id]/durak/reorder/route.ts',
  'guzergah/[id]/durak/reorder-bulk/route.ts',
  'guzergah/[id]/arac-varsayilan/route.ts',
  'guzergah/[id]/sofor-varsayilan/route.ts',
  'guzergah-arac-varsayilan/[id]/route.ts',
  'guzergah-sofor-varsayilan/[id]/route.ts',
  'guzergah-durak/[id]/saat/route.ts',
]

describe('servis.edit — OPERASYONEL kayıt düzenleme', () => {
  it.each(OPERASYONEL)('%s → servis.edit kullanır', (rel) => {
    const k = anahtarlar(join(API, rel))
    expect(k).toContain('servis.edit')
  })

  it('🔴 SÜRÜKLENME: servis.edit kullanan uç kümesi TAM OLARAK bu iki uç', () => {
    // Üçüncü bir uç servis.edit'e bağlanırsa (ya da bunlardan biri
    // tanim.manage'e kayarsa) burası patlar — ayrım sessizce kaymaz.
    const kullananlar = tumRouteDosyalari()
      .filter(f => anahtarlar(f).includes('servis.edit'))
      .map(yol)
      .sort()
    expect(kullananlar).toEqual([...OPERASYONEL].sort())
  })

  it('operasyonel uçlar TANIM anahtarını kullanmaz', () => {
    for (const rel of OPERASYONEL) {
      expect(anahtarlar(join(API, rel))).not.toContain('servis.tanim.manage')
    }
  })
})

describe('servis.tanim.manage — TANIM kaydı düzenleme', () => {
  it.each(TANIM)('%s → servis.tanim.manage kullanır', (rel) => {
    expect(anahtarlar(join(API, rel))).toContain('servis.tanim.manage')
  })

  it('🔴 tanım uçlarının HİÇBİRİ servis.edit kullanmaz', () => {
    const kacak = TANIM.filter(rel => anahtarlar(join(API, rel)).includes('servis.edit'))
    expect(kacak).toEqual([])
  })
})

describe('personel-ara — bilerek dokunulmadı', () => {
  it('üçlü OR koruması olduğu gibi duruyor (Melih: "olduğu gibi kalsın")', () => {
    const k = anahtarlar(join(API, 'personel-ara/route.ts'))
    expect(k).toEqual(['servis.tanim.manage', 'servis.sorumlu.manage', 'servis.create'])
    // Düşürülen anahtar buraya bağlanmadı — bağlamak erişimi daraltırdı.
    expect(k).not.toContain('servis.admin')
  })
})
