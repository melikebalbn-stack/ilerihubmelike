import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// KPI modülünün kapsadığı departmanların ortak üst birimi (Genel Müdür'e
// bağlı Müdürlükler) — bkz. OrgUnit ağacı.
const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

export async function GET() {
  const { error } = await requirePermission([PERMISSION_KEYS.KPI_VIEW, PERMISSION_KEYS.KPI_MANAGE])
  if (error) return error

  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json({ departmanlar })
}
