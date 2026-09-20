import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { entitySetleri } from '@/lib/rapor/ifs-metadata'
import { entityEtiketleri } from '../_entity-etiket'

export const dynamic = 'force-dynamic'

/** GET ?projeksiyon=X&ara=Y — entity listesi + alan sayısı + EntitySet adları ($metadata, önbellekli) + Türkçe etiket. `ara` entity adı VEYA etiketinde. */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const url = new URL(req.url)
  const projeksiyon = url.searchParams.get('projeksiyon')?.trim()
  const ara = url.searchParams.get('ara')?.trim()
  if (!projeksiyon) return NextResponse.json({ error: 'projeksiyon zorunlu' }, { status: 400 })

  const etiketler = await entityEtiketleri(projeksiyon)
  const tumu = await prisma.raporKatalog.groupBy({
    by: ['entity'],
    where: { kaynakTipi: 'IFS_ODATA', kaynakAd: projeksiyon, aktif: true },
    _count: { _all: true },
    orderBy: { entity: 'asc' },
  })
  const qn = ara?.toLocaleLowerCase('tr-TR')
  const gruplar = qn ? tumu.filter((g) => g.entity.toLocaleLowerCase('tr-TR').includes(qn) || (etiketler.get(`${projeksiyon}|${g.entity}`)?.etiket ?? '').toLocaleLowerCase('tr-TR').includes(qn)) : tumu
  // EntitySet eşlemesi alınamazsa (IFS erişimi yok) liste yine döner; UI set adını elle ister.
  let setler: Map<string, string[]> | null = null
  let uyari: string | undefined
  try { setler = await entitySetleri(projeksiyon) } catch (e) { uyari = `EntitySet adları alınamadı: ${e instanceof Error ? e.message : String(e)}` }

  return NextResponse.json({
    entityler: gruplar.map((g) => ({ entity: g.entity, alanSayisi: g._count._all, entitySetleri: setler?.get(g.entity) ?? [], etiket: etiketler.get(`${projeksiyon}|${g.entity}`)?.etiket ?? null })),
    ...(uyari ? { uyari } : {}),
  })
}
