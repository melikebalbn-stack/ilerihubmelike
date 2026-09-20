import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

/** GET ?q=metin — alan adı, Türkçe etiket VEYA entity adında arama (aktif); en fazla 200 satır (istemci entity'ye göre gruplar). */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ sonuclar: [] })

  const sonuclar = await prisma.raporKatalog.findMany({
    where: {
      aktif: true,
      OR: [{ alan: { contains: q, mode: 'insensitive' } }, { etiket: { contains: q, mode: 'insensitive' } }, { entity: { contains: q, mode: 'insensitive' } }],
    },
    select: { kaynakAd: true, entity: true, alan: true, veriTipi: true, anahtarMi: true, etiket: true },
    orderBy: [{ kaynakAd: 'asc' }, { entity: 'asc' }, { alan: 'asc' }],
    take: 200,
  })
  return NextResponse.json({ sonuclar })
}
