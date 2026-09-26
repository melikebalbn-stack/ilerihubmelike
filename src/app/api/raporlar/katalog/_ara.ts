import { prisma } from '@/lib/prisma'
import { entityEtiketleri } from './_entity-etiket'

/**
 * Katalog araması — alan adı, alan etiketi, entity adı VE entity etiketinde (aktif alanlar).
 * GET /api/raporlar/katalog/ara ile AI alan önerisi (lib/rapor/alan-onerisi.ts) bunu ORTAK kullanır.
 */

export interface KatalogAramaAlani {
  kaynakAd: string
  entity: string
  alan: string
  veriTipi: string
  anahtarMi: boolean
  etiket: string | null
  entityEtiket: string | null
  entityAlanSayisi: number
}

export interface KatalogAramaEntity {
  kaynakAd: string
  entity: string
  etiket: string | null
  alanSayisi: number
  etiketEslesme: boolean
}

export interface KatalogAramaSonucu {
  sonuclar: KatalogAramaAlani[]
  entityler: KatalogAramaEntity[]
}

/** q < 2 karakterse boş döner. */
export async function katalogAra(q: string, limit = 200): Promise<KatalogAramaSonucu> {
  const aranan = q.trim()
  if (aranan.length < 2) return { sonuclar: [], entityler: [] }

  const [sonuclar, entityAdEslesen, etiketler] = await Promise.all([
    prisma.raporKatalog.findMany({
      where: { aktif: true, OR: [{ alan: { contains: aranan, mode: 'insensitive' } }, { etiket: { contains: aranan, mode: 'insensitive' } }] },
      select: { kaynakAd: true, entity: true, alan: true, veriTipi: true, anahtarMi: true, etiket: true },
      orderBy: [{ kaynakAd: 'asc' }, { entity: 'asc' }, { alan: 'asc' }],
      take: limit,
    }),
    prisma.raporKatalog.groupBy({ by: ['kaynakAd', 'entity'], where: { aktif: true, entity: { contains: aranan, mode: 'insensitive' } }, _count: { _all: true } }),
    entityEtiketleri(),
  ])

  // Entity düzeyi: adı eşleşenler + etiketi eşleşenler (alan sayısı ayrı sorguyla).
  const qn = aranan.toLocaleLowerCase('tr-TR')
  const etiketEslesen = [...etiketler.entries()].filter(([, e]) => e.etiket?.toLocaleLowerCase('tr-TR').includes(qn)).map(([k]) => k)
  const anahtarlar = new Set<string>([...entityAdEslesen.map((e) => `${e.kaynakAd}|${e.entity}`), ...etiketEslesen])
  const alanSayilari = new Map(entityAdEslesen.map((e) => [`${e.kaynakAd}|${e.entity}`, e._count._all]))
  // Alan eşleşmesiyle gelen entity'lerin toplam alan sayısı da gösterilsin (grup başlığı "N alan").
  const eksik = [...new Set([...anahtarlar, ...sonuclar.map((s) => `${s.kaynakAd}|${s.entity}`)])].filter((k) => !alanSayilari.has(k))
  if (eksik.length) {
    const ek = await prisma.raporKatalog.groupBy({
      by: ['kaynakAd', 'entity'],
      where: { aktif: true, OR: eksik.map((k) => { const [kaynakAd, entity] = k.split('|'); return { kaynakAd, entity } }) },
      _count: { _all: true },
    })
    for (const e of ek) alanSayilari.set(`${e.kaynakAd}|${e.entity}`, e._count._all)
  }

  return {
    sonuclar: sonuclar.map((s) => ({
      ...s,
      entityEtiket: etiketler.get(`${s.kaynakAd}|${s.entity}`)?.etiket ?? null,
      entityAlanSayisi: alanSayilari.get(`${s.kaynakAd}|${s.entity}`) ?? 0,
    })),
    entityler: [...anahtarlar].map((k) => {
      const [kaynakAd, entity] = k.split('|')
      return { kaynakAd, entity, etiket: etiketler.get(k)?.etiket ?? null, alanSayisi: alanSayilari.get(k) ?? 0, etiketEslesme: etiketEslesen.includes(k) }
    }),
  }
}
