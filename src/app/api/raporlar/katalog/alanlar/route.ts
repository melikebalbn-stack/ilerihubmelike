import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

/** GET ?projeksiyon=X&entity=Y — aktif alanlar (alan, veriTipi, anahtarMi). */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const url = new URL(req.url)
  const projeksiyon = url.searchParams.get('projeksiyon')?.trim()
  const entity = url.searchParams.get('entity')?.trim()
  if (!projeksiyon || !entity) return NextResponse.json({ error: 'projeksiyon ve entity zorunlu' }, { status: 400 })

  const alanlar = await prisma.raporKatalog.findMany({
    where: { kaynakTipi: 'IFS_ODATA', kaynakAd: projeksiyon, entity, aktif: true },
    select: { alan: true, veriTipi: true, anahtarMi: true, etiket: true },
    orderBy: [{ anahtarMi: 'desc' }, { alan: 'asc' }],
  })
  return NextResponse.json({ alanlar })
}
