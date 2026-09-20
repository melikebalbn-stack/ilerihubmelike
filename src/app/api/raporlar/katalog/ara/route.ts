import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { entityEtiketleri } from '../_entity-etiket'

export const dynamic = 'force-dynamic'

/**
 * GET ?q=metin — alan adı, alan etiketi, entity adı VE entity etiketinde arama (aktif alanlar).
 * Dönüş: alan eşleşmeleri (≤200) + entity düzeyi eşleşmeler (ad/etiket; alan sayısıyla). İstemci gruplar.
 */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ sonuclar: [], entityler: [] })

  const [sonuclar, entityAdEslesen, etiketler] = await Promise.all([
    prisma.raporKatalog.findMany({
      where: { aktif: true, OR: [{ alan: { contains: q, mode: 'insensitive' } }, { etiket: { contains: q, mode: 'insensitive' } }] },
      select: { kaynakAd: true, entity: true, alan: true, veriTipi: true, anahtarMi: true, etiket: true },
      orderBy: [{ kaynakAd: 'asc' }, { entity: 'asc' }, { alan: 'asc' }],
      take: 200,
    }),
    prisma.raporKatalog.groupBy({ by: ['kaynakAd', 'entity'], where: { aktif: true, entity: { contains: q, mode: 'insensitive' } }, _count: { _all: true } }),
    entityEtiketleri(),
  ])

  // Entity düzeyi: adı eşleşenler + etiketi eşleşenler (alan sayısı ayrı sorguyla).
  const qn = q.toLocaleLowerCase('tr-TR')
  const etiketEslesen = [...etiketler.entries()].filter(([, e]) => e.etiket?.toLocaleLowerCase('tr-TR').includes(qn)).map(([k]) => k)
  const anahtarlar = new Set<string>([...entityAdEslesen.map((e) => `${e.kaynakAd}|${e.entity}`), ...etiketEslesen])
  const alanSayilari = new Map(entityAdEslesen.map((e) => [`${e.kaynakAd}|${e.entity}`, e._count._all]))
  // Alan eşleşmesiyle gelen entity'lerin toplam alan sayısı da gösterilsin (grup başlığı "N alan").
  const eksik = [...new Set([...anahtarlar, ...sonuclar.map((s) => `${s.kaynakAd}|${s.entity}`)])].filter((k) => !alanSayilari.has(k))
  if (eksik.length) {
    const ek = await prisma.raporKatalog.groupBy({ by: ['kaynakAd', 'entity'], where: { aktif: true, OR: eksik.map((k) => { const [kaynakAd, entity] = k.split('|'); return { kaynakAd, entity } }) }, _count: { _all: true } })
    for (const e of ek) alanSayilari.set(`${e.kaynakAd}|${e.entity}`, e._count._all)
  }
  const entityler = [...anahtarlar].map((k) => { const [kaynakAd, entity] = k.split('|'); return { kaynakAd, entity, etiket: etiketler.get(k)?.etiket ?? null, alanSayisi: alanSayilari.get(k) ?? 0, etiketEslesme: etiketEslesen.includes(k) } })

  return NextResponse.json({
    sonuclar: sonuclar.map((s) => ({ ...s, entityEtiket: etiketler.get(`${s.kaynakAd}|${s.entity}`)?.etiket ?? null, entityAlanSayisi: alanSayilari.get(`${s.kaynakAd}|${s.entity}`) ?? 0 })),
    entityler,
  })
}
