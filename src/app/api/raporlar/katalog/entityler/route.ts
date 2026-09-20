import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { entitySetleri } from '@/lib/rapor/ifs-metadata'

export const dynamic = 'force-dynamic'

/** GET ?projeksiyon=X&ara=Y — projeksiyonun entity listesi + aktif alan sayıları + EntitySet adları ($metadata, önbellekli). */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const url = new URL(req.url)
  const projeksiyon = url.searchParams.get('projeksiyon')?.trim()
  const ara = url.searchParams.get('ara')?.trim()
  if (!projeksiyon) return NextResponse.json({ error: 'projeksiyon zorunlu' }, { status: 400 })

  const gruplar = await prisma.raporKatalog.groupBy({
    by: ['entity'],
    where: {
      kaynakTipi: 'IFS_ODATA', kaynakAd: projeksiyon, aktif: true,
      ...(ara ? { entity: { contains: ara, mode: 'insensitive' } } : {}),
    },
    _count: { _all: true },
    orderBy: { entity: 'asc' },
  })
  // EntitySet eşlemesi alınamazsa (IFS erişimi yok) liste yine döner; UI set adını elle ister.
  let setler: Map<string, string[]> | null = null
  let uyari: string | undefined
  try { setler = await entitySetleri(projeksiyon) } catch (e) { uyari = `EntitySet adları alınamadı: ${e instanceof Error ? e.message : String(e)}` }

  return NextResponse.json({
    entityler: gruplar.map((g) => ({ entity: g.entity, alanSayisi: g._count._all, entitySetleri: setler?.get(g.entity) ?? [] })),
    ...(uyari ? { uyari } : {}),
  })
}
