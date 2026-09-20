import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { PROJEKSIYONLAR } from '@/lib/rapor/ifs-metadata'

export const dynamic = 'force-dynamic'

/** GET — IFS projeksiyonları: katalogdaki (entity sayısıyla) + PROJEKSIYONLAR'da olup yüklenmemişler. */
export async function GET() {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error

  const gruplar = await prisma.raporKatalog.groupBy({
    by: ['kaynakAd', 'entity'],
    where: { kaynakTipi: 'IFS_ODATA' },
  })
  const entitySayisi = new Map<string, number>()
  for (const g of gruplar) entitySayisi.set(g.kaynakAd, (entitySayisi.get(g.kaynakAd) ?? 0) + 1)

  const sonGuncelleme = await prisma.raporKatalog.groupBy({
    by: ['kaynakAd'],
    where: { kaynakTipi: 'IFS_ODATA' },
    _max: { guncellenme: true },
  })
  const guncellenme = new Map(sonGuncelleme.map((g) => [g.kaynakAd, g._max.guncellenme]))

  const adlar = new Set<string>([...PROJEKSIYONLAR, ...entitySayisi.keys()])
  const projeksiyonlar = [...adlar].sort().map((ad) => ({
    ad,
    yuklendi: entitySayisi.has(ad),
    entitySayisi: entitySayisi.get(ad) ?? 0,
    guncellenme: guncellenme.get(ad) ?? null,
  }))
  return NextResponse.json({ projeksiyonlar })
}
