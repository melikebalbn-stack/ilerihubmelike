import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { icerikTuru } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/raporlar — rapor şablonu listesi.
 * rapor.view: YAYINDA olanlar. rapor.tasarla da varsa TASLAK'lar da gelir (durum alanıyla).
 */
export async function GET() {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error

  const perms = await getUserPermissions(userId)
  const tasarlayabilir = perms.has(PERMISSION_KEYS.RAPOR_TASARLA)

  const sablonlar = await prisma.raporSablon.findMany({
    where: { durum: tasarlayabilir ? { in: ['YAYINDA', 'TASLAK'] } : 'YAYINDA' },
    select: { id: true, kod: true, ad: true, aciklama: true, durum: true, guncellenme: true, icerik: true },
    orderBy: [{ durum: 'asc' }, { ad: 'asc' }],
  })

  return NextResponse.json({ sablonlar: sablonlar.map(({ icerik, ...s }) => ({ ...s, tur: icerikTuru(icerik) })), tasarlayabilir })
}
